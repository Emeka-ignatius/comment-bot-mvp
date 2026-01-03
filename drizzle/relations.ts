import { relations } from "drizzle-orm/relations";
import { users, accounts, commentTemplates, jobs, videos, logs } from "./schema";

export const accountsRelations = relations(accounts, ({one, many}) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
	jobs: many(jobs),
}));

export const usersRelations = relations(users, ({many}) => ({
	accounts: many(accounts),
	commentTemplates: many(commentTemplates),
	jobs: many(jobs),
	logs: many(logs),
	videos: many(videos),
}));

export const commentTemplatesRelations = relations(commentTemplates, ({one, many}) => ({
	user: one(users, {
		fields: [commentTemplates.userId],
		references: [users.id]
	}),
	jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({one, many}) => ({
	user: one(users, {
		fields: [jobs.userId],
		references: [users.id]
	}),
	video: one(videos, {
		fields: [jobs.videoId],
		references: [videos.id]
	}),
	account: one(accounts, {
		fields: [jobs.accountId],
		references: [accounts.id]
	}),
	commentTemplate: one(commentTemplates, {
		fields: [jobs.commentTemplateId],
		references: [commentTemplates.id]
	}),
	logs: many(logs),
}));

export const videosRelations = relations(videos, ({one, many}) => ({
	jobs: many(jobs),
	user: one(users, {
		fields: [videos.userId],
		references: [users.id]
	}),
}));

export const logsRelations = relations(logs, ({one}) => ({
	user: one(users, {
		fields: [logs.userId],
		references: [users.id]
	}),
	job: one(jobs, {
		fields: [logs.jobId],
		references: [jobs.id]
	}),
}));