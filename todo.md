# Comment Bot MVP - Project TODO

## Phase 1: Database Schema & Setup
- [x] Design and implement database schema (accounts, videos, comments, jobs, logs)
- [x] Create Drizzle migrations
- [x] Add database helper functions in server/db.ts

## Phase 2: Backend API Procedures
- [x] Create account management procedures (create, list, update, delete)
- [x] Create video management procedures (add, list, update, delete)
- [x] Create comment pool procedures (create, list, update, delete)
- [x] Create job management procedures (create, list, update status)
- [x] Implement admin-only access control for all procedures

## Phase 3: Browser Automation Engine
- [x] Install Playwright and anti-fingerprinting dependencies
- [x] Create Playwright browser automation service
- [x] Implement anti-fingerprinting measures
- [x] Create YouTube comment submission logic
- [x] Create Rumble comment submission logic
- [x] Implement cookie-based authentication for both platforms
- [x] Add error handling and retry logic

## Phase 4: Admin Dashboard UI
- [x] Create DashboardLayout with sidebar navigation
- [x] Build accounts management page
- [x] Build videos management page
- [x] Build comment pool management page
- [x] Build job queue page
- [x] Implement responsive design

## Phase 5: Job Queue & Real-time Monitoring
- [x] Create job queue service (single-threaded processing)
- [x] Implement job status updates (pending, running, completed, failed)
- [x] Create real-time status monitoring UI
- [ ] Add job scheduling logic (immediate and scheduled)
- [x] Implement job execution engine

## Phase 6: Logging & Error Handling
- [x] Create logging system for all submissions
- [x] Add timestamp tracking
- [x] Implement error message logging
- [x] Create logs view page
- [x] Add error recovery mechanisms

## Phase 7: Testing & Delivery
- [x] Write vitest tests for backend procedures
- [ ] Test browser automation with sample videos
- [ ] Test job queue processing
- [x] Verify admin-only access control
- [ ] Create checkpoint and deliver MVP

## Bug Fixes
- [x] Fix Rumble URL extraction logic (v73kr84 format)
- [x] Add YouTube short URL support (youtu.be)
- [x] Add real-time URL validation with error messages
- [x] Add visual feedback for valid/invalid URLs

## Job Queue Integration
- [x] Integrate job queue to auto-start on server boot
- [x] Install Playwright browsers and system dependencies
- [ ] Test automatic job processing with matching platform/account
- [ ] Add job processor status indicator to dashboard

## Cookie Handling Improvements
- [x] Parse raw cookie strings from browser dev tools
- [x] Validate cookie format before injection
- [x] Add better error messages for invalid cookies
- [x] Implement mock automation for MVP testing
- [x] Add environment flag to toggle mock mode (MOCK_AUTOMATION=true)

## Batch Job Creation Feature
- [x] Create batch job creation API procedure
- [x] Build batch job creation UI component
- [x] Add scheduling options (immediate, delay, spread over time)
- [x] Implement job preview before creation
- [x] Add success confirmation with job count
- [x] Write vitest tests for batch job creation (6 tests passing)

## Account Health Monitoring Feature
- [x] Update database schema to track cookieExpiresAt and lastSuccessfulSubmission
- [x] Create database migrations
- [x] Add account health calculation procedures (getAccountHealth, updateAccountHealth)
- [x] Build account health UI with visual indicators (healthy, warning, critical)
- [x] Add cookie expiration alerts and countdown
- [x] Implement success rate tracking and job statistics
- [x] Write vitest tests for health monitoring (11 tests passing)

## Rumble Selfbot API Integration
- [x] Analyze rumble-selfbot-api source code structure
- [x] Install playwright-anti-fingerprinter and dependencies
- [x] Configure Playwright with anti-fingerprinting
- [x] Implement real comment submission for live streams
- [ ] Implement view automation with watch time tracking
- [x] Add cookie injection from stored accounts
- [ ] Create API endpoint for AI system integration
- [ ] Test with real Rumble account
- [x] Write vitest tests for cookie parsing (10 tests passing)

## Playwright-Extra with Stealth Plugin (Cloudflare Bypass)
- [ ] Install playwright-extra and puppeteer-extra-plugin-stealth
- [ ] Rewrite realRumble.ts to use playwright-extra
- [ ] Add stealth plugin configuration
- [ ] Test Cloudflare bypass
- [ ] Test real comment posting on live stream
- [ ] Verify comments appear in chat

## Direct Rumble API Implementation (Cloudflare Bypass Alternative)
- [x] Create directRumbleAPI.ts with reverse-engineered API endpoint
- [x] Implement extractChatIdFromUrl helper function
- [x] Implement postRumbleCommentDirect with axios HTTP requests
- [x] Update job queue to use direct API instead of Playwright
- [x] Install axios dependency
- [x] Restart server with direct API integration
- [ ] Test direct API with real Rumble account cookies (READY FOR USER TESTING)
- [ ] Verify comments post successfully on live stream (READY FOR USER TESTING)
- [ ] Monitor for API detection/blocking
- [x] Write vitest tests for direct API functions

## CRITICAL BUGS
- [x] Fix job stuck in "running" state for 2+ hours (RESOLVED - was old Playwright jobs)
- [x] Debug direct API implementation - not posting comments (RESOLVED - chat ID extraction + username field fix)
- [x] Replace current API implementation with user's working code (RESOLVED - direct API working)

## Embedded Login Flow Feature
- [ ] Design embedded login UI for Rumble accounts
- [ ] Implement iframe/popup login flow for Rumble
- [ ] Add automatic cookie capture after login
- [ ] Store captured cookies in database
- [ ] Add cookie expiration detection and alerts
- [ ] Design embedded login UI for YouTube accounts
- [ ] Implement iframe/popup login flow for YouTube
- [ ] Test automatic cookie refresh on re-login

## Chat ID Extraction Fix (CRITICAL)
- [x] Implement function to fetch Rumble page and extract chat ID from HTML/JS
- [x] Add chatId field to videos table schema
- [x] Update video creation to automatically fetch and store chat ID
- [x] Update job queue to use stored chat ID instead of extracting from URL
- [x] Test chat ID extraction with live stream URL (https://rumble.com/v73mkg8-shakers.html → 425684736)
- [x] Fix username field issue (removed - Rumble infers from cookies)
- [x] Successfully posted test comment to live stream via direct API

## Rate Limiting Controls
- [x] Add minDelay and maxDelay fields to jobs table
- [x] Add rate limiting configuration to batch job creation
- [x] Implement random delay between comments (30-60 seconds default)
- [x] Add rate limiting controls to job queue processor
- [ ] Test rate limiting with multiple jobs

## Embedded Login Flow (PRIORITY)
- [x] Design embedded login UI component for Rumble
- [x] Create improved cookie input helper with step-by-step instructions
- [x] Add cookie validation (checks for required cookies)
- [x] Store captured cookies automatically in database
- [x] Add platform selection buttons to accounts page
- [x] Add YouTube cookie input support
- [x] Replace basic form with guided cookie helper

## Cookie Expiration Monitoring
- [x] Add cookie expiration detection logic
- [x] Calculate and display "expires in X days" for each account
- [x] Add visual alerts for expiring cookies (< 7 days)
- [x] Implement one-click refresh button for expired accounts
- [x] Add automatic cookie expiration date (30 days default)
- [x] Add color-coded status indicators (green/yellow/red)
- [x] Show last used date for each account

## Embedded Login Flow with Puppeteer
- [x] Install Puppeteer and dependencies
- [x] Create backend service for browser automation
- [x] Implement Rumble login automation with cookie capture
- [x] Implement YouTube login automation with cookie capture
- [x] Create tRPC procedure for initiating login session
- [x] Create tRPC procedure for checking login status
- [x] Create tRPC procedure for retrieving captured cookies
- [x] Update frontend to use embedded login flow
- [x] Add loading states and progress indicators
- [x] Add login method selection (Auto Login vs Manual)
- [ ] Test Rumble embedded login (READY FOR USER TESTING)
- [ ] Test YouTube embedded login (READY FOR USER TESTING)

## Cookie Capture Solution (Cookie-Editor Extension)
- [x] Update CookieInputHelper with Cookie-Editor extension instructions
- [x] Add support for both Header String and JSON cookie formats
- [x] Add proper validation for required cookies (a_s, u_s for Rumble)
- [x] Remove auto-login option from UI (code kept for future use)
- [x] Simplify account management page
- [x] Test cookie capture with Cookie-Editor extension (WORKING!)
- [x] Test job execution with properly captured cookies (WORKING!)

## AI Auto-Comment System
- [ ] Integrate audio transcription for live streams
- [ ] Implement real-time comment generation with LLM
- [ ] Add automatic account assignment logic
- [ ] Create automatic job creation from AI comments
- [ ] Add live stream monitoring service
- [ ] Test AI comment generation
- [ ] Test automatic job creation

## Add "Login An Account" Sidebar Link
- [x] Rename current Accounts.tsx to LoginAccount.tsx
- [x] Update App.tsx to import AccountsWithHealth for /accounts route
- [x] Add new /login-account route for LoginAccount.tsx
- [x] Update AdminDashboardLayout sidebar to include "Login An Account" link
- [ ] Test both pages work correctly

## Fix Puppeteer Chrome Path Issue
- [x] Verify executablePath is set in embeddedLogin.ts
- [x] Add multi-path Chrome detection
- [x] Copy Chrome to /root/.cache for server process
- [x] Force server reload to pick up changes
- [ ] Test auto-login from UI
- [ ] Add screenshot capture for login monitoring
- [ ] Test with visible browser mode

## Fix Embedded Login Issues
- [x] Fix Rumble: Stop auto-detecting existing browser cookies
- [x] Fix Rumble: Open fresh incognito session for login
- [x] Fix YouTube: URL already correct (accounts.google.com/signin)
- [x] Fix YouTube: Open fresh incognito session for login
- [x] Only capture cookies AFTER user explicitly logs in (check for specific cookies)
- [ ] Test Rumble login with fresh session (READY FOR USER TESTING)
- [ ] Test YouTube login with fresh session (READY FOR USER TESTING)

## Fix Puppeteer Cookie Detection
- [x] Add detailed logging to see all cookies present after login
- [x] Check for multiple cookie indicators (not just 'rumbles')
- [x] Reduce monitoring interval for faster detection (1 second)
- [x] Implement broader detection: any non-Cloudflare cookies + URL change
- [x] Test with real Rumble login (WORKING!)
- [ ] Test with real YouTube login
- [x] Ensure popup closes automatically after cookie capture

## CRITICAL BUG: Chat ID Not Extracting for New Videos
- [ ] Debug why chat ID extraction isn't working when adding new videos
- [ ] Check if extractChatIdFromUrl is being called in video creation
- [ ] Test with user's new live stream URL
- [ ] Verify chat ID is saved to database
- [ ] Fix job failures caused by missing chat ID

## Local Development Setup Questions
- [ ] Document how to get OWNER_OPEN_ID, OWNER_NAME, VITE_APP_ID
- [ ] Confirm correct values for OAUTH_SERVER_URL, VITE_OAUTH_PORTAL_URL, BUILT_IN_FORGE_API_URL
- [ ] Explain database setup (Drizzle ORM with PostgreSQL/MySQL)
- [ ] Document how to pull schema to local machine
- [ ] Explain VITE_FRONTEND_FORGE_API_KEY and BUILT_IN_FORGE_API_KEY
- [ ] Document PUPPETEER_EXECUTABLE_PATH setup
- [ ] Clarify if external backend is needed or if it's all-in-one
