import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { batchJobsRouter } from "./routers/batchJobs";
import { z } from "zod";
import {
  getAccountsByUserId,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountHealth,
  updateAccountHealth,
  getVideosByUserId,
  createVideo,
  updateVideo,
  deleteVideo,
  getCommentTemplatesByUserId,
  createCommentTemplate,
  updateCommentTemplate,
  deleteCommentTemplate,
  getJobsByUserId,
  createJob,
  updateJob,
  deleteJob,
  getLogsByUserId,
  getLogsByJobId,
} from "./db";
import { postRumbleCommentDirect, extractChatIdFromUrl } from "./automation/directRumbleAPI";
import { initializeLoginSession, getSessionStatus, cancelLoginSession } from "./automation/embeddedLogin";
import { 
  startStreamMonitor, 
  stopStreamMonitor, 
  pauseStreamMonitor, 
  resumeStreamMonitor, 
  getMonitorStatus, 
  getUserSessions,
  previewAIComment,
} from "./automation/streamMonitor";
import { type CommentStyle } from "./automation/aiCommentGenerator";
import { generateAIComment } from "./automation/aiCommentGenerator";
import { transcribeStreamAudio, extractKeyPhrases, detectCallToAction } from "./automation/audioTranscriber";

export const appRouter = router({
  system: systemRouter,
  batch: batchJobsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  accounts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getAccountsByUserId(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      platform: z.enum(['youtube', 'rumble']),
      accountName: z.string(),
      cookies: z.string(),
      proxy: z.string().optional(),
      cookieExpiresAt: z.date().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      
      // Auto-calculate cookie expiration if not provided
      let cookieExpiresAt = input.cookieExpiresAt;
      if (!cookieExpiresAt) {
        // Default expiration: 30 days from now
        // In production, you could parse cookie max-age or expires attributes
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);
        cookieExpiresAt = expirationDate;
      }
      
      return createAccount({
        userId: ctx.user.id,
        platform: input.platform,
        accountName: input.accountName,
        cookies: input.cookies,
        proxy: input.proxy,
        cookieExpiresAt,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      platform: z.enum(['youtube', 'rumble']).optional(),
      accountName: z.string().optional(),
      cookies: z.string().optional(),
      proxy: z.string().optional(),
      isActive: z.number().optional(),
      cookieExpiresAt: z.date().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      const { id, ...data } = input;
      return updateAccount(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return deleteAccount(input.id);
    }),
    health: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getAccountHealth(input.id);
    }),
    updateHealth: protectedProcedure.input(z.object({
      id: z.number(),
      cookieExpiresAt: z.date().optional(),
      lastSuccessfulSubmission: z.date().optional(),
      totalSuccessfulJobs: z.number().optional(),
      totalFailedJobs: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      const { id, ...data } = input;
      return updateAccountHealth(id, data);
    }),
  }),

  videos: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getVideosByUserId(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      videoUrl: z.string(),
      platform: z.enum(['youtube', 'rumble']),
      videoId: z.string(),
      title: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      
      // Extract chat ID for Rumble videos
      let chatId: string | null = null;
      if (input.platform === 'rumble') {
        const { extractChatIdFromPage } = await import('./automation/extractChatId.ts');
        
        console.log(`[Video Create] Extracting chat ID for ${input.videoUrl}`);
        
        try {
          // Get cookies from any existing Rumble account to bypass Cloudflare
          const rumbleAccounts = await getAccountsByUserId(ctx.user.id);
          // Find the first active Rumble account with cookies
          const rumbleAccount = rumbleAccounts.find(acc => acc.platform === 'rumble' && acc.isActive === 1 && acc.cookies);
          const cookies = rumbleAccount?.cookies || undefined;
          const proxy = rumbleAccount?.proxy || undefined;
          
          if (cookies) {
            console.log(`[Video Create] Using account cookies for "${rumbleAccount?.accountName}" to bypass Cloudflare`);
          } else {
            console.warn(`[Video Create] No active Rumble account with cookies found, attempting without cookies`);
          }
          
          chatId = await extractChatIdFromPage(input.videoUrl, cookies, proxy);
          console.log(`[Video Create] Extracted chat ID for ${input.videoUrl}:`, chatId);
          
          if (!chatId) {
            console.warn(`[Video Create] WARNING: Chat ID extraction returned null`);
          }
        } catch (extractError) {
          console.error(`[Video Create] Error during extraction:`, extractError instanceof Error ? extractError.message : String(extractError));
        }
      }
      
      return createVideo({
        userId: ctx.user.id,
        videoUrl: input.videoUrl,
        platform: input.platform,
        videoId: input.videoId,
        chatId: chatId || undefined,
        title: input.title,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      videoUrl: z.string().optional(),
      platform: z.enum(['youtube', 'rumble']).optional(),
      videoId: z.string().optional(),
      title: z.string().optional(),
      status: z.enum(['pending', 'in_progress', 'completed', 'failed']).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      const { id, ...data } = input;
      return updateVideo(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return deleteVideo(input.id);
    }),
    reExtractChatId: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      
      const videos = await getVideosByUserId(ctx.user.id);
      const video = videos.find(v => v.id === input.id);
      if (!video) throw new Error('Video not found');
      if (video.platform !== 'rumble') throw new Error('Re-extraction only supported for Rumble');

      const { extractChatIdFromPage } = await import('./automation/extractChatId.ts');
      
      console.log(`[Video Re-extract] Re-extracting chat ID for ${video.videoUrl}`);
      
      // Get cookies from any existing Rumble account to bypass Cloudflare
      const rumbleAccounts = await getAccountsByUserId(ctx.user.id);
      const rumbleAccount = rumbleAccounts.find(acc => acc.platform === 'rumble' && acc.isActive === 1 && acc.cookies);
      const cookies = rumbleAccount?.cookies || undefined;
      const proxy = rumbleAccount?.proxy || undefined;
      
      if (cookies) {
        console.log(`[Video Re-extract] Using account cookies for "${rumbleAccount?.accountName}" to bypass Cloudflare`);
      } else {
        console.warn(`[Video Re-extract] No active Rumble account with cookies found`);
      }
      
      const chatId = await extractChatIdFromPage(video.videoUrl, cookies, proxy);
      console.log(`[Video Re-extract] Extracted chat ID:`, chatId);
      
      if (chatId) {
        await updateVideo(input.id, { chatId });
        return { success: true, chatId };
      } else {
        throw new Error('Failed to extract chat ID. Please ensure you have an active Rumble account with valid cookies.');
      }
    }),
  }),

  comments: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getCommentTemplatesByUserId(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string(),
      content: z.string(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return createCommentTemplate({
        userId: ctx.user.id,
        name: input.name,
        content: input.content,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      content: z.string().optional(),
      isActive: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      const { id, ...data } = input;
      return updateCommentTemplate(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return deleteCommentTemplate(input.id);
    }),
  }),

  jobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getJobsByUserId(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      videoId: z.number(),
      accountId: z.number(),
      commentTemplateId: z.number(),
      scheduledAt: z.date().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return createJob({
        userId: ctx.user.id,
        videoId: input.videoId,
        accountId: input.accountId,
        commentTemplateId: input.commentTemplateId,
        scheduledAt: input.scheduledAt,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'running', 'completed', 'failed']).optional(),
      errorMessage: z.string().optional(),
      startedAt: z.date().optional(),
      completedAt: z.date().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      const { id, ...data } = input;
      return updateJob(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return deleteJob(input.id);
    }),
  }),

  logs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getLogsByUserId(ctx.user.id);
    }),
    byJob: protectedProcedure.input(z.object({ jobId: z.number() })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getLogsByJobId(input.jobId);
    }),
  }),

  // Test procedure for direct API debugging
  test: router({
    directAPI: protectedProcedure.input(z.object({
      videoUrl: z.string(),
      comment: z.string(),
      cookies: z.string(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      
      const chatId = extractChatIdFromUrl(input.videoUrl);
      if (!chatId) {
        throw new Error('Could not extract chat ID from video URL');
      }
      
      const result = await postRumbleCommentDirect(
        chatId,
        input.comment,
        input.cookies
      );
      
      return result;
    }),
  }),
  
  // Embedded login procedures
  embeddedLogin: router({
    initiate: protectedProcedure.input(z.object({
      platform: z.enum(['rumble', 'youtube']),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return await initializeLoginSession(input.platform);
    }),
    
    status: protectedProcedure.input(z.object({
      sessionId: z.string(),
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getSessionStatus(input.sessionId);
    }),
    
    cancel: protectedProcedure.input(z.object({
      sessionId: z.string(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      await cancelLoginSession(input.sessionId);
      return { success: true };
    }),
  }),

  // AI Auto-Comment System
  aiComment: router({
    // Start monitoring a stream with AI comments
    startMonitor: protectedProcedure.input(z.object({
      videoId: z.number(),
      commentStyle: z.enum(['engaging', 'supportive', 'curious', 'casual', 'professional', 'hype', 'question', 'agreement']),
      commentInterval: z.number().min(30).max(600), // 30 seconds to 10 minutes
      includeEmojis: z.boolean(),
      maxCommentLength: z.number().min(10).max(500),
      accountIds: z.array(z.number()),
      audioEnabled: z.boolean().optional().default(true),
      audioInterval: z.number().min(15).max(120).optional().default(30),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      
      // Get the video details
      const videos = await getVideosByUserId(ctx.user.id);
      const video = videos.find(v => v.id === input.videoId);
      if (!video) throw new Error('Video not found');
      if (!video.chatId) throw new Error('Video does not have a chat ID');
      
      const sessionId = await startStreamMonitor({
        videoId: input.videoId,
        userId: ctx.user.id,
        platform: video.platform,
        streamUrl: video.videoUrl,
        chatId: video.chatId,
        commentStyle: input.commentStyle as CommentStyle,
        commentInterval: input.commentInterval,
        includeEmojis: input.includeEmojis,
        maxCommentLength: input.maxCommentLength,
        audioEnabled: input.audioEnabled,
        audioInterval: input.audioInterval,
        accountIds: input.accountIds,
      });
      
      return { sessionId };
    }),
    
    // Stop monitoring
    stopMonitor: protectedProcedure.input(z.object({
      sessionId: z.string(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      await stopStreamMonitor(input.sessionId);
      return { success: true };
    }),
    
    // Pause monitoring
    pauseMonitor: protectedProcedure.input(z.object({
      sessionId: z.string(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      pauseStreamMonitor(input.sessionId);
      return { success: true };
    }),
    
    // Resume monitoring
    resumeMonitor: protectedProcedure.input(z.object({
      sessionId: z.string(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      resumeStreamMonitor(input.sessionId);
      return { success: true };
    }),
    
    // Get monitor status
    getStatus: protectedProcedure.input(z.object({
      sessionId: z.string(),
    })).query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getMonitorStatus(input.sessionId);
    }),
    
    // Get all active sessions for user
    listSessions: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getUserSessions(ctx.user.id);
    }),
    
    // Preview a comment without posting
    preview: protectedProcedure.input(z.object({
      videoId: z.number(),
      style: z.enum(['engaging', 'supportive', 'curious', 'casual', 'professional', 'hype', 'question', 'agreement']),
      includeEmojis: z.boolean(),
      maxLength: z.number(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      
      const videos = await getVideosByUserId(ctx.user.id);
      const video = videos.find(v => v.id === input.videoId);
      if (!video) throw new Error('Video not found');
      
      return previewAIComment({
        streamUrl: video.videoUrl,
        platform: video.platform,
        style: input.style as CommentStyle,
        includeEmojis: input.includeEmojis,
        maxLength: input.maxLength,
      });
    }),
    
    // Generate a single comment (for manual use)
    generate: protectedProcedure.input(z.object({
      platform: z.enum(['youtube', 'rumble']),
      streamTitle: z.string().optional(),
      streamerName: z.string().optional(),
      audioTranscript: z.string().optional(),
      screenDescription: z.string().optional(),
      style: z.enum(['engaging', 'supportive', 'curious', 'casual', 'professional', 'hype', 'question', 'agreement']),
      includeEmojis: z.boolean(),
      maxLength: z.number(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      
      return generateAIComment({
        platform: input.platform,
        streamTitle: input.streamTitle,
        streamerName: input.streamerName,
        audioTranscript: input.audioTranscript,
        screenDescription: input.screenDescription,
        style: input.style as CommentStyle,
        includeEmojis: input.includeEmojis,
        maxLength: input.maxLength,
      });
    }),
  }),
});

export type AppRouter = typeof appRouter;
