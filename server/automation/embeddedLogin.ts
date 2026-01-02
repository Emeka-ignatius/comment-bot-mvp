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
    console.log('[EmbeddedLogin] Initializing login session for:', platform);
    
    // Launch browser in headless mode
    // Try to find Chrome in multiple locations
    const possiblePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/home/ubuntu/.cache/puppeteer/chrome/linux-143.0.7499.169/chrome-linux64/chrome',
      '/root/.cache/puppeteer/chrome/linux-143.0.7499.169/chrome-linux64/chrome',
    ].filter(Boolean);

    console.log('[EmbeddedLogin] Checking Chrome paths:', possiblePaths);

    let executablePath: string | undefined;
    const fs = await import('fs');
    for (const path of possiblePaths) {
      console.log(`[EmbeddedLogin] Checking path: ${path}`);
      if (path && fs.existsSync(path)) {
        executablePath = path;
        console.log(`[EmbeddedLogin] ✅ Found Chrome at: ${path}`);
        break;
      } else {
        console.log(`[EmbeddedLogin] ❌ Not found at: ${path}`);
      }
    }

    if (!executablePath) {
      console.error('[EmbeddedLogin] ⚠️  No Chrome executable found in any path!');
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

    // Create incognito browser context (fresh session, no existing cookies)
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    console.log('[EmbeddedLogin] Created fresh incognito browser context');

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
  let lastUrl = page.url();
  let checkCount = 0;

  try {
    // Wait for login completion by checking URL changes
    const checkInterval = setInterval(async () => {
      const currentSession = activeSessions.get(sessionId);
      if (!currentSession || currentSession.status !== 'waiting') {
        clearInterval(checkInterval);
        return;
      }

      checkCount++;
      try {
        const currentUrl = page.url();
        const cookies = await page.cookies();
        
        // Log ALL cookie details for debugging
        console.log(`\n[EmbeddedLogin] === Check #${checkCount} ===`);
        console.log(`[EmbeddedLogin] Current URL: ${currentUrl}`);
        console.log(`[EmbeddedLogin] Total cookies: ${cookies.length}`);
        
        if (cookies.length > 0) {
          console.log('[EmbeddedLogin] Cookie details:');
          cookies.forEach((c, idx) => {
            const valuePreview = c.value.substring(0, 50) + (c.value.length > 50 ? '...' : '');
            console.log(`  [${idx + 1}] ${c.name} = ${valuePreview}`);
            console.log(`      Domain: ${c.domain}, Path: ${c.path}, Secure: ${c.secure}, HttpOnly: ${c.httpOnly}`);
          });
        }
        
        // Check for URL change (indicates navigation after login)
        const urlChanged = currentUrl !== lastUrl;
        if (urlChanged) {
          console.log(`[EmbeddedLogin] ✅ URL changed from: ${lastUrl} to: ${currentUrl}`);
          lastUrl = currentUrl;
        }
        
        // Check for login indicators
        let isLoggedIn = false;
        let detectionReason = '';
        
        if (platform === 'rumble') {
          // Strategy: Detect login by combination of cookies + URL change
          // After successful login, Rumble will:
          // 1. Set authentication cookies (we don't know exact names)
          // 2. Redirect away from /signin page
          
          // Filter out Cloudflare cookies (they're always present)
          const nonCloudflareCookies = cookies.filter(c => 
            !c.name.startsWith('__cf') && 
            !c.name.startsWith('_cf')
          );
          
          console.log(`[EmbeddedLogin] Non-Cloudflare cookies: ${nonCloudflareCookies.length}`);
          if (nonCloudflareCookies.length > 0) {
            console.log(`[EmbeddedLogin] Cookie names: ${nonCloudflareCookies.map(c => c.name).join(', ')}`);
          }
          
          // Check if we have meaningful cookies AND we're not on signin page
          if (nonCloudflareCookies.length > 0 && !currentUrl.includes('/signin')) {
            console.log(`[EmbeddedLogin] ✅ Login detected: ${nonCloudflareCookies.length} cookies + not on signin page`);
            isLoggedIn = true;
            detectionReason = `${nonCloudflareCookies.length} cookies set, URL: ${currentUrl}`;
          }
          
          // Alternative: Check for specific URL patterns that indicate logged-in state
          if (!isLoggedIn && (currentUrl.includes('/account') || currentUrl === 'https://rumble.com/')) {
            if (nonCloudflareCookies.length > 0) {
              console.log(`[EmbeddedLogin] ✅ Login detected: On logged-in page with cookies`);
              isLoggedIn = true;
              detectionReason = `logged-in URL (${currentUrl}) with ${nonCloudflareCookies.length} cookies`;
            }
          }
        } else if (platform === 'youtube') {
          const authCookies = cookies.filter(c => 
            (c.name === 'SID' || c.name === 'SSID' || c.name === 'LOGIN_INFO' || c.name === 'NID') && 
            c.value.length > 10
          );
          
          if (authCookies.length > 0) {
            isLoggedIn = true;
            detectionReason = `YouTube auth cookies: ${authCookies.map(c => c.name).join(', ')}`;
          }
        }
        
        console.log(`[EmbeddedLogin] Login status: ${isLoggedIn ? '✅ LOGGED IN' : '⏳ WAITING'} (${detectionReason || 'no auth indicators'})`);

        if (isLoggedIn) {
          console.log(`[EmbeddedLogin] 🎉 Login detected! Capturing cookies...`);
          clearInterval(checkInterval);
          await captureSessionCookies(sessionId);
        }
      } catch (error) {
        console.error('[EmbeddedLogin] Error checking login status:', error);
      }
    }, 1000); // Check every 1 second for faster detection
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
    // Get cookies from ALL relevant domains for the platform
    let allCookies: any[] = [];
    
    if (session.platform === 'rumble') {
      // Get cookies from all Rumble domains
      const rumbleDomains = [
        'https://rumble.com',
        'https://www.rumble.com',
        'https://web7.rumble.com',
        'https://api.rumble.com',
      ];
      
      for (const domain of rumbleDomains) {
        try {
          const domainCookies = await session.page.cookies(domain);
          console.log(`[EmbeddedLogin] Cookies from ${domain}: ${domainCookies.length}`);
          allCookies.push(...domainCookies);
        } catch (e) {
          // Ignore errors for domains that don't have cookies
        }
      }
      
      // Also get cookies from current page
      const pageCookies = await session.page.cookies();
      allCookies.push(...pageCookies);
      
    } else if (session.platform === 'youtube') {
      // Get cookies from all Google/YouTube domains
      const googleDomains = [
        'https://youtube.com',
        'https://www.youtube.com',
        'https://accounts.google.com',
        'https://google.com',
        'https://www.google.com',
      ];
      
      for (const domain of googleDomains) {
        try {
          const domainCookies = await session.page.cookies(domain);
          console.log(`[EmbeddedLogin] Cookies from ${domain}: ${domainCookies.length}`);
          allCookies.push(...domainCookies);
        } catch (e) {
          // Ignore errors for domains that don't have cookies
        }
      }
      
      // Also get cookies from current page
      const pageCookies = await session.page.cookies();
      allCookies.push(...pageCookies);
    } else {
      allCookies = await session.page.cookies();
    }
    
    // Deduplicate cookies by name (keep the most recent/longest value)
    const cookieMap = new Map<string, any>();
    for (const cookie of allCookies) {
      const existing = cookieMap.get(cookie.name);
      if (!existing || cookie.value.length > existing.value.length) {
        cookieMap.set(cookie.name, cookie);
      }
    }
    const uniqueCookies = Array.from(cookieMap.values());

    console.log(`[EmbeddedLogin] === FINAL COOKIE CAPTURE ===`);
    console.log(`[EmbeddedLogin] Total unique cookies to save: ${uniqueCookies.length}`);
    uniqueCookies.forEach((c, idx) => {
      const valuePreview = c.value.substring(0, 50) + (c.value.length > 50 ? '...' : '');
      console.log(`  [${idx + 1}] ${c.name} = ${valuePreview} (domain: ${c.domain})`);
    });

    // Format cookies as string (name=value; name2=value2)
    const cookieString = uniqueCookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    session.cookies = cookieString;
    session.status = 'logged_in';

    console.log(`[EmbeddedLogin] ✅ Cookies captured successfully for session ${sessionId}`);
    console.log(`[EmbeddedLogin] Cookie string length: ${cookieString.length} characters`);

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
