# Manus Dependencies Removed

This document summarizes the changes made to remove Manus dependencies from the project.

## Changes Made

### 1. Authentication System
- **Removed**: Manus OAuth authentication
- **Replaced with**: Simple JWT-based authentication
- **New endpoint**: `POST /api/auth/login` - Creates a user and session
- **Files changed**:
  - `server/_core/sdk.ts` - Simplified to use only JWT, removed OAuth service
  - `server/_core/oauth.ts` - Replaced OAuth callback with simple login endpoint
  - `server/_core/context.ts` - Already had local dev mode support
  - `client/src/const.ts` - Updated login URL to `/login`
  - `client/src/_core/hooks/useAuth.ts` - Removed Manus-specific localStorage **key**

### 2. OpenAI API Integration
- **Removed**: Manus Forge API proxy
- **Replaced with**: Direct OpenAI API calls
- **Files changed**:
  - `server/_core/llm.ts` - Now uses `OPENAI_API_KEY` and `OPEN_AI_BASE_URL` directly
  - `server/_core/voiceTranscription.ts` - Now uses OpenAI Whisper API directly

### 3. Environment Variables
- **Removed**:
  - `VITE_APP_ID`
  - `OAUTH_SERVER_URL`
  - `VITE_OAUTH_PORTAL_URL`
  - `OWNER_OPEN_ID`
  - `OWNER_NAME`
  - `BUILT_IN_FORGE_API_URL`
  - `BUILT_IN_FORGE_API_KEY`
  - `VITE_FRONTEND_FORGE_API_URL`
  - `VITE_FRONTEND_FORGE_API_KEY`
- **Kept**:
  - `DATABASE_URL` - Still required
  - `JWT_SECRET` - Still required for session signing
  - `OPENAI_API_KEY` - Now used directly (was via Forge)
  - `OPEN_AI_BASE_URL` - Defaults to `https://api.openai.com`
  - `LOCAL_DEV_MODE` - Still supported
  - `MOCK_AUTOMATION` - Still supported

### 4. Vite Configuration
- **Removed**: `vite-plugin-manus-runtime` plugin
- **Removed**: Manus-specific allowed hosts
- **Files changed**:
  - `vite.config.ts` - Removed plugin import and usage
  - `package.json` - Removed `vite-plugin-manus-runtime` dependency

### 5. Stubbed Services
The following services were stubbed out (they throw errors or return false):
- **Image Generation** (`server/_core/imageGeneration.ts`) - Would need OpenAI DALL-E or similar
- **Notifications** (`server/_core/notification.ts`) - Would need email/SMS/Slack integration
- **Data API** (`server/_core/dataApi.ts`) - Would need direct API integrations
- **Maps** (`server/_core/map.ts`) - Updated to use `GOOGLE_MAPS_API_KEY` if needed

## Required Environment Variables

Your `.env` file should now only need:

```bash
# Database
DATABASE_URL=mysql://user:password@localhost:3306/comment_bot

# JWT Secret (for session signing)
JWT_SECRET=KWaID11Zgi6RBXyZ4wZHWZaGyd/zukGfOnGK0xY3M38=

# OpenAI API (direct, not via Forge)
OPENAI_API_KEY=sk-your-openai-api-key-here
OPEN_AI_BASE_URL=https://api.openai.com

# Local Development Mode
LOCAL_DEV_MODE=false

# Optional
MOCK_AUTOMATION=false
```

## Authentication Flow

### Before (Manus OAuth)
1. User clicks "Login with Manus"
2. Redirects to Manus OAuth portal
3. User authenticates
4. Redirects back with code
5. Server exchanges code for token
6. Server gets user info from Manus
7. Creates session

### After (Simple JWT)
1. User provides name (and optionally email)
2. POST to `/api/auth/login` with `{ name: "John Doe", email: "john@example.com" }`
3. Server creates/updates user in database
4. Server creates JWT session token
5. Server sets cookie
6. User is authenticated

**Note**: In `LOCAL_DEV_MODE=true`, authentication is automatically bypassed and a mock user is used.

## Next Steps

1. **Update your `.env` file** - Remove all Manus-related variables
2. **Install dependencies** - Run `pnpm install` to remove the Manus plugin
3. **Test the application** - Run `pnpm dev` and verify everything works
4. **Implement proper authentication** (optional) - Add email/password or OAuth provider if needed
5. **Implement stubbed services** (optional) - Add image generation, notifications, etc. if needed

## Breaking Changes

- OAuth callback endpoint (`/api/oauth/callback`) now returns an error instead of processing OAuth
- Any code that relied on Manus Forge API will need to be updated
- Frontend login flow needs to be updated to use the new `/api/auth/login` endpoint

## Files Modified

- `server/_core/env.ts`
- `server/_core/sdk.ts`
- `server/_core/oauth.ts`
- `server/_core/llm.ts`
- `server/_core/voiceTranscription.ts`
- `server/_core/imageGeneration.ts`
- `server/_core/notification.ts`
- `server/_core/dataApi.ts`
- `server/_core/map.ts`
- `server/_core/index.ts`
- `vite.config.ts`
- `package.json`
- `client/src/const.ts`
- `client/src/_core/hooks/useAuth.ts`
