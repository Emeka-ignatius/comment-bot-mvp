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
import axios from "axios";

type ResolvedBinary = { name: string; path: string };

const resolveBinaryPath = async (
  packageName: string,
  fallbackCommand: string
): Promise<ResolvedBinary> => {
  try {
    const mod: any = await import(packageName);
    const resolved = mod?.default ?? mod;
    if (typeof resolved === 'string' && resolved.length > 0) {
      // Some packages (notably ffmpeg-static on Windows with certain pnpm settings)
      // can resolve to a path that doesn't actually exist. Verify before using.
      if (existsSync(resolved)) {
        return { name: packageName, path: resolved };
      }
    }
  } catch {
    // ignore
  }
  return { name: fallbackCommand, path: fallbackCommand };
};

async function resolveFfmpegBinaries(): Promise<ResolvedBinary[]> {
  const candidates: ResolvedBinary[] = [];

  // If explicitly provided, always try that first.
  const envPath = process.env.FFMPEG_PATH;
  if (envPath && typeof envPath === "string" && envPath.length > 0) {
    try {
      if (existsSync(envPath)) {
        candidates.push({ name: "FFMPEG_PATH", path: envPath });
      }
    } catch {
      // ignore
    }
  }

  // On Linux, ffmpeg-static tends to be the most compatible for server environments.
  // On Windows, @ffmpeg-installer/ffmpeg tends to be most reliable.
  const preferStaticFirst = os.platform() !== "win32";

  const tryFfmpegStatic = async () => {
    try {
      const mod: any = await import("ffmpeg-static");
      const p = mod?.default ?? mod;
      if (typeof p === "string" && p.length > 0 && existsSync(p)) {
        candidates.push({ name: "ffmpeg-static", path: p });
      }
    } catch {
      // ignore
    }
  };

  const tryFfmpegInstaller = async () => {
    try {
      const mod: any = await import("@ffmpeg-installer/ffmpeg");
      const p = mod?.path ?? mod?.default?.path;
      if (typeof p === "string" && p.length > 0 && existsSync(p)) {
        candidates.push({ name: "@ffmpeg-installer/ffmpeg", path: p });
      }
    } catch {
      // ignore
    }
  };

  if (preferStaticFirst) {
    await tryFfmpegStatic();
    await tryFfmpegInstaller();
  } else {
    await tryFfmpegInstaller();
    await tryFfmpegStatic();
  }

  // Always include system ffmpeg as last resort.
  candidates.push({ name: "ffmpeg", path: "ffmpeg" });

  // De-dupe by path.
  const seen = new Set<string>();
  return candidates.filter(c => {
    if (seen.has(c.path)) return false;
    seen.add(c.path);
    return true;
  });
}

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
    child.on('close', (code, signal) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) return resolve({ stdout, stderr });
      reject(
        new Error(
          `Process failed (exit ${code}${signal ? `, signal ${signal}` : ''}): ${file}\n${stderr || stdout || ''}`.trim()
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
  const domains = opts.domains?.length ? opts.domains : [".rumble.com"];
  const cookies = parseCookieString(opts.cookieString);

  const header = "# Netscape HTTP Cookie File\n";
  const lines: string[] = [header.trimEnd()];
  for (const domain of domains) {
    const d = domain.trim();
    if (!d) continue;
    // Netscape format expects:
    // - includeSubdomains TRUE only when domain starts with a leading dot.
    // - otherwise includeSubdomains should be FALSE.
    const includeSubdomains = d.startsWith(".") ? "TRUE" : "FALSE";
    for (const c of cookies) {
      // domain, includeSubdomains, path, secure, expires, name, value
      // Expires "0" means session cookie.
      lines.push([d, includeSubdomains, "/", "FALSE", "0", c.name, c.value].join("\t"));
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

function pickBestM3u8Url(urls: string[]): string | undefined {
  const cleaned = urls
    .map(u => u.trim())
    .filter(Boolean)
    .filter(u => u.startsWith("http"))
    .filter(u => u.includes(".m3u8"));
  if (cleaned.length === 0) return undefined;

  const score = (u: string) => {
    let s = 0;
    if (u.includes("chunklist")) s += 20;
    if (u.includes("playlist.m3u8")) s += 15;
    if (u.includes("live-hls")) s += 10;
    if (u.includes("dvr")) s += 5;
    if (!u.includes("rumble.com/")) s += 3;
    s += Math.min(10, Math.floor(u.length / 80));
    return s;
  };

  return cleaned.sort((a, b) => score(b) - score(a))[0];
}

function normalizeM3u8Candidate(raw: string): string | null {
  let s = (raw || "").trim();
  if (!s) return null;
  // De-escape common JSON escaping.
  s = s.replace(/\\\//g, "/").replace(/https:\\\/\\\//g, "https://").replace(/http:\\\/\\\//g, "http://");
  if (s.startsWith("//")) s = `https:${s}`;
  if (s.startsWith("/")) s = `https://rumble.com${s}`;
  if (!s.startsWith("http")) return null;
  if (!s.includes(".m3u8")) return null;
  return s;
}

function extractM3u8FromText(text: string): string | null {
  if (!text) return null;
  const t = text;
  // Match http(s) and also escaped https:\/\/ variants.
  const rawMatches =
    t.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/g) ||
    t.match(/https?:\\\/\\\/[^"'\\s]+\.m3u8[^"'\\s]*/g) ||
    t.match(/\\\/live-[^"'\\s]+\.m3u8[^"'\\s]*/g) ||
    [];
  const candidates = rawMatches
    .map(m => normalizeM3u8Candidate(m))
    .filter((x): x is string => Boolean(x));
  return pickBestM3u8Url(candidates) ?? null;
}

async function verifyM3u8Url(url: string, opts: { cookieString?: string; proxyUrl?: string }): Promise<boolean> {
  try {
    let httpsAgent: any;
    if (opts.proxyUrl) {
      try {
        const { HttpsProxyAgent } = await import("https-proxy-agent");
        httpsAgent = new HttpsProxyAgent(opts.proxyUrl);
      } catch {
        // ignore
      }
    }
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      Referer: "https://rumble.com/",
    };
    if (opts.cookieString) headers["Cookie"] = opts.cookieString;
    const res = await axios.get(url, {
      headers,
      httpsAgent,
      proxy: false,
      timeout: 12000,
      responseType: "text",
      validateStatus: () => true,
      maxRedirects: 5,
    });
    if (res.status !== 200) return false;
    const body = typeof res.data === "string" ? res.data : "";
    return body.includes("#EXTM3U");
  } catch {
    return false;
  }
}

async function fetchText(url: string, opts: { cookieString?: string; proxyUrl?: string; referer?: string; userAgent?: string }): Promise<{ status: number; text: string }> {
  let httpsAgent: any;
  if (opts.proxyUrl) {
    try {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      httpsAgent = new HttpsProxyAgent(opts.proxyUrl);
    } catch {
      // ignore
    }
  }
  const headers: Record<string, string> = {
    "User-Agent":
      opts.userAgent ??
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
    Referer: opts.referer ?? "https://rumble.com/",
  };
  if (opts.cookieString) headers["Cookie"] = opts.cookieString;
  const res = await axios.get(url, {
    headers,
    httpsAgent,
    proxy: false,
    timeout: 15000,
    responseType: "text",
    validateStatus: () => true,
    maxRedirects: 5,
  });
  return { status: res.status, text: typeof res.data === "string" ? res.data : "" };
}

function resolveM3u8Ref(baseUrl: string, ref: string): string | null {
  const r = ref.trim();
  if (!r || r.startsWith("#")) return null;
  if (r.startsWith("http://") || r.startsWith("https://")) return r;
  if (r.startsWith("//")) return `https:${r}`;
  try {
    return new URL(r, baseUrl).toString();
  } catch {
    return null;
  }
}

async function resolveBestHlsUrl(
  mediaUrl: string,
  opts: { cookieString?: string; proxyUrl?: string; referer?: string; userAgent?: string }
): Promise<string> {
  // If this is a master playlist (variants), prefer the first chunklist/variant entry.
  // This often yields a CDN URL like https://1a-1791.com/.../chunklist_DVR.m3u8 which is easier for ffmpeg to ingest.
  if (!mediaUrl.includes(".m3u8")) return mediaUrl;

  const { status, text } = await fetchText(mediaUrl, opts);
  if (status !== 200 || !text.includes("#EXTM3U")) {
    return mediaUrl;
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const refs: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const abs = resolveM3u8Ref(mediaUrl, line);
    if (abs && abs.includes(".m3u8")) refs.push(abs);
  }
  // If it already looks like a chunklist, keep it.
  if (mediaUrl.includes("chunklist")) return mediaUrl;

  const best = pickBestM3u8Url(refs) ?? refs[0];
  return best ?? mediaUrl;
}

async function tryResolveRumbleM3u8ViaEmbedEndpoints(opts: {
  streamUrl: string;
  cookieString?: string;
  proxyUrl?: string;
}): Promise<string | null> {
  // This mirrors our chatId extraction trick: oEmbed -> embed page -> embedJS request=video.
  // On Render, this is often accessible even when the main video page is CF-blocked.
  try {
    const { streamUrl, cookieString, proxyUrl } = opts;
    const oembedUrl = `https://rumble.com/api/Media/oembed.json?url=${encodeURIComponent(streamUrl)}`;
    const oembed = await axios.get(oembedUrl, { timeout: 15000, validateStatus: () => true });
    if (oembed.status !== 200) return null;
    const oembedData = typeof oembed.data === "string" ? JSON.parse(oembed.data) : oembed.data;
    const iframeHtml = String(oembedData?.html ?? "");
    const embedIdMatch = iframeHtml.match(/rumble\.com\/embed\/(v[a-z0-9]+)\//i);
    const embedId = embedIdMatch?.[1] ?? null;
    if (!embedId) return null;

    const embedPageUrl = `https://rumble.com/embed/${embedId}/`;
    const embedPage = await axios.get(embedPageUrl, { timeout: 15000, validateStatus: () => true });
    if (embedPage.status !== 200 || typeof embedPage.data !== "string") return null;
    const embedHtml = embedPage.data;
    const embedJsMatch = embedHtml.match(/\/embedJS\/u[a-z0-9]+/i);
    const embedJsPath = embedJsMatch?.[0] ?? "/embedJS/u4";

    const embedVideoUrl = `https://rumble.com${embedJsPath}/?request=video&v=${encodeURIComponent(embedId)}`;

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      Referer: embedPageUrl,
      Origin: "https://rumble.com",
    };
    if (cookieString) headers["Cookie"] = cookieString;

    let httpsAgent: any;
    if (proxyUrl) {
      try {
        const { HttpsProxyAgent } = await import("https-proxy-agent");
        httpsAgent = new HttpsProxyAgent(proxyUrl);
      } catch {
        // ignore
      }
    }

    const embedVideo = await axios.get(embedVideoUrl, {
      headers,
      httpsAgent,
      proxy: false,
      timeout: 15000,
      validateStatus: () => true,
    });
    if (embedVideo.status !== 200) return null;

    const rawText =
      typeof embedVideo.data === "string"
        ? embedVideo.data
        : JSON.stringify(embedVideo.data);

    const found = extractM3u8FromText(rawText);
    if (found) return found;

    // Fallback: many live streams use a predictable path based on the embed id (without leading "v").
    const idNoV = embedId.startsWith("v") ? embedId.slice(1) : embedId;
    const candidates = [
      `https://rumble.com/live-hls-dvr/${idNoV}/playlist.m3u8?level=1`,
      `https://rumble.com/live-hls-dvr/${idNoV}/playlist.m3u8`,
      `https://rumble.com/live-hls/${idNoV}/playlist.m3u8?level=1`,
      `https://rumble.com/live-hls/${idNoV}/playlist.m3u8`,
    ];
    for (const c of candidates) {
      if (await verifyM3u8Url(c, { cookieString, proxyUrl })) {
        return c;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function runFfmpegCapture(opts: {
  mediaUrl: string;
  duration: number;
  tmpDir: string;
  referer?: string;
  userAgent?: string;
  cookieString?: string;
  proxyUrl?: string;
}): Promise<{ audioPath: string }> {
  // Resolve a more "ffmpeg-friendly" URL if we're given a master playlist.
  let inputUrl = opts.mediaUrl;
  try {
    inputUrl = await resolveBestHlsUrl(opts.mediaUrl, {
      cookieString: opts.cookieString,
      proxyUrl: opts.proxyUrl,
      referer: opts.referer,
      userAgent: opts.userAgent,
    });
    if (inputUrl !== opts.mediaUrl) {
      console.log(`[AudioCapture] Using derived HLS URL: ${inputUrl.slice(0, 180)}...`);
    }
  } catch {
    // ignore; use original
  }

  const ffmpegs = await resolveFfmpegBinaries();
  let lastErr: unknown = null;

  for (const ffmpeg of ffmpegs) {
    const filename = `audio_${Date.now()}.wav`;
    const audioPath = path.join(opts.tmpDir, filename);

    const ffmpegArgs: string[] = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
    ];

    // For HLS/HTTP, Rumble often requires browser-like headers.
    if (opts.userAgent) {
      ffmpegArgs.push("-user_agent", opts.userAgent);
    }
    const headers: string[] = [];
    if (opts.referer) headers.push(`Referer: ${opts.referer}`);
    // Start conservative: avoid huge cookie headers unless needed.
    // (Some ffmpeg builds can behave badly with long headers.)
    if (opts.cookieString && inputUrl.includes("rumble.com/")) {
      headers.push(`Cookie: ${opts.cookieString}`);
    }
    if (headers.length > 0) {
      // ffmpeg expects CRLF-separated headers and a trailing CRLF.
      ffmpegArgs.push("-headers", `${headers.join("\r\n")}\r\n`);
    }
    // Best-effort: proxy for HTTP fetches (works on many ffmpeg builds).
    if (opts.proxyUrl) {
      ffmpegArgs.push("-http_proxy", opts.proxyUrl);
    }

    ffmpegArgs.push(
      "-i",
      inputUrl,
      "-t",
      String(opts.duration),
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "wav",
      audioPath
    );

    console.log(
      `[AudioCapture] Running ffmpeg (${ffmpeg.name}) for ${opts.duration}s`
    );

    try {
      await execFile(ffmpeg.path, ffmpegArgs, {
        timeoutMs: (opts.duration + 45) * 1000,
      });

      if (!existsSync(audioPath)) {
        throw new Error("ffmpeg finished but no audio file was created");
      }

      return { audioPath };
    } catch (err) {
      lastErr = err;
      console.warn(
        `[AudioCapture] ffmpeg (${ffmpeg.name}) failed, trying next if available: ${formatUnknownError(err)}`
      );
      // best effort cleanup of failed output
      try {
        if (existsSync(audioPath)) {
          await rm(audioPath, { force: true });
        }
      } catch {
        // ignore
      }
      continue;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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

    // If we don't have a media URL from the browser and it's Rumble, try embed endpoints first (bypasses CF better than yt-dlp).
    if (!mediaUrl && /rumble\.com/i.test(streamUrl)) {
      const embedM3u8 = await tryResolveRumbleM3u8ViaEmbedEndpoints({
        streamUrl,
        cookieString,
        proxyUrl,
      });
      if (embedM3u8) {
        mediaUrl = embedM3u8;
        console.log(`[AudioCapture] Resolved media URL via embedJS: ${mediaUrl.slice(0, 160)}...`);
      }
    }

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
      referer: streamUrl,
      userAgent,
      cookieString,
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
