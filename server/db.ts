import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
let _client: postgres.Sql | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const databaseUrl = process.env.DATABASE_URL;

      // Parse URL to check if it's a pooled connection
      // Use try-catch for URL parsing as connection string format may vary
      let isPooled = false;
      try {
        const url = new URL(databaseUrl);
        isPooled = url.hostname.includes("-pooler");
      } catch {
        // If URL parsing fails, check the string directly
        isPooled = databaseUrl.includes("-pooler");
      }

      // Create postgres client with optimized settings for Neon
      _client = postgres(databaseUrl, {
        max: isPooled ? 10 : 1, // Pooled connections can handle more
        idle_timeout: 20, // Close idle connections after 20 seconds
        connect_timeout: 30, // 30 second timeout (Neon can be slow to wake up)
        ssl: "require", // Ensure SSL is required for Neon
        prepare: false, // Disable prepared statements for serverless (can cause issues)
        // Connection retry settings
        max_lifetime: 60 * 30, // 30 minutes max connection lifetime
        onnotice: () => {}, // Suppress notices
      });

      // Test the connection
      await _client`SELECT 1`;

      _db = drizzle(_client);
      console.log(
        `[Database] Connected to Postgres database${isPooled ? " (pooled)" : ""}`
      );
    } catch (error) {
      console.error("[Database] Failed to connect:", error);
      // Don't set _db to null on first failure, allow retry
      if (_client) {
        try {
          await _client.end({ timeout: 5 });
        } catch (e) {
          // Ignore cleanup errors
        }
        _client = null;
      }
      _db = null;
      throw error; // Re-throw to allow caller to handle
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

    const textFields = ["name", "email", "loginMethod", "password"] as const;
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
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Postgres uses ON CONFLICT instead of onDuplicateKeyUpdate
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(users).values(data).returning();
  return result[0];
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
