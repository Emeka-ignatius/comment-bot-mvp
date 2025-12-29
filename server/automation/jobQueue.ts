import { updateJob, createLog, getJobsByUserId, getPendingJobs } from '../db';
import { submitYouTubeComment as submitYouTubeCommentReal } from './youtube';
import { submitRumbleComment as submitRumbleCommentReal } from './rumble';
import { submitYouTubeComment as submitYouTubeCommentMock } from './mockYoutube';
import { submitRumbleComment as submitRumbleCommentMock } from './mockRumble';
import { getDb } from '../db';
import { ENV } from '../_core/env';
import { eq } from 'drizzle-orm';
import { jobs, videos, accounts, commentTemplates } from '../../drizzle/schema';
import browserAutomation from './browser';
import mockBrowserAutomation from './mockBrowser';

interface JobExecutionContext {
  jobId: number;
  userId: number;
  videoId: number;
  accountId: number;
  commentTemplateId: number;
}

let isProcessing = false;

export async function startJobQueue() {
  console.log(`[JobQueue] Starting job processor (${ENV.mockMode ? 'MOCK MODE' : 'REAL MODE'})`);
  processNextJob();
}

async function processNextJob() {
  if (isProcessing) {
    console.log('[JobQueue] Already processing a job, skipping');
    return;
  }

  try {
    isProcessing = true;

    const db = await getDb();
    if (!db) {
      console.error('[JobQueue] Database not available');
      isProcessing = false;
      setTimeout(processNextJob, 5000);
      return;
    }

    // Get the next pending job
    const pendingJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, 'pending'))
      .limit(1);

    if (pendingJobs.length === 0) {
      console.log('[JobQueue] No pending jobs');
      isProcessing = false;
      setTimeout(processNextJob, 5000);
      return;
    }

    const job = pendingJobs[0];
    console.log('[JobQueue] Processing job:', job.id);

    await executeJob({
      jobId: job.id,
      userId: job.userId,
      videoId: job.videoId,
      accountId: job.accountId,
      commentTemplateId: job.commentTemplateId,
    });
  } catch (error) {
    console.error('[JobQueue] Error processing job:', error);
  } finally {
    isProcessing = false;
    // Schedule next job processing after a delay
    setTimeout(processNextJob, 3000);
  }
}

async function executeJob(context: JobExecutionContext) {
  const { jobId, userId, videoId, accountId, commentTemplateId } = context;

  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    // Update job status to running
    await updateJob(jobId, {
      status: 'running',
      startedAt: new Date(),
    });

    // Fetch video, account, and comment template
    const [videoData] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const [accountData] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    const [commentData] = await db.select().from(commentTemplates).where(eq(commentTemplates.id, commentTemplateId)).limit(1);

    if (!videoData || !accountData || !commentData) {
      throw new Error('Missing video, account, or comment template data');
    }

    // Use mock or real browser based on environment
    const browser = ENV.mockMode ? mockBrowserAutomation : browserAutomation;

    // Initialize browser
    await browser.initialize({ headless: true });

    // Create a new page
    const page = await browser.createPage();

    // Inject cookies - handle both raw strings and JSON
    let cookies: string | Record<string, string>;
    try {
      cookies = JSON.parse(accountData.cookies);
    } catch (e) {
      // If not valid JSON, treat as raw cookie string
      cookies = accountData.cookies;
    }
    
    await browser.injectCookies(page, cookies, videoData.platform as 'youtube' | 'rumble');

    // Select submission function based on mode and platform
    const submitYouTubeComment = ENV.mockMode ? submitYouTubeCommentMock : submitYouTubeCommentReal;
    const submitRumbleComment = ENV.mockMode ? submitRumbleCommentMock : submitRumbleCommentReal;

    // Submit comment based on platform
    let result;
    if (videoData.platform === 'youtube') {
      result = await submitYouTubeComment(page, {
        videoUrl: videoData.videoUrl,
        comment: commentData.content,
        cookies: typeof cookies === 'string' ? cookies : JSON.stringify(cookies),
      });
    } else if (videoData.platform === 'rumble') {
      result = await submitRumbleComment(page, {
        videoUrl: videoData.videoUrl,
        comment: commentData.content,
        cookies: typeof cookies === 'string' ? cookies : JSON.stringify(cookies),
      });
    } else {
      throw new Error(`Unsupported platform: ${videoData.platform}`);
    }

    // Close browser
    await browser.close();

    // Update job status based on result
    if (result.success) {
      await updateJob(jobId, {
        status: 'completed',
        completedAt: new Date(),
      });

      await createLog({
        userId,
        jobId,
        platform: videoData.platform,
        status: 'success',
        message: result.message,
      });

      console.log('[JobQueue] Job completed successfully:', jobId);
    } else {
      await updateJob(jobId, {
        status: 'failed',
        errorMessage: result.message,
        completedAt: new Date(),
      });

      await createLog({
        userId,
        jobId,
        platform: videoData.platform,
        status: 'failed',
        message: result.message,
        errorDetails: result.message,
      });

      console.error('[JobQueue] Job failed:', jobId, result.message);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateJob(jobId, {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    });

    await createLog({
      userId,
      jobId,
      platform: 'youtube', // Default to youtube for error logging
      status: 'failed',
      message: 'Job execution error',
      errorDetails: errorMessage,
    });

    console.error('[JobQueue] Job execution error:', jobId, errorMessage);

    // Close browser in case of error
    try {
      const browser = ENV.mockMode ? mockBrowserAutomation : browserAutomation;
      await browser.close();
    } catch (e) {
      console.error('[JobQueue] Error closing browser:', e);
    }
  }
}

export function stopJobQueue() {
  console.log('[JobQueue] Stopping job processor');
  isProcessing = false;
}
