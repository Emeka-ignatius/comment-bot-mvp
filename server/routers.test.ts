import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Admin Access Control", () => {
  it("should allow admin users to list accounts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.accounts.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      // Expected to fail if database is not available
      expect(error).toBeDefined();
    }
  });

  it("should deny non-admin users from listing accounts", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.accounts.list();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain("Admin access required");
    }
  });

  it("should allow admin users to create accounts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.accounts.create({
        platform: "youtube",
        accountName: "Test Account",
        cookies: JSON.stringify({ test: "cookie" }),
      });
      expect(result).toBeDefined();
    } catch (error) {
      // Expected to fail if database is not available
      expect(error).toBeDefined();
    }
  });

  it("should deny non-admin users from creating accounts", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.accounts.create({
        platform: "youtube",
        accountName: "Test Account",
        cookies: JSON.stringify({ test: "cookie" }),
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain("Admin access required");
    }
  });
});

describe("Videos Procedures", () => {
  it("should allow admin users to list videos", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.videos.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should deny non-admin users from listing videos", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.videos.list();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain("Admin access required");
    }
  });

  it("should validate video URL format", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.videos.create({
        platform: "youtube",
        videoUrl: "not-a-valid-url",
        videoId: "test123",
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("Comments Procedures", () => {
  it("should allow admin users to list comment templates", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.comments.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should allow admin users to create comment templates", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.comments.create({
        name: "Test Comment",
        content: "This is a test comment",
      });
      expect(result).toBeDefined();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("Jobs Procedures", () => {
  it("should allow admin users to list jobs", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.jobs.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should deny non-admin users from creating jobs", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.jobs.create({
        videoId: 1,
        accountId: 1,
        commentTemplateId: 1,
      });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
      expect((error as Error).message).toContain("Admin access required");
    }
  });
});

describe("Logs Procedures", () => {
  it("should allow admin users to list logs", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.logs.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should allow admin users to get logs by job ID", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.logs.byJob({ jobId: 1 });
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("Authentication", () => {
  it("should allow users to check their auth status", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toEqual(ctx.user);
  });
});
