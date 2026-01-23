/**
 * Stream Monitor Service
 * 
 * Monitors a live stream and automatically generates + posts AI comments
 * Uses Puppeteer to capture screenshots for visual context
 */

import { chromium, Browser, Page } from 'playwright';
import { generateAIComment, CommentStyle } from './aiCommentGenerator';
import { postRumbleCommentDirect } from './directRumbleAPI';
import { createJob, getAccountsByUserId, getVideosByUserId, createLog } from '../db';
import { captureStreamAudio, capturePageContextAudio } from './audioCapture';
import { transcribeStreamAudio, detectCallToAction, summarizeTranscript } from './audioTranscriber';
import { getIProyalProxyUrlForAccount } from "./iproyal";

export interface StreamMonitorConfig {
  videoId: number;                    // Video ID from database
  userId: number;                     // User who owns this monitor
  platform: 'youtube' | 'rumble';
  streamUrl: string;
  chatId: string;                     // Chat ID for posting comments
  
  // AI settings
  commentStyle: CommentStyle;
  commentInterval: number;            // Seconds between comments (e.g., 60-120)
  includeEmojis: boolean;
  maxCommentLength: number;
  
  // Audio settings
  audioEnabled: boolean;
  audioInterval: number;              // Seconds between audio captures (e.g., 30)
  
  // Account rotation
  accountIds: number[];               // Account IDs to rotate through
}

export interface MonitorSession {
  id: string;
  config: StreamMonitorConfig;
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'error';
  browser?: Browser;
  page?: Page;
  intervalId?: NodeJS.Timeout;
  audioIntervalId?: NodeJS.Timeout;
  audioCaptureInProgress?: boolean;
  commentInProgress?: boolean;
  lastPostAccountId?: number;
  lastMediaUrl?: string;
  lastMediaUrlTime?: Date;
  lastComment?: string;
  lastCommentTime?: Date;
  lastAudioTranscript?: string;
  lastAudioTime?: Date;
  commentsPosted: number;
  errors: string[];
  currentAccountIndex: number;
  previousComments: string[];
}

// Active monitor sessions
const activeSessions = new Map<string, MonitorSession>();

function pickBestMediaUrl(urls: string[]): string | undefined {
  const cleaned = urls
    .map(u => u.trim())
    .filter(Boolean)
    .filter(u => u.startsWith("http"))
    .filter(u => !u.includes("hls.js"))
    .filter(u => !u.includes("challenges.cloudflare.com"))
    .filter(u => !u.includes("turnstile"))
    .filter(u => !u.endsWith(".js"))
    // Only accept real manifests/chunklists (avoid generic "hls" matches and scripts).
    .filter(u => u.includes(".m3u8") || u.includes(".mpd") || u.includes("chunklist"));
  if (cleaned.length === 0) return undefined;

  const score = (u: string) => {
    let s = 0;
    if (u.includes(".m3u8")) s += 50;
    if (u.includes("chunklist")) s += 20;
    if (u.includes("playlist.m3u8")) s += 15;
    if (u.includes("live-hls")) s += 10;
    if (u.includes("dvr")) s += 5;
    // Prefer non-rumble CDN URLs if present (often direct playlist/chunklist).
    if (!u.includes("rumble.com/")) s += 3;
    // Slight preference for longer URLs (often includes tokens/params).
    s += Math.min(10, Math.floor(u.length / 80));
    return s;
  };

  return cleaned.sort((a, b) => score(b) - score(a))[0];
}

async function warmUpMediaUrl(session: MonitorSession): Promise<void> {
  const page = session.page;
  if (!page) return;

  // If we already have a recent URL, keep it.
  if (session.lastMediaUrl && session.lastMediaUrlTime) {
    const age = Date.now() - session.lastMediaUrlTime.getTime();
    if (age < 5 * 60_000) return;
  }

  try {
    // Try to start playback (muted autoplay) so the player actually requests the manifest on headless browsers.
    await page.evaluate(() => {
      try {
        const v = document.querySelector("video") as HTMLVideoElement | null;
        if (v) {
          v.muted = true;
          v.play().catch(() => {});
        }
        const selectors = [
          'button[aria-label*="play" i]',
          'button[title*="play" i]',
          'button[class*="play" i]',
          'div[class*="play" i]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el) {
            el.click();
            break;
          }
        }

        // Common consent/age gates: best-effort click.
        const gateSelectors = [
          'button:has-text("I Agree")',
          'button:has-text("Accept")',
          'button:has-text("Continue")',
          'button[aria-label*="accept" i]',
          'button[aria-label*="continue" i]',
        ];
        // NOTE: :has-text is not supported in querySelector; keep only simple ones.
        for (const sel of gateSelectors.filter(s => !s.includes(":has-text"))) {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (el) {
            el.click();
            break;
          }
        }
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }

  // Give the page a moment to request manifests.
  try {
    await page.waitForTimeout(2500);
  } catch {
    // ignore
  }

  if (session.lastMediaUrl) return;

  // Fallback: ask the browser for resource URLs it has already fetched.
  try {
    const perfUrls = await page.evaluate(() => {
      try {
        // Some browsers restrict Performance entries; best-effort.
        const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        return entries.map(e => (e as any).name).filter(Boolean) as string[];
      } catch {
        return [] as string[];
      }
    });
    const bestPerf = pickBestMediaUrl(perfUrls);
    if (bestPerf) {
      session.lastMediaUrl = bestPerf;
      session.lastMediaUrlTime = new Date();
      console.log(`[StreamMonitor] Detected media URL via performance entries: ${bestPerf.slice(0, 180)}...`);
      return;
    }
  } catch {
    // ignore
  }

  // Fallback: scrape common Rumble player globals for playlist URLs.
  try {
    const globalUrls = await page.evaluate(() => {
      const out: string[] = [];
      const pushAny = (v: any) => {
        if (!v) return;
        if (typeof v === "string") {
          if (v.includes(".m3u8") || v.includes("chunklist")) out.push(v);
          return;
        }
        if (Array.isArray(v)) {
          for (const x of v) pushAny(x);
          return;
        }
        if (typeof v === "object") {
          for (const k of Object.keys(v)) pushAny((v as any)[k]);
        }
      };
      try {
        // @ts-ignore
        pushAny((window as any).Rumble);
        // @ts-ignore
        pushAny((window as any).__INITIAL_STATE__);
        // @ts-ignore
        pushAny((window as any).__NEXT_DATA__);
      } catch {
        // ignore
      }
      return out;
    });
    const bestGlobal = pickBestMediaUrl(globalUrls);
    if (bestGlobal) {
      session.lastMediaUrl = bestGlobal;
      session.lastMediaUrlTime = new Date();
      console.log(`[StreamMonitor] Detected media URL via page globals: ${bestGlobal.slice(0, 180)}...`);
      return;
    }
  } catch {
    // ignore
  }

  // Fallback: scrape the page HTML for any .m3u8 URLs.
  try {
    const html = await page.content();
    const matches = html.match(/https?:\/\/[^"'\\s]+\.m3u8[^"'\\s]*/g) || [];
    const best = pickBestMediaUrl(matches);
    if (best) {
      session.lastMediaUrl = best;
      session.lastMediaUrlTime = new Date();
      console.log(`[StreamMonitor] Detected media URL via HTML scan: ${best.slice(0, 180)}...`);
    }
  } catch {
    // ignore
  }
}

/**
 * Start monitoring a stream
 */
export async function startStreamMonitor(config: StreamMonitorConfig): Promise<string> {
  const sessionId = `monitor_${config.videoId}_${Date.now()}`;
  
  const session: MonitorSession = {
    id: sessionId,
    config,
    status: 'starting',
    commentsPosted: 0,
    errors: [],
    currentAccountIndex: 0,
    previousComments: [],
  };
  
  activeSessions.set(sessionId, session);
  
  try {
    // Launch browser for screenshot capture
    console.log(`[StreamMonitor] Starting session ${sessionId} for ${config.streamUrl}`);
    
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    
    session.browser = browser;
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    // Capture HLS/DASH media URLs from the page network so we can avoid yt-dlp (often blocked by CF).
    // Use multiple events because some environments may not surface all requests on a single hook.
    const maybeCaptureMediaUrl = (url: string) => {
      try {
        if (!url || !url.startsWith("http")) return;
        // Never treat Cloudflare assets as media.
        if (url.includes("challenges.cloudflare.com") || url.includes("turnstile")) return;
        if (url.endsWith(".js")) return;
        const isManifest =
          url.includes(".m3u8") ||
          url.includes(".mpd") ||
          url.includes("chunklist") ||
          url.includes("playlist.m3u8");
        if (!isManifest) return;
        const shouldReplace =
          !session.lastMediaUrl ||
          (url.includes(".m3u8") && !session.lastMediaUrl.includes(".m3u8")) ||
          (session.lastMediaUrlTime
            ? Date.now() - session.lastMediaUrlTime.getTime() > 60_000
            : true);
        if (!shouldReplace) return;
        session.lastMediaUrl = url;
        session.lastMediaUrlTime = new Date();
        console.log(`[StreamMonitor] Detected media URL: ${url.slice(0, 180)}...`);
      } catch {
        // ignore
      }
    };

    page.on("request", req => maybeCaptureMediaUrl(req.url()));
    page.on("requestfinished", req => maybeCaptureMediaUrl(req.url()));
    page.on("response", res => maybeCaptureMediaUrl(res.url()));
    
    // Navigate to stream
    console.log(`[StreamMonitor] Navigating to ${config.streamUrl}`);
    try {
      await page.goto(config.streamUrl, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (navError) {
      // If networkidle times out, try with domcontentloaded instead
      console.warn(`[StreamMonitor] Network idle timeout, trying with domcontentloaded`);
      await page.goto(config.streamUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    
    // Check if page loaded successfully
    const pageTitle = await page.title();
    if (pageTitle.includes('404') || pageTitle.includes('Not Found')) {
      throw new Error('Stream not found or has ended. Please add a new live stream URL.');
    }
    
    session.page = page;
    session.status = 'running';

    // Best-effort: warm up the media URL early so the first audio capture doesn't fall back to yt-dlp.
    warmUpMediaUrl(session).catch(err => {
      console.warn("[StreamMonitor] Media URL warmup failed:", err);
    });
    
    // Start the comment generation loop
    const intervalMs = config.commentInterval * 1000;
    session.intervalId = setInterval(() => {
      generateAndPostComment(session).catch(err => {
        console.error(`[StreamMonitor] Error in comment loop:`, err);
        session.errors.push(err.message);
      });
    }, intervalMs);
    
    // Start audio capture loop if enabled
    if (config.audioEnabled) {
      const audioIntervalMs = config.audioInterval * 1000;
      session.audioIntervalId = setInterval(() => {
        captureAndTranscribeAudio(session).catch(err => {
          console.error(`[StreamMonitor] Error in audio capture:`, err);
          // Don't add to errors array - audio is optional
        });
      }, audioIntervalMs);
      console.log(`[StreamMonitor] Audio capture started (every ${config.audioInterval}s)`);
    }
    
    // Generate first comment immediately
    setTimeout(() => {
      generateAndPostComment(session).catch(err => {
        console.error(`[StreamMonitor] Error in first comment:`, err);
        session.errors.push(err.message);
      });
    }, 5000); // Wait 5 seconds for page to fully load
    
    console.log(`[StreamMonitor] Session ${sessionId} started successfully`);
    return sessionId;
    
  } catch (error) {
    session.status = 'error';
    session.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error(`[StreamMonitor] Failed to start session:`, error);
    throw error;
  }
}

/**
 * Generate and post a comment for the session
 */
async function generateAndPostComment(session: MonitorSession): Promise<void> {
  if (session.status !== 'running' || !session.page) {
    return;
  }

  // Prevent overlapping comment generations (can cause screenshot timeouts).
  if (session.commentInProgress) return;
  session.commentInProgress = true;
  
  const { config } = session;
  
  try {
    console.log(`[StreamMonitor] Generating comment for session ${session.id}`);
    
    // Capture screenshot
    let screenImageBase64: string | undefined;
    
    try {
      const screenshot = await session.page.screenshot({ 
        type: 'jpeg', 
        quality: 60,
        timeout: 60000,
      });
      screenImageBase64 = screenshot.toString('base64');
      
      // Pass screenshot directly to AI for analysis
      console.log(`[StreamMonitor] Screenshot captured, will be analyzed by AI`);
    } catch (err) {
      console.error(`[StreamMonitor] Screenshot failed:`, err);
      // Retry once with a quick reload and a shorter wait (best effort).
      try {
        await session.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        const screenshot = await session.page.screenshot({
          type: 'jpeg',
          quality: 55,
          timeout: 60000,
        });
        screenImageBase64 = screenshot.toString('base64');
        console.log(`[StreamMonitor] Screenshot captured on retry, will be analyzed by AI`);
      } catch (retryErr) {
        console.error(`[StreamMonitor] Screenshot retry failed:`, retryErr);
      }
    }
    
    // Get recent audio transcript if available
    let audioTranscript: string | undefined;
    if (config.audioEnabled && session.lastAudioTranscript) {
      audioTranscript = summarizeTranscript(session.lastAudioTranscript, 300);
      console.log(`[StreamMonitor] Using audio context: ${audioTranscript.slice(0, 50)}...`);
    }
    
    // Generate AI comment with both visual and audio context
    const result = await generateAIComment({
      screenImageBase64,
      audioTranscript,
      platform: config.platform,
      style: config.commentStyle,
      maxLength: config.maxCommentLength,
      includeEmojis: config.includeEmojis,
      previousComments: session.previousComments.slice(-5), // Last 5 comments
    });
    
    console.log(`[StreamMonitor] Generated comment: "${result.comment}" (confidence: ${(result.confidence * 100).toFixed(0)}%, reasoning: ${result.reasoning})`);
    
    // Only post if confidence is high enough (0.6 = 60% confidence threshold)
    const CONFIDENCE_THRESHOLD = 0.6;
    if (result.confidence < CONFIDENCE_THRESHOLD) {
      console.log(`[StreamMonitor] Skipping low-confidence comment (${(result.confidence * 100).toFixed(0)}% < ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%)`);
      return;
    }
    
    // Get the next account to use
    const accounts = await getAccountsByUserId(config.userId);
    const availableAccounts = accounts.filter(a => 
      config.accountIds.includes(a.id) && 
      a.platform === config.platform &&
      a.isActive === true
    );
    
    if (availableAccounts.length === 0) {
      throw new Error('No active accounts available for posting');
    }
    
    // Rotate through accounts
    const account = availableAccounts[session.currentAccountIndex % availableAccounts.length];
    session.currentAccountIndex++;
    
    // Post the comment
    if (config.platform === 'rumble') {
      const proxyUrl =
        account.proxy || getIProyalProxyUrlForAccount(account.id) || undefined;
      await postRumbleCommentDirect(
        config.chatId,
        result.comment,
        account.cookies,
        proxyUrl
      );
      session.lastPostAccountId = account.id;
      console.log(
        `[StreamMonitor] Posted comment via account: ${account.accountName}${
          proxyUrl ? " (using proxy)" : ""
        }`
      );
    } else {
      // YouTube posting would go here
      console.log(`[StreamMonitor] YouTube posting not yet implemented`);
    }
    
    // Track the comment
    session.previousComments.push(result.comment);
    session.lastComment = result.comment;
    session.lastCommentTime = new Date();
    session.commentsPosted++;
    
    // Log the successful post
    await createLog({
      userId: config.userId,
      jobId: null, // AI-generated, not from a job
      accountId: account.id,
      videoId: config.videoId,
      platform: config.platform,
      action: 'ai_comment',
      status: 'success',
      message: `AI comment posted: "${result.comment.slice(0, 50)}..."`,
      metadata: JSON.stringify({
        confidence: result.confidence,
        reasoning: result.reasoning,
        sessionId: session.id,
      }),
    });
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[StreamMonitor] Failed to generate/post comment:`, error);
    session.errors.push(errorMsg);
    
    // Log the error
    await createLog({
      userId: config.userId,
      jobId: null,
      accountId: null,
      videoId: config.videoId,
      platform: config.platform,
      action: 'ai_comment',
      status: 'failed',
      message: `AI comment failed: ${errorMsg}`,
      metadata: JSON.stringify({ sessionId: session.id }),
    });
  }
  finally {
    session.commentInProgress = false;
  }
}

/**
 * Stop a monitoring session
 */
export async function stopStreamMonitor(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  console.log(`[StreamMonitor] Stopping session ${sessionId}`);
  
  session.status = 'stopped';
  
  if (session.intervalId) {
    clearInterval(session.intervalId);
  }
  
  if (session.audioIntervalId) {
    clearInterval(session.audioIntervalId);
  }
  
  if (session.browser) {
    await session.browser.close();
  }
  
  activeSessions.delete(sessionId);
  console.log(`[StreamMonitor] Session ${sessionId} stopped`);
}

/**
 * Pause a monitoring session
 */
export function pauseStreamMonitor(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  session.status = 'paused';
  if (session.intervalId) {
    clearInterval(session.intervalId);
    session.intervalId = undefined;
  }
  
  if (session.audioIntervalId) {
    clearInterval(session.audioIntervalId);
    session.audioIntervalId = undefined;
  }
  
  console.log(`[StreamMonitor] Session ${sessionId} paused`);
}

/**
 * Resume a paused session
 */
export function resumeStreamMonitor(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== 'paused') {
    throw new Error(`Session ${sessionId} not found or not paused`);
  }
  
  session.status = 'running';
  const intervalMs = session.config.commentInterval * 1000;
  session.intervalId = setInterval(() => {
    generateAndPostComment(session).catch(err => {
      console.error(`[StreamMonitor] Error in comment loop:`, err);
      session.errors.push(err.message);
    });
  }, intervalMs);
  
  // Resume audio capture if enabled
  if (session.config.audioEnabled && !session.audioIntervalId) {
    const audioIntervalMs = session.config.audioInterval * 1000;
    session.audioIntervalId = setInterval(() => {
      captureAndTranscribeAudio(session).catch(err => {
        console.error(`[StreamMonitor] Error in audio capture:`, err);
      });
    }, audioIntervalMs);
  }
  
  console.log(`[StreamMonitor] Session ${sessionId} resumed`);
}

/**
 * Get status of a monitoring session
 */
export function getMonitorStatus(sessionId: string): Omit<MonitorSession, 'browser' | 'page' | 'intervalId'> | null {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return null;
  }
  
  // Return session without browser/page objects
  const { browser, page, intervalId, ...status } = session;
  return status;
}

/**
 * Get all active sessions for a user
 */
export function getUserSessions(userId: number): Array<Omit<MonitorSession, 'browser' | 'page' | 'intervalId'>> {
  const userSessions: Array<Omit<MonitorSession, 'browser' | 'page' | 'intervalId'>> = [];
  
  for (const session of Array.from(activeSessions.values())) {
    if (session.config.userId === userId) {
      const { browser, page, intervalId, ...status } = session;
      userSessions.push(status);
    }
  }
  
  return userSessions;
}

/**
 * Generate a single AI comment without posting (for preview)
 */
export async function previewAIComment(params: {
  streamUrl: string;
  platform: 'youtube' | 'rumble';
  style: CommentStyle;
  includeEmojis: boolean;
  maxLength: number;
}): Promise<{ comment: string; confidence: number; reasoning?: string }> {
  let browser: Browser | null = null;
  
  try {
    // Launch browser to capture screenshot
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Try to navigate with fallback
    try {
      await page.goto(params.streamUrl, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (navError) {
      console.warn(`[Preview] Network idle timeout, trying with domcontentloaded`);
      try {
        await page.goto(params.streamUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch (fallbackError) {
        throw new Error('Stream is unavailable or has ended. Please try with a currently live stream.');
      }
    }
    
    // Check if page loaded successfully
    const pageTitle = await page.title();
    if (pageTitle.includes('404') || pageTitle.includes('Not Found')) {
      throw new Error('Stream not found or has ended. Please add a new live stream URL.');
    }
    
    // Capture and analyze screenshot
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
    const screenImageBase64 = screenshot.toString('base64');
    // Screenshot will be analyzed by AI during comment generation
    
    // Generate comment
    const result = await generateAIComment({
      screenImageBase64,
      platform: params.platform,
      style: params.style,
      maxLength: params.maxLength,
      includeEmojis: params.includeEmojis,
    });
    
    return result;
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}


/**
 * Capture and transcribe audio from a stream
 */
async function captureAndTranscribeAudio(session: MonitorSession): Promise<void> {
  if (session.status !== 'running' || !session.page) {
    return;
  }

  // Prevent overlapping audio captures (common on Windows and for slow streams).
  if (session.audioCaptureInProgress) {
    return;
  }
  session.audioCaptureInProgress = true;
  
  const { config } = session;
  
  try {
    console.log(`[StreamMonitor] Capturing audio for session ${session.id}`);

    // If we don't have a media URL on Render, try to force the player and/or scrape it.
    if (!session.lastMediaUrl) {
      await warmUpMediaUrl(session);
    }

    // Use an active account's cookies + proxy to help yt-dlp avoid 403/blocks.
    const accounts = await getAccountsByUserId(config.userId);
    const availableAccounts = accounts.filter(a =>
      config.accountIds.includes(a.id) &&
      a.platform === config.platform &&
      a.isActive === true
    );
    const preferred =
      (session.lastPostAccountId
        ? availableAccounts.find(a => a.id === session.lastPostAccountId)
        : undefined) || availableAccounts[0];
    const cookieString = preferred?.cookies;
    const proxyUrl =
      preferred?.proxy || (preferred ? getIProyalProxyUrlForAccount(preferred.id) : undefined);
    
    // Capture audio from the stream
    let audio:
      | { audioBuffer: Buffer; mimeType: string; filename?: string }
      | undefined;
    
    try {
      // If we already saw a media manifest URL in the browser, prefer that.
      const mediaUrl = session.lastMediaUrl;
      if (mediaUrl) {
        console.log(`[StreamMonitor] Using detected media URL for audio capture`);
      }

      // Try to capture audio using ffmpeg approach
      // Construct config in a way that avoids excess-property TS diagnostics in some environments.
      // Capture a shorter clip than the interval to reduce memory/CPU (especially on Render).
      const captureDuration = Math.min(config.audioInterval, 12);
      const captureCfg: any = {
        page: session.page,
        duration: captureDuration,
        streamUrl: config.streamUrl,
        cookieString,
        proxyUrl,
        userAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };
      if (mediaUrl) captureCfg.mediaUrl = mediaUrl;

      const audioResult = await captureStreamAudio(captureCfg);
      
      audio = {
        audioBuffer: audioResult.audioBuffer,
        mimeType: audioResult.mimeType,
        filename: audioResult.filename,
      };
      console.log(`[StreamMonitor] Audio captured: ${audioResult.fileSize} bytes (${audioResult.mimeType})`);
    } catch (err) {
      // Fallback: try to capture audio from page context
      console.warn(`[StreamMonitor] FFmpeg audio capture failed, trying page context:`, err);
      try {
        const audioResult = await capturePageContextAudio({
          page: session.page,
          duration: Math.min(config.audioInterval, 15), // Shorter capture for page context
          streamUrl: config.streamUrl,
        });
        audio = {
          audioBuffer: audioResult.audioBuffer,
          mimeType: audioResult.mimeType,
          filename: audioResult.filename,
        };
        console.log(
          `[StreamMonitor] Page context audio captured: ${audioResult.fileSize} bytes (${audioResult.mimeType})`
        );
      } catch (pageErr) {
        console.warn(`[StreamMonitor] Page context audio capture also failed:`, pageErr);
        return;
      }
    }
    
    if (!audio) {
      console.warn(`[StreamMonitor] No audio available`);
      return;
    }
    
    // Transcribe the audio
    const transcription = await transcribeStreamAudio(audio, {
      language: 'en',
      prompt: 'Transcribe what the streamer is saying',
    });
    
    if (!transcription || !transcription.text) {
      console.warn(`[StreamMonitor] No transcription result`);
      return;
    }
    
    console.log(`[StreamMonitor] Audio transcribed: "${transcription.text.slice(0, 100)}..."`);
    
    // Store the transcript for use in next comment generation
    session.lastAudioTranscript = transcription.text;
    session.lastAudioTime = new Date();
    
    // Detect call-to-action in the transcript
    const cta = detectCallToAction(transcription.text);
    if (cta) {
      console.log(`[StreamMonitor] Detected call-to-action: "${cta}"`);
    }
    
  } catch (error) {
    console.error(`[StreamMonitor] Failed to capture/transcribe audio:`, error);
    // Don't throw - audio is optional
  } finally {
    session.audioCaptureInProgress = false;
  }
}
