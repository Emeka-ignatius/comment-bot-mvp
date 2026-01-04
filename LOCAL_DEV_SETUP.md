# Local Development Setup Guide

This guide explains how to run the Comment Bot MVP project on your local machine.

## Why Local Development is Tricky

The project uses **Manus OAuth** for authentication, which only works on the Manus platform. To run locally, we've added a **Local Dev Mode** that bypasses OAuth and creates a mock admin user.

---

## Prerequisites

1. **Node.js 22.x** - Download from https://nodejs.org/
2. **pnpm** - Install with `npm install -g pnpm`
3. **MySQL or TiDB** - Local database server
4. **OpenAI API Key** - Get from https://platform.openai.com/api-keys

---

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd comment-bot-mvp
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Install Playwright Browsers

```bash
pnpm exec playwright install chromium
```

### 4. Setup Database

Create a MySQL/TiDB database:

```sql
CREATE DATABASE comment_bot;
```

### 5. Create `.env` File

Create a `.env` file in the project root with the following:

```bash
# Database
DATABASE_URL=mysql://root:password@localhost:3306/comment_bot

# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key-here
OPEN_AI_BASE_URL=https://api.openai.com

# Local Development Mode (IMPORTANT!)
LOCAL_DEV_MODE=true

# Optional: Mock automation for testing
MOCK_AUTOMATION=false
```

**Important**: Set `LOCAL_DEV_MODE=true` to bypass Manus OAuth and use a mock admin user.

### 6. Push Database Schema

```bash
pnpm db:push
```

This creates all the necessary tables in your database.

### 7. Run Development Server

```bash
pnpm dev
```

The server will start on http://localhost:3000

### 8. Access the App

Open your browser and go to:
```
http://localhost:3000
```

You'll be automatically logged in as **"Local Dev User"** (admin role) because `LOCAL_DEV_MODE=true`.

---

## Local Dev Mode Explained

When `LOCAL_DEV_MODE=true`:

- **Authentication is bypassed** - No need for Manus OAuth
- **Mock admin user is created** automatically:
  - Name: "Local Dev User"
  - Email: "dev@localhost"
  - Role: admin
  - ID: 1

- **All features work** - You can add accounts, videos, create jobs, use AI auto-comment, etc.

- **Database is local** - All data stays on your machine

---

## Environment Variables Reference

### Required for Local Dev

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string | `mysql://root:password@localhost:3306/comment_bot` |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o | `sk-...` |
| `LOCAL_DEV_MODE` | Enable local dev auth bypass | `true` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OPEN_AI_BASE_URL` | OpenAI API base URL | `https://api.openai.com` |
| `MOCK_AUTOMATION` | Mock comment posting (no real API calls) | `false` |

### Not Needed Locally

These are auto-injected on Manus platform, not needed for local dev:

- `VITE_APP_ID`
- `OAUTH_SERVER_URL`
- `VITE_OAUTH_PORTAL_URL`
- `JWT_SECRET`
- `OWNER_OPEN_ID`
- `OWNER_NAME`
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

---

## Troubleshooting

### "Cannot connect to database"

- Make sure MySQL/TiDB is running
- Check `DATABASE_URL` in `.env` is correct
- Try connecting with a MySQL client to verify credentials

### "OPENAI_API_KEY is required"

- Make sure you've added your OpenAI API key to `.env`
- Get a key from https://platform.openai.com/api-keys

### "Playwright browser not found"

```bash
pnpm exec playwright install chromium
```

### Still showing login page

- Make sure `LOCAL_DEV_MODE=true` is in your `.env` file
- Restart the development server after changing `.env`
- Check server logs for `[Context] Using local dev user`

### Port 3000 already in use

Change the port in `server/_core/index.ts` or kill the process using port 3000:

```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

---

## Testing

Run tests:

```bash
pnpm test
```

Run specific test file:

```bash
pnpm vitest run server/auth.logout.test.ts
```

---

## Database Management

### View database schema

```bash
pnpm drizzle-kit studio
```

This opens a web UI at http://localhost:4983 to browse your database.

### Reset database

```bash
# Drop all tables and recreate
pnpm db:push --force
```

### Pull schema from existing database

```bash
pnpm drizzle-kit pull
```

---

## Production Deployment

**DO NOT use `LOCAL_DEV_MODE=true` in production!**

For production deployment on Manus platform:
1. Remove `LOCAL_DEV_MODE` from environment variables
2. Let Manus auto-inject all OAuth and system variables
3. Only add `OPENAI_API_KEY` manually

---

## Differences: Local vs Manus Platform

| Feature | Local Dev | Manus Platform |
|---------|-----------|----------------|
| Authentication | Mock user (bypassed) | Manus OAuth |
| Database | Local MySQL/TiDB | Managed TiDB |
| Environment Variables | Manual `.env` file | Auto-injected |
| Deployment | Manual `pnpm dev` | Automatic |
| HTTPS | No (http://localhost) | Yes (https://) |
| Domain | localhost:3000 | *.manus.space |

---

## Next Steps

After setup:
1. Follow the main [SETUP_GUIDE.md](./SETUP_GUIDE.md) for using the app
2. Add Rumble accounts using Cookie-Editor extension
3. Add live stream videos
4. Test AI Auto-Comment system

---

## Support

For issues:
- Check server logs in terminal
- Check browser console for errors
- Review [SETUP_GUIDE.md](./SETUP_GUIDE.md) for usage instructions
- Contact the development team

---

**Last Updated**: January 2026
