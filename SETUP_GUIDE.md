# Comment Bot MVP - Complete Setup & Usage Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Adding Accounts](#adding-accounts)
4. [Adding Videos/Streams](#adding-videosstreams)
5. [Creating Comment Templates](#creating-comment-templates)
6. [Manual Comment Jobs](#manual-comment-jobs)
7. [AI Auto-Comment System](#ai-auto-comment-system)
8. [Local Development](#local-development)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required API Keys
- **OpenAI API Key** - For GPT-4o vision and comment generation
  - Get from: https://platform.openai.com/api-keys
  - Set as: `OPENAI_API_KEY` in environment variables

### System Requirements
- Node.js 22.x (pre-installed on Manus platform)
- pnpm package manager
- Playwright browsers (auto-installed)
- MySQL/TiDB database (auto-provisioned on Manus)

---

## Environment Setup

### On Manus Platform (Recommended)

Most environment variables are **auto-injected** by the Manus platform:
- `DATABASE_URL` - Database connection
- `JWT_SECRET` - Session signing
- `VITE_APP_ID` - OAuth app ID
- `OAUTH_SERVER_URL` - OAuth backend
- `VITE_OAUTH_PORTAL_URL` - OAuth frontend
- `OWNER_OPEN_ID` - Your user ID
- `OWNER_NAME` - Your name

**You only need to add:**
```bash
OPENAI_API_KEY=sk-...your-key-here...
OPEN_AI_BASE_URL=https://api.openai.com  # Optional, defaults to this
```

### Adding Environment Variables on Manus
1. Go to Management UI → Settings → Secrets
2. Click "Add Secret"
3. Enter key name: `OPENAI_API_KEY`
4. Enter your OpenAI API key
5. Click "Save"

---

## Adding Accounts

Accounts are the social media profiles you'll use to post comments.

### Step-by-Step: Add a Rumble Account

1. **Navigate to "Login An Account"** page (sidebar)

2. **Install Cookie-Editor Extension** (one-time setup)
   - Chrome: https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/

3. **Get Your Cookies**
   - Open Rumble.com in a new tab
   - Log in to your Rumble account
   - Click the Cookie-Editor extension icon
   - Click "Export" → "Header String"
   - Cookies are now copied to clipboard

4. **Add Account in Comment Bot**
   - Go back to "Login An Account" page
   - Click "Add Rumble Account"
   - Enter account name (e.g., "MyRumbleAccount1")
   - Paste cookies (Ctrl+V) into the text area
   - System will validate cookies (should show ✅ for `a_s` and `u_s`)
   - Click "Add Account"

5. **Verify Account Added**
   - Go to "Accounts" page
   - You should see your account with a green dot (active)
   - Check expiration date (cookies last ~30 days)

### Adding Multiple Accounts
Repeat the process for each account you want to add. The system will rotate through all active accounts when posting comments.

---

## Adding Videos/Streams

Videos represent the live streams or videos where you want to post comments.

### Step-by-Step: Add a Rumble Stream

1. **Go to "Videos" page** (sidebar)

2. **Click "Add Video"**

3. **Enter Video Details**
   - **Title**: Give it a descriptive name (e.g., "My Daily Stream")
   - **Video URL**: Paste the full Rumble URL
     - Example: `https://rumble.com/v73s6ks-way-out-combat.html`
   - **Platform**: Select "Rumble"
   - **Status**: Select "active" (for live streams you want to monitor)

4. **Click "Add Video"**
   - System will automatically extract the **Chat ID** from the page
   - This uses your stored account cookies to bypass Cloudflare
   - Wait a few seconds for extraction to complete

5. **Verify Chat ID**
   - The video should now show a Chat ID (numeric ID like `425684736`)
   - If Chat ID is missing, the stream might be ended or unavailable
   - You can delete and re-add the video when it's live again

### Important Notes
- **Only add LIVE streams** - Ended streams will cause timeout errors
- **Chat must be enabled** - If chat is disabled, comment posting will fail
- **Re-add videos** if the stream ends and starts again (new chat ID)

---

## Creating Comment Templates

Comment templates are pre-written comments you can use for manual jobs.

### Step-by-Step: Create a Template

1. **Go to "Comments" page** (sidebar)

2. **Click "Add Comment Template"**

3. **Enter Template Details**
   - **Template Name**: Descriptive name (e.g., "Welcome Message")
   - **Comment Text**: The actual comment
     - Example: "Great stream! Love the energy! 🔥"
   - **Platform**: Select "Rumble" (or the platform you're using)

4. **Click "Add Template"**

5. **Create Multiple Templates**
   - Add variety to avoid repetition
   - Examples:
     - "Awesome content! Keep it up! 💪"
     - "This is exactly what I needed to see today!"
     - "Great explanation, very helpful!"

---

## Manual Comment Jobs

Jobs are scheduled tasks that post comments to streams.

### Step-by-Step: Create a Manual Job

1. **Go to "Jobs" page** (sidebar)

2. **Click "Create Job"**

3. **Configure Job**
   - **Video**: Select the stream to comment on
   - **Account**: Select which account to use
   - **Comment Template**: Select a pre-written comment
   - **Schedule**: Choose when to post
     - "Now" - Posts immediately
     - "Custom" - Set a specific date/time
   - **Delay Range** (optional): Add random delay (e.g., 5-15 seconds)

4. **Click "Create Job"**

5. **Monitor Job**
   - Job status will change: `pending` → `processing` → `completed`
   - Check "Logs" page for detailed results
   - Check "Dashboard" for recent activity

### Batch Create Jobs

For posting multiple comments:

1. **Go to "Batch Create" page**

2. **Configure Batch**
   - **Video**: Select target stream
   - **Accounts**: Select multiple accounts (will rotate)
   - **Templates**: Select multiple templates (will rotate)
   - **Number of Jobs**: How many comments to post
   - **Time Range**: Spread comments over X minutes

3. **Click "Create Batch"**
   - System creates multiple jobs with staggered timing
   - Accounts and templates are rotated automatically

---

## AI Auto-Comment System

The AI system automatically generates contextual comments based on what's happening in the stream.

### Step-by-Step: Start AI Monitoring

1. **Prerequisites**
   - At least 1 active account added
   - At least 1 active video with valid Chat ID
   - OpenAI API key configured

2. **Go to "AI Auto-Comment" page** (sidebar)

3. **Select Video**
   - Choose the stream you want to monitor
   - Must have a valid Chat ID
   - Stream must be LIVE

4. **Configure AI Settings**
   
   **Comment Style**: Choose personality
   - **Engaging**: Enthusiastic reactions, questions, genuine interest
   - **Supportive**: Positive, encouraging, community-building
   - **Curious**: Thoughtful questions about content
   - **Casual**: Relaxed, conversational, like chatting with friends
   - **Professional**: Informative and respectful, adds value

   **Comment Interval**: How often to post
   - Minimum: 30 seconds
   - Maximum: 5 minutes (300 seconds)
   - Recommended: 60-120 seconds (avoid spam)

   **Max Comment Length**: Character limit
   - Range: 50-300 characters
   - Recommended: 150 characters

   **Include Emojis**: Toggle on/off
   - On: Natural emoji usage
   - Off: Text only

5. **Select Accounts**
   - Check the boxes for accounts you want to use
   - System will rotate through selected accounts
   - Only accounts matching the video's platform are shown

6. **Preview Comment (Optional)**
   - Click "Generate Preview" to test AI
   - System will:
     - Take a screenshot of the stream
     - Analyze it with GPT-4o vision
     - Generate a sample comment
   - Review the preview to see if style is appropriate

7. **Start Monitoring**
   - Click "Start AI Monitoring"
   - System will:
     - Launch a headless browser
     - Navigate to the stream
     - Take screenshots every interval
     - Analyze with GPT-4o vision
     - Generate contextual comments
     - Post using selected accounts (rotating)

8. **Monitor Progress**
   - **Active Monitoring Sessions** card shows:
     - Session status (running/paused/stopped)
     - Comments posted count
     - Last comment posted
     - Any errors
   - **Dashboard** shows recent activity
   - **Logs** page shows detailed activity

9. **Control Monitoring**
   - **Pause**: Temporarily stop posting (keeps browser open)
   - **Resume**: Continue posting after pause
   - **Stop**: End monitoring session (closes browser)

### How AI Comment Generation Works

1. **Screenshot Capture**
   - Playwright browser navigates to stream URL
   - Takes a screenshot every X seconds (based on interval)

2. **Visual Analysis**
   - Screenshot sent to GPT-4o vision API
   - AI analyzes: stream content, chat activity, visual elements
   - Generates description of what's happening

3. **Comment Generation**
   - AI uses visual analysis + selected style
   - Generates natural, contextual comment
   - Avoids repetition (remembers previous comments)
   - Respects character limit and emoji settings

4. **Comment Posting**
   - System creates a job for the generated comment
   - Job queue picks it up
   - Posts using next account in rotation
   - Logs success/failure

### Best Practices

- **Start with Preview** - Always test preview first
- **Monitor Closely** - Watch the first few comments to ensure quality
- **Adjust Interval** - Don't spam (60+ seconds recommended)
- **Use Multiple Accounts** - Rotate to avoid detection
- **Match Stream Content** - Choose appropriate comment style
- **Stop When Stream Ends** - AI will timeout if stream ends

---

## Local Development

### Why Local Development is Tricky

The project uses **Manus OAuth** for authentication, which only works on the Manus platform. Running locally requires either:
- Mocking authentication (bypass login)
- Or using the deployed version for testing

### Option 1: Mock Authentication (Coming Soon)

I can add a local dev mode that bypasses authentication. Let me know if you need this.

### Option 2: Use Deployed Version

**Recommended**: Just use the deployed version on Manus for development and testing. It's already working and has all the environment variables configured.

### If You Must Run Locally

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd comment-bot-mvp
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Install Playwright browsers**
   ```bash
   pnpm exec playwright install chromium
   ```

4. **Create `.env` file**
   ```bash
   # Database
   DATABASE_URL=mysql://user:password@localhost:3306/comment_bot

   # OpenAI
   OPENAI_API_KEY=sk-...your-key...
   OPEN_AI_BASE_URL=https://api.openai.com

   # Manus OAuth (won't work locally without Manus platform)
   VITE_APP_ID=your_app_id
   OAUTH_SERVER_URL=https://api.manus.im
   VITE_OAUTH_PORTAL_URL=https://manus.im/oauth
   JWT_SECRET=your_jwt_secret
   OWNER_OPEN_ID=your_owner_id
   OWNER_NAME=Your Name

   # Optional
   MOCK_AUTOMATION=false
   ```

5. **Push database schema**
   ```bash
   pnpm db:push
   ```

6. **Run development server**
   ```bash
   pnpm dev
   ```

7. **Access at** http://localhost:3000

**Note**: Authentication won't work locally unless you add a mock auth bypass.

---

## Troubleshooting

### Common Errors

#### 1. "Timeout 30000ms exceeded" when adding video

**Cause**: Stream has ended or is not currently live

**Solution**:
- Only add videos for LIVE streams
- If stream ended, wait for next stream and add new URL
- Or increase timeout (not recommended)

#### 2. "Chat is disabled" or "CHAT_NOT_FOUND"

**Cause**: Rumble chat is disabled for this stream

**Solution**:
- Enable chat on your Rumble stream settings
- Or choose a different stream that has chat enabled

#### 3. "HTTP 409: Please verify your Rumble account first"

**Cause**: Account cookies are invalid or expired

**Solution**:
- Go to "Accounts" page
- Click "Edit" on the account
- Get fresh cookies from Rumble (using Cookie-Editor)
- Paste new cookies and save

#### 4. "Executable doesn't exist" (Playwright)

**Cause**: Playwright browsers not installed

**Solution**:
```bash
cd /home/ubuntu/comment-bot-mvp
pnpm exec playwright install chromium
```

#### 5. "No auth indicators found" when adding account

**Cause**: Cookies don't contain required auth tokens (`a_s`, `u_s`)

**Solution**:
- Make sure you're logged in to Rumble
- Use Cookie-Editor extension (not DevTools)
- Export as "Header String" format
- Copy ALL cookies (should be 500+ characters)

#### 6. AI comments are repetitive

**Cause**: AI is generating similar comments

**Solution**:
- Increase comment interval (more time between comments)
- Change comment style
- Stop and restart monitoring (clears previous comment history)

#### 7. Database connection errors (ECONNRESET)

**Cause**: Database connection lost (usually temporary)

**Solution**:
- Wait a few seconds, system will auto-reconnect
- If persistent, restart the server

### Getting Help

1. **Check Logs Page** - Most errors are logged with details
2. **Check Dashboard** - Shows recent activity and failures
3. **Check Server Logs** - In Manus Management UI
4. **Contact Support** - If issue persists

---

## Quick Start Checklist

- [ ] Add OpenAI API key to environment variables
- [ ] Install Cookie-Editor browser extension
- [ ] Add at least 1 Rumble account (with cookies)
- [ ] Add at least 1 live stream video
- [ ] Verify video has Chat ID
- [ ] Create a few comment templates (for manual jobs)
- [ ] Test manual job creation and posting
- [ ] Test AI Auto-Comment preview
- [ ] Start AI monitoring on a live stream
- [ ] Monitor logs and dashboard for activity
- [ ] Adjust settings based on results

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │ Accounts │  │  Videos  │  │   Jobs   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ Comments │  │   Logs   │  │ AI Auto  │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ tRPC API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Express)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   tRPC Routers                        │  │
│  │  • accounts  • videos  • comments  • jobs  • logs    │  │
│  │  • aiComment (start/stop/pause/preview)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┼──────────────────────────────┐ │
│  │        Automation Services                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ Job Queue    │  │ Stream       │  │ AI Comment │ │ │
│  │  │ Processor    │  │ Monitor      │  │ Generator  │ │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  │  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │ Direct       │  │ Chat ID      │                 │ │
│  │  │ Rumble API   │  │ Extractor    │                 │ │
│  │  └──────────────┘  └──────────────┘                 │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   MySQL/     │  │   OpenAI     │  │  Playwright  │     │
│  │   TiDB       │  │   GPT-4o     │  │  Chromium    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │   Rumble     │  │    Manus     │                       │
│  │   API        │  │    OAuth     │                       │
│  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **Job Queue** - Processes pending comment jobs in background
2. **Stream Monitor** - Captures screenshots and coordinates AI comments
3. **AI Comment Generator** - Uses GPT-4o vision to generate contextual comments
4. **Direct Rumble API** - Posts comments directly to Rumble chat
5. **Chat ID Extractor** - Extracts numeric chat IDs from Rumble pages

---

## Support

For issues or questions:
- Check this guide first
- Review the logs in the app
- Contact the development team
- Submit issues on GitHub (if available)

---

**Last Updated**: January 2026
**Version**: 1.0.0
