-- ============================================
-- Database Schema for Comment Bot MVP
-- Run this in Supabase SQL Editor or via drizzle-kit push
-- ============================================

-- Create Enums
CREATE TYPE "platform" AS ENUM ('youtube', 'rumble');
CREATE TYPE "job_status" AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE "video_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed');
CREATE TYPE "log_status" AS ENUM ('success', 'failed', 'skipped');
CREATE TYPE "log_action" AS ENUM ('manual_comment', 'ai_comment', 'job_comment');
CREATE TYPE "user_role" AS ENUM ('user', 'admin');

-- Users Table
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320),
  "password" VARCHAR(255),
  "loginMethod" VARCHAR(64),
  "role" "user_role" DEFAULT 'user' NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "lastSignedIn" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for users
CREATE INDEX "users_openId_idx" ON "users" ("openId");
CREATE INDEX "users_email_idx" ON "users" ("email");

-- Accounts Table
CREATE TABLE "accounts" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" "platform" NOT NULL,
  "accountName" VARCHAR(255) NOT NULL,
  "cookies" TEXT NOT NULL,
  "proxy" TEXT,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "cookieExpiresAt" TIMESTAMP WITH TIME ZONE,
  "lastSuccessfulSubmission" TIMESTAMP WITH TIME ZONE,
  "totalSuccessfulJobs" INTEGER DEFAULT 0 NOT NULL,
  "totalFailedJobs" INTEGER DEFAULT 0 NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Comment Templates Table
CREATE TABLE "commentTemplates" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "content" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Videos Table
CREATE TABLE "videos" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" "platform" NOT NULL,
  "videoUrl" VARCHAR(512) NOT NULL,
  "videoId" VARCHAR(255) NOT NULL,
  "title" VARCHAR(512),
  "status" "video_status" DEFAULT 'pending' NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "chatId" VARCHAR(255)
);

-- Jobs Table
CREATE TABLE "jobs" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "videoId" INTEGER NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
  "accountId" INTEGER NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "commentTemplateId" INTEGER NOT NULL REFERENCES "commentTemplates"("id") ON DELETE CASCADE,
  "status" "job_status" DEFAULT 'pending' NOT NULL,
  "scheduledAt" TIMESTAMP WITH TIME ZONE,
  "startedAt" TIMESTAMP WITH TIME ZONE,
  "completedAt" TIMESTAMP WITH TIME ZONE,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "minDelaySeconds" INTEGER DEFAULT 10,
  "maxDelaySeconds" INTEGER DEFAULT 30
);

-- Logs Table
CREATE TABLE "logs" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "jobId" INTEGER REFERENCES "jobs"("id") ON DELETE CASCADE,
  "platform" "platform" NOT NULL,
  "status" "log_status" NOT NULL,
  "message" TEXT,
  "errorDetails" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "accountId" INTEGER REFERENCES "accounts"("id") ON DELETE SET NULL,
  "videoId" INTEGER REFERENCES "videos"("id") ON DELETE SET NULL,
  "action" "log_action" DEFAULT 'job_comment' NOT NULL,
  "metadata" TEXT
);
