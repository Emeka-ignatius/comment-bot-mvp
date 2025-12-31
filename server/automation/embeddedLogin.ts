import puppeteer, { Browser, Page } from 'puppeteer';

interface LoginSession {
  sessionId: string;
  platform: 'rumble' | 'youtube';
  browser: Browser;
  page: Page;
  status: 'waiting' | 'logged_in' | 'error' | 'timeout';
  cookies: string | null;
  error: string | null;
  createdAt: Date;
}

// Store active login sessions
const activeSessions = new Map<string, LoginSession>();

// Session timeout: 5 minutes
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Initialize a new login session
 */
export async function initializeLoginSession(platform: 'rumble' | 'youtube'): Promise<{
  sessionId: string;
  loginUrl: string;
}> {
  const sessionId = generateSessionId();

  try {
    // Launch browser in headless mode
    // Try to find Chrome in multiple locations
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/home/ubuntu/.cache/puppeteer/chrome/linux-143.0.7499.169/chrome-linux64/chrome',
      '/root/.cache/puppeteer/chrome/linux-143.0.7499.169/chrome-linux64/chrome',
    ].filter(Boolean);

    let executablePath: string | undefined;
    const fs = await import('fs');
    for (const path of possiblePaths) {
      if (path && fs.existsSync(path)) {
        executablePath = path;
        console.log(`[EmbeddedLogin] Using Chrome at: ${path}`);
        break;
      }
    }

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to login page
    const loginUrls = {
      rumble: 'https://rumble.com/account/signin',
      youtube: 'https://accounts.google.com/signin',
    };

    const loginUrl = loginUrls[platform];
    await page.goto(loginUrl, { waitUntil: 'networkidle2' });

    // Create session
    const session: LoginSession = {
      sessionId,
      platform,
      browser,
      page,
      status: 'waiting',
      cookies: null,
      error: null,
      createdAt: new Date(),
    };

    activeSessions.set(sessionId, session);

    // Start monitoring for login completion
    monitorLoginSession(sessionId);

    // Set timeout to cleanup session
    setTimeout(() => {
      cleanupSession(sessionId, 'timeout');
    }, SESSION_TIMEOUT_MS);

    return { sessionId, loginUrl };
  } catch (error: any) {
    console.error('[EmbeddedLogin] Failed to initialize session:', error);
    throw new Error(`Failed to initialize login session: ${error.message}`);
  }
}

/**
 * Monitor login session for completion
 */
async function monitorLoginSession(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { page, platform } = session;

  try {
    // Wait for login completion by checking URL changes
    const checkInterval = setInterval(async () => {
      const currentSession = activeSessions.get(sessionId);
      if (!currentSession || currentSession.status !== 'waiting') {
        clearInterval(checkInterval);
        return;
      }

      try {
        const currentUrl = page.url();

        // Check if user has logged in successfully
        const isLoggedIn =
          platform === 'rumble'
            ? !currentUrl.includes('/account/signin') && currentUrl.includes('rumble.com')
            : !currentUrl.includes('accounts.google.com/signin') && currentUrl.includes('youtube.com');

        if (isLoggedIn) {
          clearInterval(checkInterval);
          await captureSessionCookies(sessionId);
        }
      } catch (error) {
        console.error('[EmbeddedLogin] Error checking login status:', error);
      }
    }, 2000); // Check every 2 seconds
  } catch (error: any) {
    console.error('[EmbeddedLogin] Error monitoring session:', error);
    session.status = 'error';
    session.error = error.message;
  }
}

/**
 * Capture cookies from the session
 */
async function captureSessionCookies(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    const cookies = await session.page.cookies();

    // Format cookies as string (name=value; name2=value2)
    const cookieString = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    session.cookies = cookieString;
    session.status = 'logged_in';

    console.log(`[EmbeddedLogin] Cookies captured for session ${sessionId}`);

    // Close browser after capturing cookies
    setTimeout(() => {
      cleanupSession(sessionId, 'success');
    }, 2000);
  } catch (error: any) {
    console.error('[EmbeddedLogin] Error capturing cookies:', error);
    session.status = 'error';
    session.error = error.message;
  }
}

/**
 * Get session status
 */
export function getSessionStatus(sessionId: string): {
  status: 'waiting' | 'logged_in' | 'error' | 'timeout' | 'not_found';
  cookies: string | null;
  error: string | null;
} {
  const session = activeSessions.get(sessionId);

  if (!session) {
    return { status: 'not_found', cookies: null, error: 'Session not found' };
  }

  return {
    status: session.status,
    cookies: session.cookies,
    error: session.error,
  };
}

/**
 * Cleanup session
 */
async function cleanupSession(sessionId: string, reason: 'success' | 'timeout' | 'error') {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    await session.browser.close();
  } catch (error) {
    console.error('[EmbeddedLogin] Error closing browser:', error);
  }

  if (reason === 'timeout' && session.status === 'waiting') {
    session.status = 'timeout';
    session.error = 'Login session timed out';
  }

  // Keep session in memory for 1 minute for status retrieval
  setTimeout(() => {
    activeSessions.delete(sessionId);
  }, 60000);

  console.log(`[EmbeddedLogin] Session ${sessionId} cleaned up (${reason})`);
}

/**
 * Cancel a login session
 */
export async function cancelLoginSession(sessionId: string): Promise<void> {
  await cleanupSession(sessionId, 'error');
}

/**
 * Get screenshot of current login page (for debugging)
 */
export async function getSessionScreenshot(sessionId: string): Promise<any> {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  try {
    return await session.page.screenshot({ type: 'png' });
  } catch (error) {
    console.error('[EmbeddedLogin] Error taking screenshot:', error);
    return null;
  }
}
