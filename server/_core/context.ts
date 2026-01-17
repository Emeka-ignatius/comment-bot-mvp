import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { users } from "../../drizzle/schema";
import type { InferSelectModel } from "drizzle-orm";
import { sdk } from "./sdk";
import { getLocalDevUser, LOCAL_DEV_USER } from "./localDevAuth";
import * as db from "../db";

type User = InferSelectModel<typeof users>;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Try to authenticate with real session first
  try {
    user = await sdk.authenticateRequest(opts.req);
    if (user) {
      return {
        req: opts.req,
        res: opts.res,
        user,
      };
    }
  } catch (error) {
    // Authentication failed, continue to check local dev mode
  }

  // Fallback to local dev mode only if no real user and LOCAL_DEV_MODE is enabled
  // IMPORTANT: Only use local dev mode if explicitly enabled in .env
  // This allows testing real authentication even on localhost
  const localDevUser = getLocalDevUser();
  if (localDevUser) {
    console.log(
      "[Context] No authenticated user, using local dev mode (LOCAL_DEV_MODE=true)"
    );
    // Ensure local dev user exists in database
    try {
      await db.upsertUser({
        openId: LOCAL_DEV_USER.openId,
        name: LOCAL_DEV_USER.name,
        email: LOCAL_DEV_USER.email,
        loginMethod: LOCAL_DEV_USER.loginMethod,
        role: LOCAL_DEV_USER.role,
        lastSignedIn: new Date(),
      });
      // Try to get the actual user from database (with real ID)
      const dbUser = await db.getUserByOpenId(LOCAL_DEV_USER.openId);
      if (dbUser) {
        console.log(
          "[Context] Using local dev user from database (LOCAL_DEV_MODE=true)"
        );
        return {
          req: opts.req,
          res: opts.res,
          user: dbUser,
        };
      }
    } catch (error) {
      console.warn(
        "[Context] Could not upsert local dev user to database, using mock user:",
        error
      );
    }

    console.log("[Context] Using local dev user (LOCAL_DEV_MODE=true)");
    return {
      req: opts.req,
      res: opts.res,
      user: localDevUser,
    };
  }

  // No user authenticated
  return {
    req: opts.req,
    res: opts.res,
    user: null,
  };
}
