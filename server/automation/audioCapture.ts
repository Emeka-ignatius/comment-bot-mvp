/**
 * Audio Capture Service
 * 
 * Captures audio from live stream pages using Playwright
 * Captures a short audio chunk for transcription (no external storage required)
 */

import { Page } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rm, mkdtemp, writeFile } from 'node:fs/promises';
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
  mediaUrl?: string;       // Optional: already-resolved media URL (e.g., .m3u8) from browser context
  cookieString?: string;  // Optional: cookies to help bypass blocks
  proxyUrl?: string;      // Optional: proxy to use for yt-dlp fetching
  userAgent?: string;     // Optional: override UA for yt-dlp
  // Allow forward-compatible fields (prevents excess-property diagnostics in some TS/lint setups).
  [key: string]: unknown;
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

function parseCookieString(cookieString: string): Array<{ name: string; value: string }> {
  return cookieString
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const idx = pair.indexOf("=");
      if (idx <= 0) return null;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!name) return null;
      return { name, value };
    })
    .filter((x): x is { name: string; value: string } => Boolean(x));
}

async function writeNetscapeCookiesFile(opts: {
  cookieString: string;
  filePath: string;
  domains?: string[];
}): Promise<void> {
  const domains = opts.domains?.length ? opts.domains : [".rumble.com", "rumble.com"];
  const cookies = parseCookieString(opts.cookieString);

  const header = "# Netscape HTTP Cookie File\n";
  const lines: string[] = [header.trimEnd()];
  for (const domain of domains) {
    for (const c of cookies) {
      // domain, includeSubdomains, path, secure, expires, name, value
      // Expires "0" means session cookie.
      lines.push([domain, "TRUE", "/", "FALSE", "0", c.name, c.value].join("\t"));
    }
  }
  lines.push(""); // trailing newline
  await writeFile(opts.filePath, lines.join("\n"), "utf-8");
}

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

async function downloadYtDlpDirect(binPath: string): Promise<void> {
  // Direct download fallback (more reliable than yt-dlp-wrap in locked environments).
  const platform = os.platform();
  const url =
    platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'comment-bot-mvp/1.0 (+yt-dlp)' },
    });
    if (!res.ok) {
      throw new Error(`yt-dlp download failed: ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(binPath, buf);
    if (platform !== 'win32') {
      await chmod(binPath, 0o755);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureYtDlpBinary(): Promise<string> {
  const binDir = path.join(os.tmpdir(), 'comment-bot-bin');
  await mkdir(binDir, { recursive: true });
  const binName = os.platform() === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const binPath = path.join(binDir, binName);

  if (existsSync(binPath)) return binPath;

  console.log(`[AudioCapture] Downloading yt-dlp binary to ${binPath}`);
  await downloadYtDlpDirect(binPath);

  if (!existsSync(binPath)) {
    throw new Error(`yt-dlp binary is missing after download attempt (${binPath})`);
  }
  return binPath;
}

function buildYtDlpArgs(streamUrl: string, opts: { proxyUrl?: string; cookieString?: string; userAgent?: string }) {
  const args: string[] = ['-g', '-f', 'bestaudio/best', '--no-playlist', '--no-warnings'];
  if (opts.userAgent) {
    args.push('--user-agent', opts.userAgent);
  }
  if (opts.proxyUrl) {
    args.push('--proxy', opts.proxyUrl);
  }
  // Some sites (including Rumble) are picky about headers.
  args.push('--add-header', `Referer: ${streamUrl}`);
  args.push('--add-header', 'Accept-Language: en-US,en;q=0.9');
  args.push(streamUrl);
  return args;
}

function safeProxyLabel(proxyUrl?: string): string | undefined {
  if (!proxyUrl) return undefined;
  try {
    const u = new URL(proxyUrl);
    return `${u.hostname}:${u.port || (u.protocol === 'https:' ? '443' : '80')}`;
  } catch {
    // Fallback for non-URL formats
    return proxyUrl.split('@').pop();
  }
}

async function runFfmpegCapture(opts: {
  mediaUrl: string;
  duration: number;
  tmpDir: string;
  proxyUrl?: string;
}): Promise<{ audioPath: string }> {
  const ffmpeg = await resolveBinaryPath('ffmpeg-static', 'ffmpeg');
  const filename = `audio_${Date.now()}.wav`;
  const audioPath = path.join(opts.tmpDir, filename);

  const ffmpegArgs: string[] = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
  ];

  // If a proxy is provided, try to apply it for HTTP inputs.
  // (Works for many ffmpeg builds; if unsupported it will error and we’ll fall back.)
  if (opts.proxyUrl) {
    ffmpegArgs.push('-http_proxy', opts.proxyUrl);
  }

  ffmpegArgs.push(
    '-i',
    opts.mediaUrl,
    '-t',
    String(opts.duration),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-f',
    'wav',
    audioPath
  );

  console.log(
    `[AudioCapture] Running ffmpeg (${ffmpeg.name}) for ${opts.duration}s${opts.proxyUrl ? ` (proxy ${safeProxyLabel(opts.proxyUrl)})` : ''}`
  );
  await execFile(ffmpeg.path, ffmpegArgs, { timeoutMs: (opts.duration + 45) * 1000 });

  if (!existsSync(audioPath)) {
    throw new Error('ffmpeg finished but no audio file was created');
  }
  return { audioPath };
}

/**
 * Capture audio from a live stream using ffmpeg
 * 
 * This extracts audio directly from the stream URL
 * Works for both Rumble and YouTube streams
 */
export async function captureStreamAudio(config: AudioCaptureConfig): Promise<AudioCaptureResult> {
  const { duration, streamUrl, mediaUrl: mediaUrlOverride, cookieString, proxyUrl, userAgent } = config;
  let tmpDir: string | null = null;
  let cookieFilePath: string | null = null;
  try {
    if (!tmpDir) {
      tmpDir = await mkdtemp(path.join(os.tmpdir(), 'comment-bot-audio-'));
    }

    let mediaUrl = mediaUrlOverride;

    // If we don't have a media URL from the browser, resolve it using yt-dlp (can be blocked by CF).
    if (!mediaUrl) {
      console.log(
        `[AudioCapture] Resolving media URL via yt-dlp for ${streamUrl}` +
          (proxyUrl ? ` (proxy ${safeProxyLabel(proxyUrl)})` : '') +
          (cookieString ? ' (cookies provided)' : '')
      );
      // Prefer our direct-downloaded yt-dlp binary for reliability on Render.
      const ytdlpPath = await ensureYtDlpBinary();

      // If we have cookies, prefer passing them via a cookie file (avoids yt-dlp warning and is more reliable).
      if (cookieString) {
        cookieFilePath = path.join(tmpDir, `cookies_${Date.now()}.txt`);
        await writeNetscapeCookiesFile({
          cookieString,
          filePath: cookieFilePath,
          domains: [".rumble.com", "rumble.com", ".wn0.rumble.com", "wn0.rumble.com"],
        });
      }

      const baseArgs = buildYtDlpArgs(streamUrl, { proxyUrl, userAgent });
      const args = cookieFilePath
        ? [...baseArgs.slice(0, -1), '--cookies', cookieFilePath, baseArgs[baseArgs.length - 1]]
        : baseArgs;

      const { stdout } = await execFileWithRetries(ytdlpPath, args, {
        timeoutMs: 90_000,
        retries: 2,
        retryDelayMs: 600,
      });
      mediaUrl = stdout
        .split(/\r?\n/)
        .map(s => s.trim())
        .find(Boolean);
      if (!mediaUrl) throw new Error('yt-dlp returned no media URL');
      console.log(`[AudioCapture] Resolved media URL: ${mediaUrl.slice(0, 160)}...`);
    } else {
      console.log(`[AudioCapture] Using browser-detected media URL: ${mediaUrl.slice(0, 160)}...`);
    }

    const { audioPath } = await runFfmpegCapture({
      mediaUrl,
      duration,
      tmpDir,
      proxyUrl,
    });

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
      filename: path.basename(audioPath),
      duration,
      fileSize: audioBuffer.length,
    };
    
  } catch (error) {
    console.error(`[AudioCapture] Failed to capture audio:`, error);
    throw error;
  } finally {
    // If we created a temp dir but failed before returning, clean it up.
    if (tmpDir) {
      rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
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
