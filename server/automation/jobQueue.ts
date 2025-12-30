import { updateJob, createLog, incrementAccountJobStats } from '../db';
import { getDb } from '../db';
import { ENV } from '../_core/env';
import { eq } from 'drizzle-orm';
import { jobs, videos, accounts, commentTemplates } from '../../drizzle/schema';

// Import real and mock automation
import { postRumbleComment } from './realRumble';
import { postRumbleCommentDirect, extractChatIdFromUrl } from './directRumbleAPI';
import { submitRumbleComment as submitRumbleCommentMock } from './mockRumble';
import { submitYouTubeComment as submitYouTubeCommentMock } from './mockYoutube';

interface JobExecutionContext {
  jobId: number;
  userId: number;
  videoId: number;
  accountId: number;
  commentTemplateId: number;
}

let isProcessing = false;
let isRunning = false;
let processingStartTime: number | null = null;
const JOB_TIMEOUT_MS = 120000; // 2 minutes max per job

export async function startJobQueue() {
  if (isRunning) {
    console.log('[JobQueue] Already running');
    return;
  }
  
  isRunning = true;
  isProcessing = false; // Reset processing state on start
  processingStartTime = null;
  
  console.log(`[JobQueue] Starting job processor (${ENV.mockMode ? 'MOCK MODE' : 'REAL MODE'})`);
  console.log(`[JobQueue] Mock mode env value: ${process.env.MOCK_AUTOMATION}`);
  processNextJob();
}

async function processNextJob() {
  if (!isRunning) {
    console.log('[JobQueue] Job queue stopped');
    return;
  }
  
  // Check for stuck job (timeout)
  if (isProcessing && processingStartTime) {
    const elapsed = Date.now() - processingStartTime;
    if (elapsed > JOB_TIMEOUT_MS) {
      console.error(`[JobQueue] Job timed out after ${elapsed}ms, resetting state`);
      isProcessing = false;
      processingStartTime = null;
    }
  }
  
  if (isProcessing) {
    setTimeout(processNextJob, 3000);
    return;
  }

  try {
    isProcessing = true;
    processingStartTime = Date.now();

    const db = await getDb();
    if (!db) {
      console.error('[JobQueue] Database not available');
      isProcessing = false;
      processingStartTime = null;
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
      isProcessing = false;
      processingStartTime = null;
      setTimeout(processNextJob, 5000);
      return;
    }

    const job = pendingJobs[0];
    const now = new Date();
    
    // Check if job is scheduled for later
    if (job.scheduledAt && new Date(job.scheduledAt) > now) {
      console.log(`[JobQueue] Job ${job.id} scheduled for ${job.scheduledAt}, skipping`);
      isProcessing = false;
      processingStartTime = null;
      setTimeout(processNextJob, 5000);
      return;
    }
    
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
    processingStartTime = null;
    setTimeout(processNextJob, 3000);
  }
}

async function executeJob(context: JobExecutionContext) {
  const { jobId, userId, videoId, accountId, commentTemplateId } = context;

  try {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    await updateJob(jobId, { status: 'running', startedAt: new Date() });

    const [videoData] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    const [accountData] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    const [commentData] = await db.select().from(commentTemplates).where(eq(commentTemplates.id, commentTemplateId)).limit(1);

    if (!videoData || !accountData || !commentData) {
      throw new Error('Missing video, account, or comment template data');
    }

    console.log(`[JobQueue] Executing job ${jobId}:`);
    console.log(`  - Platform: ${videoData.platform}`);
    console.log(`  - Video: ${videoData.videoUrl}`);
    console.log(`  - Account: ${accountData.accountName}`);
    console.log(`  - Comment: ${commentData.content.substring(0, 50)}...`);
    console.log(`  - Mock Mode: ${ENV.mockMode}`);

    let result: { success: boolean; message: string; isLive?: boolean };

    if (ENV.mockMode) {
      console.log('[JobQueue] Using MOCK automation');
      
      if (videoData.platform === 'youtube') {
        result = await submitYouTubeCommentMock(null as any, {
          videoUrl: videoData.videoUrl,
          comment: commentData.content,
          cookies: accountData.cookies,
        });
      } else if (videoData.platform === 'rumble') {
        result = await submitRumbleCommentMock(null as any, {
          videoUrl: videoData.videoUrl,
          comment: commentData.content,
          cookies: accountData.cookies,
        });
      } else {
        throw new Error(`Unsupported platform: ${videoData.platform}`);
      }
     } else {
      console.log('[JobQueue] Using REAL automation (Direct API)');
      
      if (videoData.platform === 'rumble') {
        // Extract chat ID from video URL
        const chatId = extractChatIdFromUrl(videoData.videoUrl);
        if (!chatId) {
          throw new Error('Could not extract chat ID from video URL');
        }
        
        console.log(`[JobQueue] Using Direct Rumble API with chat ID: ${chatId}`);
        
        const rumbleResult = await postRumbleCommentDirect(
          chatId,
          commentData.content,
          accountData.cookies
        );
        
        console.log('[JobQueue] postRumbleComment result:', rumbleResult);
        
        result = {
          success: rumbleResult.success,
          message: rumbleResult.success 
            ? `Comment posted successfully on Rumble (direct API)`
            : `Failed to post comment: ${rumbleResult.error}`,
        };
      } else {
        throw new Error(`Unsupported platform: ${videoData.platform}`);
      }
    }

    if (result.success) {
      await updateJob(jobId, { status: 'completed', completedAt: new Date() });
      await createLog({ userId, jobId, platform: videoData.platform, status: 'success', message: result.message });
      await incrementAccountJobStats(accountId, true);
      console.log('[JobQueue] Job completed successfully:', jobId);
    } else {
      await updateJob(jobId, { status: 'failed', errorMessage: result.message, completedAt: new Date() });
      await createLog({ userId, jobId, platform: videoData.platform, status: 'failed', message: result.message, errorDetails: result.message });
      await incrementAccountJobStats(accountId, false);
      console.error('[JobQueue] Job failed:', jobId, result.message);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[JobQueue] Job execution error:', jobId, errorMessage);

    await updateJob(jobId, { status: 'failed', errorMessage, completedAt: new Date() });

    let platform: 'youtube' | 'rumble' = 'youtube';
    try {
      const db = await getDb();
      if (db) {
        const [videoData] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
        if (videoData) platform = videoData.platform;
      }
    } catch {}

    await createLog({ userId, jobId, platform, status: 'failed', message: 'Job execution error', errorDetails: errorMessage });
  }
}

export function stopJobQueue() {
  console.log('[JobQueue] Stopping job processor');
  isRunning = false;
  isProcessing = false;
  processingStartTime = null;
}
