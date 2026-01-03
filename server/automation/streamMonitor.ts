/**
 * Stream Monitor Service
 * 
 * Monitors a live stream and automatically generates + posts AI comments
 * Uses Puppeteer to capture screenshots for visual context
 */

import { chromium, Browser, Page } from 'playwright';
import { generateAIComment, analyzeScreenshot, CommentStyle } from './aiCommentGenerator';
import { postRumbleCommentDirect } from './directRumbleAPI';
import { createJob, getAccountsByUserId, getVideosByUserId, createLog } from '../db';

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
  
  // Audio settings (optional - from frontend)
  audioEnabled: boolean;
  
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
  lastComment?: string;
  lastCommentTime?: Date;
  commentsPosted: number;
  errors: string[];
  currentAccountIndex: number;
  previousComments: string[];
}

// Active monitor sessions
const activeSessions = new Map<string, MonitorSession>();

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
    
    // Navigate to stream
    console.log(`[StreamMonitor] Navigating to ${config.streamUrl}`);
    await page.goto(config.streamUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    session.page = page;
    session.status = 'running';
    
    // Start the comment generation loop
    const intervalMs = config.commentInterval * 1000;
    session.intervalId = setInterval(() => {
      generateAndPostComment(session).catch(err => {
        console.error(`[StreamMonitor] Error in comment loop:`, err);
        session.errors.push(err.message);
      });
    }, intervalMs);
    
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
  
  const { config } = session;
  
  try {
    console.log(`[StreamMonitor] Generating comment for session ${session.id}`);
    
    // Capture screenshot
    let screenImageBase64: string | undefined;
    let screenDescription: string | undefined;
    
    try {
      const screenshot = await session.page.screenshot({ 
        type: 'jpeg', 
        quality: 60,
      });
      screenImageBase64 = screenshot.toString('base64');
      
      // Analyze the screenshot
      screenDescription = await analyzeScreenshot(screenImageBase64);
      console.log(`[StreamMonitor] Screen analysis: ${screenDescription}`);
    } catch (err) {
      console.error(`[StreamMonitor] Screenshot failed:`, err);
    }
    
    // Generate AI comment
    const result = await generateAIComment({
      screenImageBase64,
      screenDescription,
      platform: config.platform,
      style: config.commentStyle,
      maxLength: config.maxCommentLength,
      includeEmojis: config.includeEmojis,
      previousComments: session.previousComments.slice(-5), // Last 5 comments
    });
    
    console.log(`[StreamMonitor] Generated comment: "${result.comment}" (confidence: ${result.confidence})`);
    
    // Only post if confidence is high enough
    if (result.confidence < 0.5) {
      console.log(`[StreamMonitor] Skipping low-confidence comment`);
      return;
    }
    
    // Get the next account to use
    const accounts = await getAccountsByUserId(config.userId);
    const availableAccounts = accounts.filter(a => 
      config.accountIds.includes(a.id) && 
      a.platform === config.platform &&
      a.isActive === 1
    );
    
    if (availableAccounts.length === 0) {
      throw new Error('No active accounts available for posting');
    }
    
    // Rotate through accounts
    const account = availableAccounts[session.currentAccountIndex % availableAccounts.length];
    session.currentAccountIndex++;
    
    // Post the comment
    if (config.platform === 'rumble') {
      await postRumbleCommentDirect(config.chatId, result.comment, account.cookies);
      console.log(`[StreamMonitor] Posted comment via account: ${account.accountName}`);
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
}): Promise<{ comment: string; confidence: number; reasoning?: string; screenDescription?: string }> {
  let browser: Browser | null = null;
  
  try {
    // Launch browser to capture screenshot
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(params.streamUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Capture and analyze screenshot
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 60 });
    const screenImageBase64 = screenshot.toString('base64');
    const screenDescription = await analyzeScreenshot(screenImageBase64);
    
    // Generate comment
    const result = await generateAIComment({
      screenImageBase64,
      screenDescription,
      platform: params.platform,
      style: params.style,
      maxLength: params.maxLength,
      includeEmojis: params.includeEmojis,
    });
    
    return {
      ...result,
      screenDescription,
    };
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
