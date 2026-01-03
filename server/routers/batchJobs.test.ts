import { describe, expect, it } from "vitest";
import { batchJobsRouter } from "./batchJobs";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSignedIn: new Date().toISOString(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return ctx;
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSignedIn: new Date().toISOString(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return ctx;
}

describe("batch.create - Access Control", () => {
  it("should reject non-admin users", async () => {
    const ctx = createUserContext();
    const caller = batchJobsRouter.createCaller(ctx);

    try {
      await caller.create({
        videoIds: [1],
        accountIds: [1],
        commentTemplateIds: [1],
        scheduleMode: "immediate",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect((error as Error).message).toBe("Admin access required");
    }
  });

  it("should allow admin users to proceed", async () => {
    const ctx = createAdminContext();
    const caller = batchJobsRouter.createCaller(ctx);

    try {
      await caller.create({
        videoIds: [1],
        accountIds: [1],
        commentTemplateIds: [1],
        scheduleMode: "immediate",
      });
    } catch (error) {
      // Expected to fail at DB level since test data doesn't exist
      // The important part is that it got past the admin check
      expect((error as Error).message).not.toBe("Admin access required");
    }
  });
});

describe("batch.create - Input Validation", () => {
  it("should validate that videoIds is an array", async () => {
    const ctx = createAdminContext();
    const caller = batchJobsRouter.createCaller(ctx);

    try {
      await caller.create({
        videoIds: "invalid" as any,
        accountIds: [1],
        commentTemplateIds: [1],
        scheduleMode: "immediate",
      });
      expect.fail("Should have thrown validation error");
    } catch (error) {
      expect((error as Error).message).toContain("expected array");
    }
  });

  it("should validate scheduleMode is valid enum", async () => {
    const ctx = createAdminContext();
    const caller = batchJobsRouter.createCaller(ctx);

    try {
      await caller.create({
        videoIds: [1],
        accountIds: [1],
        commentTemplateIds: [1],
        scheduleMode: "invalid" as any,
      });
      expect.fail("Should have thrown validation error");
    } catch (error) {
      expect((error as Error).message).toContain("Invalid option");
    }
  });

  it("should validate delayMinutes is a number", async () => {
    const ctx = createAdminContext();
    const caller = batchJobsRouter.createCaller(ctx);

    try {
      await caller.create({
        videoIds: [1],
        accountIds: [1],
        commentTemplateIds: [1],
        scheduleMode: "delay",
        delayMinutes: "invalid" as any,
      });
      expect.fail("Should have thrown validation error");
    } catch (error) {
      expect((error as Error).message).toContain("expected number");
    }
  });

  it("should accept valid spread scheduling parameters", async () => {
    const ctx = createAdminContext();
    const caller = batchJobsRouter.createCaller(ctx);

    try {
      await caller.create({
        videoIds: [1],
        accountIds: [1],
        commentTemplateIds: [1],
        scheduleMode: "spread",
        spreadMinutes: 5,
      });
    } catch (error) {
      // Expected to fail at DB level, not validation
      expect((error as Error).message).not.toContain("expected");
      expect((error as Error).message).not.toContain("Invalid option");
    }
  });
});
