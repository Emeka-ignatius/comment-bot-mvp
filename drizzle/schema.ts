import { InferInsertModel } from "drizzle-orm";
import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const accounts = mysqlTable("accounts", {
  id: int().autoincrement().notNull(),
  userId: int()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: mysqlEnum(["youtube", "rumble"]).notNull(),
  accountName: varchar({ length: 255 }).notNull(),
  cookies: text().notNull(),
  isActive: int().default(1).notNull(),
  createdAt: timestamp({ mode: "string" })
    .default("CURRENT_TIMESTAMP")
    .notNull(),
  updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
  cookieExpiresAt: timestamp({ mode: "string" }),
  lastSuccessfulSubmission: timestamp({ mode: "string" }),
  totalSuccessfulJobs: int().default(0).notNull(),
  totalFailedJobs: int().default(0).notNull(),
});

export const commentTemplates = mysqlTable("commentTemplates", {
  id: int().autoincrement().notNull(),
  userId: int()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar({ length: 255 }).notNull(),
  content: text().notNull(),
  isActive: int().default(1).notNull(),
  createdAt: timestamp({ mode: "string" })
    .default("CURRENT_TIMESTAMP")
    .notNull(),
  updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
});

export const jobs = mysqlTable("jobs", {
  id: int().autoincrement().notNull(),
  userId: int()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoId: int()
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  accountId: int()
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  commentTemplateId: int()
    .notNull()
    .references(() => commentTemplates.id, { onDelete: "cascade" }),
  status: mysqlEnum(["pending", "running", "completed", "failed"])
    .default("pending")
    .notNull(),
  scheduledAt: timestamp({ mode: "string" }),
  startedAt: timestamp({ mode: "string" }),
  completedAt: timestamp({ mode: "string" }),
  errorMessage: text(),
  createdAt: timestamp({ mode: "string" })
    .default("CURRENT_TIMESTAMP")
    .notNull(),
  updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
  minDelaySeconds: int().default(30),
  maxDelaySeconds: int().default(60),
});

export const logs = mysqlTable("logs", {
  id: int().autoincrement().notNull(),
  userId: int()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jobId: int()
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  platform: mysqlEnum(["youtube", "rumble"]).notNull(),
  status: mysqlEnum(["success", "failed", "skipped"]).notNull(),
  message: text(),
  errorDetails: text(),
  createdAt: timestamp({ mode: "string" })
    .default("CURRENT_TIMESTAMP")
    .notNull(),
});

export const users = mysqlTable(
  "users",
  {
    id: int().autoincrement().notNull(),
    openId: varchar({ length: 64 }).notNull(),
    name: text(),
    email: varchar({ length: 320 }),
    loginMethod: varchar({ length: 64 }),
    role: mysqlEnum(["user", "admin"]).default("user").notNull(),
    createdAt: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .defaultNow()
      .onUpdateNow()
      .notNull(),
    lastSignedIn: timestamp({ mode: "string" })
      .default("CURRENT_TIMESTAMP")
      .notNull(),
  },
  table => [index("users_openId_unique").on(table.openId)]
);

export const videos = mysqlTable("videos", {
  id: int().autoincrement().notNull(),
  userId: int()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: mysqlEnum(["youtube", "rumble"]).notNull(),
  videoUrl: varchar({ length: 512 }).notNull(),
  videoId: varchar({ length: 255 }).notNull(),
  title: varchar({ length: 512 }),
  status: mysqlEnum(["pending", "in_progress", "completed", "failed"])
    .default("pending")
    .notNull(),
  createdAt: timestamp({ mode: "string" })
    .default("CURRENT_TIMESTAMP")
    .notNull(),
  updatedAt: timestamp({ mode: "string" }).defaultNow().onUpdateNow().notNull(),
  chatId: varchar({ length: 255 }),
});

export type InsertUser = InferInsertModel<typeof users>;
export type InsertAccount = InferInsertModel<typeof accounts>;
export type InsertVideo = InferInsertModel<typeof videos>;
export type InsertCommentTemplate = InferInsertModel<typeof commentTemplates>;
export type InsertJob = InferInsertModel<typeof jobs>;
export type InsertLog = InferInsertModel<typeof logs>;
