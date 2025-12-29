import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  getAccountsByUserId,
  createAccount,
  updateAccount,
  deleteAccount,
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

export const appRouter = router({
  system: systemRouter,
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
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return createAccount({
        userId: ctx.user.id,
        platform: input.platform,
        accountName: input.accountName,
        cookies: input.cookies,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      platform: z.enum(['youtube', 'rumble']).optional(),
      accountName: z.string().optional(),
      cookies: z.string().optional(),
      isActive: z.number().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      const { id, ...data } = input;
      return updateAccount(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return deleteAccount(input.id);
    }),
  }),

  videos: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return getVideosByUserId(ctx.user.id);
    }),
    create: protectedProcedure.input(z.object({
      platform: z.enum(['youtube', 'rumble']),
      videoUrl: z.string().url(),
      videoId: z.string(),
      title: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') throw new Error('Admin access required');
      return createVideo({
        userId: ctx.user.id,
        platform: input.platform,
        videoUrl: input.videoUrl,
        videoId: input.videoId,
        title: input.title,
      });
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
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
});

export type AppRouter = typeof appRouter;
