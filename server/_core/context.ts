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

  // Check for local dev mode first
  const localDevUser = getLocalDevUser();
  if (localDevUser) {
    // Ensure local dev user exists in database
    try {
      await db.upsertUser({
        openId: LOCAL_DEV_USER.openId,
        name: LOCAL_DEV_USER.name,
        email: LOCAL_DEV_USER.email,
        loginMethod: LOCAL_DEV_USER.loginMethod,
        role: LOCAL_DEV_USER.role,
        lastSignedIn: new Date().toISOString(),
      });
      // Try to get the actual user from database (with real ID)
      const dbUser = await db.getUserByOpenId(LOCAL_DEV_USER.openId);
      if (dbUser) {
        console.log('[Context] Using local dev user from database (LOCAL_DEV_MODE=true)');
        return {
          req: opts.req,
          res: opts.res,
          user: dbUser,
        };
      }
    } catch (error) {
      console.warn('[Context] Could not upsert local dev user to database, using mock user:', error);
    }
    
    console.log('[Context] Using local dev user (LOCAL_DEV_MODE=true)');
    return {
      req: opts.req,
      res: opts.res,
      user: localDevUser,
    };
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
