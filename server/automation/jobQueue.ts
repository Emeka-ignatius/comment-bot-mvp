import { updateJob, createLog, getJobsByUserId, getPendingJobs } from '../db';
import browserAutomation from './browser';
import { submitYouTubeComment } from './youtube';
import { submitRumbleComment } from './rumble';
import { getDb } from '../db';
import { eq } from 'drizzle-orm';
import { jobs, videos, accounts, commentTemplates } from '../../drizzle/schema';

interface JobExecutionContext {
  jobId: number;
  userId: number;
  videoId: number;
  accountId: number;
  commentTemplateId: number;
}

let isProcessing = false;

export async function startJobQueue() {
  console.log('[JobQueue] Starting job processor');
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

    // Initialize browser
    await browserAutomation.initialize({ headless: true });

    // Create a new page
    const page = await browserAutomation.createPage();

    // Inject cookies
    const cookies = JSON.parse(accountData.cookies);
    await browserAutomation.injectCookies(page, cookies);

    // Submit comment based on platform
    let result;
    if (videoData.platform === 'youtube') {
      result = await submitYouTubeComment(page, {
        videoUrl: videoData.videoUrl,
        comment: commentData.content,
        cookies,
      });
    } else if (videoData.platform === 'rumble') {
      result = await submitRumbleComment(page, {
        videoUrl: videoData.videoUrl,
        comment: commentData.content,
        cookies,
      });
    } else {
      throw new Error(`Unsupported platform: ${videoData.platform}`);
    }

    // Close browser
    await browserAutomation.close();

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
      await browserAutomation.close();
    } catch (e) {
      console.error('[JobQueue] Error closing browser:', e);
    }
  }
}

export function stopJobQueue() {
  console.log('[JobQueue] Stopping job processor');
  isProcessing = false;
}
