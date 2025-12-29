import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { createJob } from "../db";

export const batchJobsRouter = router({
  create: protectedProcedure.input(z.object({
    videoIds: z.array(z.number()),
    accountIds: z.array(z.number()),
    commentTemplateIds: z.array(z.number()),
    scheduleMode: z.enum(['immediate', 'delay', 'spread']),
    delayMinutes: z.number().optional(),
    spreadMinutes: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== 'admin') throw new Error('Admin access required');
    
    const jobs = [];
    let delayMs = 0;
    
    for (const videoId of input.videoIds) {
      for (const accountId of input.accountIds) {
        for (const commentTemplateId of input.commentTemplateIds) {
          let scheduledAt: Date | undefined;
          
          if (input.scheduleMode === 'delay' && input.delayMinutes) {
            scheduledAt = new Date(Date.now() + input.delayMinutes * 60000);
          } else if (input.scheduleMode === 'spread' && input.spreadMinutes) {
            scheduledAt = new Date(Date.now() + delayMs);
            delayMs += input.spreadMinutes * 60000;
          }
          
          const job = await createJob({
            userId: ctx.user.id,
            videoId,
            accountId,
            commentTemplateId,
            scheduledAt,
          });
          jobs.push(job);
        }
      }
    }
    
    return { success: true, jobsCreated: jobs.length, jobs };
  }),
});
