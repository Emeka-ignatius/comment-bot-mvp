/**
 * Audio Capture Service
 * 
 * Captures audio from live stream pages using Playwright
 * Captures a short audio chunk for transcription (no external storage required)
 */

import { Page } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type ResolvedBinary = { name: string; path: string };

const resolveBinaryPath = async (
  packageName: string,
  fallbackCommand: string
): Promise<ResolvedBinary> => {
  try {
    const mod: any = await import(packageName);
    const resolved = mod?.default ?? mod;
    if (typeof resolved === 'string' && resolved.length > 0) {
      return { name: packageName, path: resolved };
    }
  } catch {
    // ignore
  }
  return { name: fallbackCommand, path: fallbackCommand };
};

const execFile = async (
  file: string,
  args: string[],
  options?: { timeoutMs?: number }
): Promise<{ stdout: string; stderr: string }> => {
  return await new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    const timeout =
      options?.timeoutMs != null
        ? setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`Process timed out after ${options.timeoutMs}ms: ${file}`));
          }, options.timeoutMs)
        : null;

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', err => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });
    child.on('close', code => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) return resolve({ stdout, stderr });
      reject(
        new Error(
          `Process failed (exit ${code}): ${file}\n${stderr || stdout || ''}`.trim()
        )
      );
    });
  });
};

export interface AudioCaptureConfig {
  page: Page;
  duration: number;        // How long to capture (in seconds)
  streamUrl: string;       // The stream URL for direct audio extraction
}

export interface AudioCaptureResult {
  audioBuffer: Buffer;     // Captured audio bytes (ready to transcribe)
  mimeType: string;
  filename: string;
  duration: number;        // Actual duration captured
  fileSize: number;        // Size in bytes
  transcript?: string;     // Optional: transcribed text
}

type CachedResolvedUrl = { url: string; ts: number };
const resolvedUrlCache = new Map<string, CachedResolvedUrl>();
const RESOLVED_URL_TTL_MS = 5 * 60 * 1000;

async function resolveMediaUrlWithYtDlp(streamUrl: string): Promise<string> {
  const cached = resolvedUrlCache.get(streamUrl);
  if (cached && Date.now() - cached.ts < RESOLVED_URL_TTL_MS) {
    return cached.url;
  }

  // Prefer yt-dlp-wrap (downloads yt-dlp at runtime; no system install required).
  try {
    const mod: any = await import('yt-dlp-wrap');
    // In ESM, this package exports an object with `default.default` as the constructor.
    const YTDlpWrap = mod?.default?.default ?? mod?.default ?? mod;
    if (typeof YTDlpWrap !== 'function') {
      throw new Error('yt-dlp-wrap export is not a constructor');
    }

    const binDir = path.join(os.tmpdir(), 'comment-bot-bin');
    await mkdir(binDir, { recursive: true });
    const binName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const binPath = path.join(binDir, binName);

    // yt-dlp-wrap does not auto-download yt-dlp; we download it to our bin path if missing.
    if (!existsSync(binPath) && typeof YTDlpWrap.downloadFromGithub === 'function') {
      console.log(`[AudioCapture] Downloading yt-dlp binary to ${binPath}`);
      await YTDlpWrap.downloadFromGithub(binPath);
    }

    const { stdout } = await execFile(
      binPath,
      ['-g', '-f', 'bestaudio', '--no-playlist', '--no-warnings', streamUrl],
      { timeoutMs: 45_000 }
    );
    const url = stdout
      .split(/\r?\n/)
      .map(s => s.trim())
      .find(Boolean);
    if (!url) throw new Error('yt-dlp returned no media URL');
    resolvedUrlCache.set(streamUrl, { url, ts: Date.now() });
    return url;
  } catch (err) {
    console.warn(
      `[AudioCapture] yt-dlp-wrap failed, falling back to system yt-dlp: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Fallback: system yt-dlp if present
  const { stdout } = await execFile(
    'yt-dlp',
    ['-g', '-f', 'bestaudio', '--no-playlist', '--no-warnings', streamUrl],
    { timeoutMs: 45_000 }
  );
  const url = stdout
    .split(/\r?\n/)
    .map(s => s.trim())
    .find(Boolean);
  if (!url) throw new Error('yt-dlp returned no media URL');
  resolvedUrlCache.set(streamUrl, { url, ts: Date.now() });
  return url;
}

/**
 * Capture audio from a live stream using ffmpeg
 * 
 * This extracts audio directly from the stream URL
 * Works for both Rumble and YouTube streams
 */
export async function captureStreamAudio(config: AudioCaptureConfig): Promise<AudioCaptureResult> {
  const { duration, streamUrl } = config;
  
  try {
    console.log(`[AudioCapture] Resolving media URL via yt-dlp for ${streamUrl}`);
    const mediaUrl = await resolveMediaUrlWithYtDlp(streamUrl);
    console.log(`[AudioCapture] Resolved media URL: ${mediaUrl.slice(0, 160)}...`);

    const ffmpeg = await resolveBinaryPath('ffmpeg-static', 'ffmpeg');

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'comment-bot-audio-'));
    const filename = `audio_${Date.now()}.wav`;
    const audioPath = path.join(tmpDir, filename);

    // Use ffmpeg to extract audio from the resolved media URL.
    // WAV PCM is reliable across ffmpeg builds (no codec surprises).
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      mediaUrl,
      '-t',
      String(duration),
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      'wav',
      audioPath,
    ];

    console.log(`[AudioCapture] Running ffmpeg (${ffmpeg.name}) for ${duration}s`);
    await execFile(ffmpeg.path, ffmpegArgs, { timeoutMs: (duration + 45) * 1000 });

    if (!existsSync(audioPath)) {
      throw new Error('ffmpeg finished but no audio file was created');
    }

    const audioBuffer = await readFile(audioPath);
    
    console.log(`[AudioCapture] Audio file size: ${audioBuffer.length} bytes`);
    
    if (audioBuffer.length < 1000) {
      console.warn(`[AudioCapture] Audio file is very small, capture may have failed`);
    }

    // Clean up temp dir (best effort)
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    
    return {
      audioBuffer,
      mimeType: 'audio/wav',
      filename,
      duration,
      fileSize: audioBuffer.length,
    };
    
  } catch (error) {
    console.error(`[AudioCapture] Failed to capture audio:`, error);
    throw error;
  }
}

/**
 * Capture audio using page context recording
 * 
 * This method attempts to record audio from the browser page itself
 * Useful for capturing streamer's voice if available in the page
 */
export async function capturePageContextAudio(config: AudioCaptureConfig): Promise<AudioCaptureResult> {
  const { page, duration } = config;
  
  try {
    console.log(`[AudioCapture] Starting page context audio capture for ${duration}s`);
    
    // Inject script to capture audio from the page
    const audioData = await page.evaluate(async (captureDuration: number) => {
      return new Promise<{ chunks: string; duration: number }>((resolve) => {
        try {
          // Create audio context
          const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
          const audioContext = AudioContext ? new AudioContext() : null;
          
          if (!audioContext) {
            console.log('[AudioCapture] AudioContext not available');
            resolve({ chunks: '', duration: captureDuration });
            return;
          }
          
          // Create destination
          const destination = audioContext.createMediaStreamDestination();
          
          // Try to connect to any audio/video elements
          const mediaElements = Array.from(document.querySelectorAll('audio, video')) as HTMLMediaElement[];
          let connected = false;
          
          for (const element of mediaElements) {
            try {
              const source = audioContext.createMediaElementAudioSource(element);
              source.connect(destination);
              connected = true;
              console.log('[AudioCapture] Connected to media element');
              break;
            } catch (e) {
              // Element might not have audio
            }
          }
          
          if (!connected) {
            console.log('[AudioCapture] Could not connect to any media elements');
            resolve({ chunks: '', duration: captureDuration });
            return;
          }
          
          // Create recorder
          const mediaRecorder = new (window as any).MediaRecorder(destination.stream);
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (event: any) => {
            chunks.push(event.data);
          };
          
          mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result as ArrayBuffer;
              const view = new Uint8Array(arrayBuffer);
              const binary = String.fromCharCode.apply(null, Array.from(view));
              const base64 = btoa(binary);
              resolve({ chunks: base64, duration: captureDuration });
            };
            reader.readAsArrayBuffer(blob);
          };
          
          mediaRecorder.start();
          
          // Stop after duration
          setTimeout(() => {
            mediaRecorder.stop();
          }, captureDuration * 1000);
          
        } catch (error) {
          console.log('[AudioCapture] Error in page context:', error);
          resolve({ chunks: '', duration: captureDuration });
        }
      });
    }, duration);
    
    if (!audioData.chunks) {
      throw new Error('No audio data captured from page context');
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioData.chunks, 'base64');
    
    console.log(`[AudioCapture] Audio captured from page context: ${audioBuffer.length} bytes`);

    const filename = `audio_${Date.now()}.webm`;

    return {
      audioBuffer,
      mimeType: 'audio/webm',
      filename,
      duration,
      fileSize: audioBuffer.length,
    };
    
  } catch (error) {
    console.error(`[AudioCapture] Failed to capture page audio:`, error);
    throw error;
  }
}

/**
 * Test if ffmpeg is available
 */
export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    const ffmpeg = await resolveBinaryPath('ffmpeg-static', 'ffmpeg');
    await execFile(ffmpeg.path, ['-version'], { timeoutMs: 5000 });
    return true;
  } catch (error) {
    console.warn(`[AudioCapture] FFmpeg not available:`, error);
    return false;
  }
}
