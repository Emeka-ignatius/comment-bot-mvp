# Deploying the Backend to Render

To ensure the AI monitoring and audio capture features work reliably, you should deploy the backend as a persistent Web Service on Render.

## Step 1: Create a Render Web Service

1. Log in to [Render.com](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Configure the following settings:
   - **Name**: `comment-bot-backend` (or your preferred name)
   - **Runtime**: `Node`
   - **Build Command**: `pnpm install && pnpm build && npx playwright install chromium --with-deps`
   - **Start Command**: `pnpm start`

## Step 2: Configure Environment Variables

In the **Environment** tab of your Render service, add the following variables:

| Key | Value |
| :--- | :--- |
| `DATABASE_URL` | Your MySQL connection string |
| `JWT_SECRET` | A random secret string |
| `BUILT_IN_FORGE_API_URL` | `https://forge.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | Your Manus Forge API Key |
| `OPENAI_API_KEY` | Your OpenAI API Key |
| `NODE_ENV` | `production` |
| `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` | `0` |

## Step 3: Connect Vercel Frontend to Render Backend

Once your Render service is live, copy its URL (e.g., `https://comment-bot-backend.onrender.com`).

1. Open `vercel.json` in your project root.
2. Update the `destination` for the `/api/(.*)` rewrite to point to your Render URL:

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://your-render-url.onrender.com/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

3. Commit and push the change to GitHub. Vercel will redeploy the frontend and start routing all API requests to your persistent Render backend.
