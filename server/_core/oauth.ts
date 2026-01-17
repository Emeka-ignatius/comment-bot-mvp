import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { nanoid } from "nanoid";
import { hashPassword, verifyPassword } from "./auth";

/**
 * Authentication routes for user registration and login
 */
export function registerOAuthRoutes(app: Express) {
  /**
   * Register a new user
   * POST /api/auth/register
   * Body: { email, password, name }
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
      }

      // Check if user already exists
      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: "User with this email already exists" });
        return;
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Generate unique openId
      const openId = `user_${nanoid()}`;

      // Create user
      await db.createUser({
        openId,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name || null,
        loginMethod: "local",
        role: "user", // Default to user, can be changed to admin manually
      });

      // Get the created user
      const user = await db.getUserByOpenId(openId);
      if (!user) {
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      // Create session
      const sessionToken = await sdk.createSessionToken(openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.json({ 
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      });
    } catch (error) {
      console.error("[Auth] Registration failed", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  /**
   * Login with email and password
   * POST /api/auth/login
   * Body: { email, password }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
      }

      // Find user by email
      const user = await db.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Check if user has a password (for users created before password auth)
      if (!user.password) {
        res.status(401).json({ 
          error: "Account needs to be reset. Please contact support or register again." 
        });
        return;
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      // Update last signed in
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Create session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || email,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.json({ 
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  /**
   * Logout - clears session cookie
   * POST /api/auth/logout
   */
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // Keep OAuth callback for backwards compatibility (but it won't work without Manus)
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    res.status(400).json({ error: "OAuth is not configured. Use /api/auth/login instead." });
  });
}
