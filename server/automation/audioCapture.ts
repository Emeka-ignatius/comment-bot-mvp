/**
 * Audio Capture Service
 * 
 * Captures audio from live stream pages using Playwright
 * Captures a short audio chunk for transcription (no external storage required)
 */

import { Page } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rm, mkdtemp } from 'node:fs/promises';
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableSpawnError = (err: unknown) => {
  const e = err as any;
  const code = typeof e?.code === 'string' ? e.code : '';
  const msg = typeof e?.message === 'string' ? e.message : '';
  return (
    code === 'EBUSY' ||
    code === 'ETXTBSY' ||
    code === 'EPERM' ||
    msg.includes('spawn EBUSY') ||
    msg.includes('spawn ETXTBSY')
  );
};

const execFileWithRetries = async (
  file: string,
  args: string[],
  options?: { timeoutMs?: number; retries?: number; retryDelayMs?: number }
): Promise<{ stdout: string; stderr: string }> => {
  const retries = options?.retries ?? 2;
  const retryDelayMs = options?.retryDelayMs ?? 400;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await execFile(file, args, { timeoutMs: options?.timeoutMs });
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRetryableSpawnError(err)) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
};

const formatUnknownError = (err: unknown): string => {
  if (err instanceof Error) return err.stack || err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

async function commandExists(command: string): Promise<boolean> {
  try {
    // Works on most Linux images; if it fails, we assume command not available.
    await execFile(command, ['--version'], { timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}

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
  let lastWrapError: unknown;
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
      try {
        await YTDlpWrap.downloadFromGithub(binPath);
      } catch (err) {
        // Sometimes this lib throws non-Error objects; keep the error for logging, but still
        // proceed if the file exists (partial downloads can still succeed).
        lastWrapError = err;
      }
    }

    if (!existsSync(binPath)) {
      throw new Error(
        `yt-dlp binary is missing after download attempt (${binPath}). Error: ${formatUnknownError(lastWrapError)}`
      );
    }

    // On Linux/macOS, ensure the binary is executable.
    if (os.platform() !== 'win32') {
      try {
        await chmod(binPath, 0o755);
      } catch {
        // best effort
      }
    }

    const { stdout } = await execFileWithRetries(
      binPath,
      // Prefer audio-only, but fall back to combined streams when needed.
      ['-g', '-f', 'bestaudio/best', '--no-playlist', '--no-warnings', streamUrl],
      { timeoutMs: 45_000, retries: 2, retryDelayMs: 400 }
    );
    const url = stdout
      .split(/\r?\n/)
      .map(s => s.trim())
      .find(Boolean);
    if (!url) throw new Error('yt-dlp returned no media URL');
    resolvedUrlCache.set(streamUrl, { url, ts: Date.now() });
    return url;
  } catch (err) {
    lastWrapError = err;
    console.warn(`[AudioCapture] yt-dlp-wrap flow failed: ${formatUnknownError(err)}`);
  }

  // Fallback: system yt-dlp only if present
  if (!(await commandExists('yt-dlp'))) {
    throw new Error(
      `Audio capture requires yt-dlp. yt-dlp-wrap download failed and no system yt-dlp was found in PATH. Details: ${formatUnknownError(lastWrapError)}`
    );
  }

  const { stdout } = await execFileWithRetries(
    'yt-dlp',
    ['-g', '-f', 'bestaudio/best', '--no-playlist', '--no-warnings', streamUrl],
    { timeoutMs: 45_000, retries: 2, retryDelayMs: 400 }
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
