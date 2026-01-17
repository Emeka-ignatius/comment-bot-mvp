/**
 * Local Development Authentication Bypass
 *
 * Provides a mock user for local development when Manus OAuth is not available
 */
import type { SelectUser } from "../../drizzle/schema";
import { ENV } from "./env";

export const LOCAL_DEV_USER: SelectUser = {
  id: 1,
  openId: "local_dev_user",
  name: "Local Dev User",
  email: "dev@localhost",
  password: null, // No password for local dev user
  loginMethod: "local",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

/**
 * Check if we're running in local development mode
 */
export function isLocalDev(): boolean {
  return ENV.localDevMode;
}

/**
 * Get mock user for local development
 */
export function getLocalDevUser(): SelectUser | null {
  if (!isLocalDev()) {
    return null;
  }
  return LOCAL_DEV_USER;
}
