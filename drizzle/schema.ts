import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enums
export const platformEnum = pgEnum("platform", ["youtube", "rumble"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "completed", "failed"]);
export const videoStatusEnum = pgEnum("video_status", ["pending", "in_progress", "completed", "failed"]);
export const logStatusEnum = pgEnum("log_status", ["success", "failed", "skipped"]);
export const logActionEnum = pgEnum("log_action", ["manual_comment", "ai_comment", "job_comment"]);
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    password: varchar("password", { length: 255 }), // Hashed password (bcrypt)
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSignedIn: timestamp("lastSignedIn", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    openIdIdx: index("users_openId_idx").on(table.openId),
    emailIdx: index("users_email_idx").on(table.email),
  })
);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  accountName: varchar("accountName", { length: 255 }).notNull(),
  cookies: text("cookies").notNull(), // JSON stringified cookies
  proxy: text("proxy"), // Format: protocol://user:pass@host:port
  isActive: boolean("isActive").default(true).notNull(),
  cookieExpiresAt: timestamp("cookieExpiresAt", { mode: "date", withTimezone: true }),
  lastSuccessfulSubmission: timestamp("lastSuccessfulSubmission", { mode: "date", withTimezone: true }),
  totalSuccessfulJobs: integer("totalSuccessfulJobs").default(0).notNull(),
  totalFailedJobs: integer("totalFailedJobs").default(0).notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const commentTemplates = pgTable("commentTemplates", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  videoUrl: varchar("videoUrl", { length: 512 }).notNull(),
  videoId: varchar("videoId", { length: 255 }).notNull(),
  title: varchar("title", { length: 512 }),
  status: videoStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  chatId: varchar("chatId", { length: 255 }),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoId: integer("videoId")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  accountId: integer("accountId")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  commentTemplateId: integer("commentTemplateId")
    .notNull()
    .references(() => commentTemplates.id, { onDelete: "cascade" }),
  status: jobStatusEnum("status").default("pending").notNull(),
  scheduledAt: timestamp("scheduledAt", { mode: "date", withTimezone: true }),
  startedAt: timestamp("startedAt", { mode: "date", withTimezone: true }),
  completedAt: timestamp("completedAt", { mode: "date", withTimezone: true }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  minDelaySeconds: integer("minDelaySeconds").default(30),
  maxDelaySeconds: integer("maxDelaySeconds").default(60),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: integer("jobId").references(() => jobs.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  status: logStatusEnum("status").notNull(),
  message: text("message"),
  errorDetails: text("errorDetails"),
  createdAt: timestamp("createdAt", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  accountId: integer("accountId").references(() => accounts.id, { onDelete: "set null" }),
  videoId: integer("videoId").references(() => videos.id, { onDelete: "set null" }),
  action: logActionEnum("action").default("job_comment").notNull(),
  metadata: text("metadata"),
});

// Type exports for use in other files
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
export type SelectAccount = typeof accounts.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;
export type SelectVideo = typeof videos.$inferSelect;
export type InsertCommentTemplate = typeof commentTemplates.$inferInsert;
export type SelectCommentTemplate = typeof commentTemplates.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;
export type SelectJob = typeof jobs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;
export type SelectLog = typeof logs.$inferSelect;
