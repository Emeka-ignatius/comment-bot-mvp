import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  InsertAccount,
  accounts,
  InsertVideo,
  videos,
  InsertCommentTemplate,
  commentTemplates,
  InsertJob,
  jobs,
  InsertLog,
  logs,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date().toISOString();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Accounts queries
export async function createAccount(data: InsertAccount) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(accounts).values(data);
  return result;
}

export async function getAccountsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(accounts).where(eq(accounts.userId, userId));
}

export async function updateAccount(id: number, data: Partial<InsertAccount>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(accounts).set(data).where(eq(accounts.id, id));
}

export async function deleteAccount(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(accounts).where(eq(accounts.id, id));
}

// Videos queries
export async function createVideo(data: InsertVideo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(videos).values(data);
}

export async function getVideosByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(videos).where(eq(videos.userId, userId));
}

export async function updateVideo(id: number, data: Partial<InsertVideo>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(videos).set(data).where(eq(videos.id, id));
}

export async function deleteVideo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(videos).where(eq(videos.id, id));
}

// Comment Templates queries
export async function createCommentTemplate(data: InsertCommentTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(commentTemplates).values(data);
}

export async function getCommentTemplatesByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(commentTemplates)
    .where(eq(commentTemplates.userId, userId));
}

export async function updateCommentTemplate(
  id: number,
  data: Partial<InsertCommentTemplate>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .update(commentTemplates)
    .set(data)
    .where(eq(commentTemplates.id, id));
}

export async function deleteCommentTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(commentTemplates).where(eq(commentTemplates.id, id));
}

// Jobs queries
export async function createJob(data: InsertJob) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(jobs).values(data);
}

export async function getJobsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobs).where(eq(jobs.userId, userId));
}

export async function getPendingJobs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(jobs).where(eq(jobs.status, "pending")).limit(1);
}

export async function updateJob(id: number, data: Partial<InsertJob>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(jobs).set(data).where(eq(jobs.id, id));
}

export async function deleteJob(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(jobs).where(eq(jobs.id, id));
}

// Logs queries
export async function createLog(data: InsertLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(logs).values(data);
}

export async function getLogsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(logs).where(eq(logs.userId, userId));
}

export async function getLogsByJobId(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(logs).where(eq(logs.jobId, jobId));
}

// Account Health Monitoring
export async function getAccountHealth(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (result.length === 0) return null;

  const account = result[0];
  const now = new Date();

  // Calculate health status
  let healthStatus: "healthy" | "warning" | "critical" = "healthy";
  let daysUntilExpiration: number | null = null;

  if (account.cookieExpiresAt) {
    const expirationDate = new Date(account.cookieExpiresAt);
    daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration <= 0) {
      healthStatus = "critical"; // Expired
    } else if (daysUntilExpiration <= 7) {
      healthStatus = "warning"; // Expiring soon
    }
  }

  const successRate =
    account.totalSuccessfulJobs + account.totalFailedJobs > 0
      ? Math.round(
          (account.totalSuccessfulJobs /
            (account.totalSuccessfulJobs + account.totalFailedJobs)) *
            100
        )
      : 0;

  return {
    ...account,
    healthStatus,
    daysUntilExpiration,
    successRate,
    totalJobs: account.totalSuccessfulJobs + account.totalFailedJobs,
  };
}

export async function updateAccountHealth(
  accountId: number,
  data: {
    cookieExpiresAt?: Date;
    lastSuccessfulSubmission?: Date;
    totalSuccessfulJobs?: number;
    totalFailedJobs?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, any> = {};
  if (data.cookieExpiresAt) updateData.cookieExpiresAt = data.cookieExpiresAt;
  if (data.lastSuccessfulSubmission)
    updateData.lastSuccessfulSubmission = data.lastSuccessfulSubmission;
  if (data.totalSuccessfulJobs !== undefined)
    updateData.totalSuccessfulJobs = data.totalSuccessfulJobs;
  if (data.totalFailedJobs !== undefined)
    updateData.totalFailedJobs = data.totalFailedJobs;

  return db.update(accounts).set(updateData).where(eq(accounts.id, accountId));
}

export async function incrementAccountJobStats(
  accountId: number,
  success: boolean
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (account.length === 0) throw new Error("Account not found");

  const updateData: Record<string, any> = {};
  if (success) {
    updateData.totalSuccessfulJobs = (account[0].totalSuccessfulJobs || 0) + 1;
    updateData.lastSuccessfulSubmission = new Date();
  } else {
    updateData.totalFailedJobs = (account[0].totalFailedJobs || 0) + 1;
  }

  return db.update(accounts).set(updateData).where(eq(accounts.id, accountId));
}
