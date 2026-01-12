import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, BrowserContext, Page } from 'playwright';

// Add stealth plugin to bypass Cloudflare detection
chromium.use(StealthPlugin());

/**
 * Parse raw cookie string from browser dev tools into Playwright cookie format
 */
function parseCookieString(cookieString: string, domain: string = '.rumble.com'): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}> {
  const cookies = [];
  const pairs = cookieString.split(';').map(pair => pair.trim());
  
  for (const pair of pairs) {
    const [name, ...valueParts] = pair.split('=');
    const value = valueParts.join('='); // Handle values with '=' in them
    
    if (name && value) {
      cookies.push({
        name: name.trim(),
        value: value.trim(),
        domain,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year from now
        httpOnly: false,
        secure: true,
        sameSite: 'None' as const,
      });
    }
  }
  
  return cookies;
}

/**
 * Add human-like delay between actions
 */
async function humanDelay(page: Page, min: number = 1000, max: number = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

/**
 * Type text with human-like speed (25ms per character like rumble-selfbot-api)
 */
async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await page.waitForTimeout(500); // Wait after click
  
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(25); // 25ms delay between keystrokes
  }
}

/**
 * Post a comment on a Rumble video (live stream or normal video)
 * Uses playwright-extra with stealth plugin to bypass Cloudflare
 */
export async function postRumbleComment(
  videoUrl: string,
  comment: string,
  cookieString: string,
  options: {
    headless?: boolean;
    timeout?: number;
    proxy?: string; // Format: protocol://user:pass@host:port
  } = {}
): Promise<{ success: boolean; error?: string; isLive?: boolean }> {
  const { headless = true, timeout = 30000, proxy } = options;
  
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  
  try {
    console.log('[Rumble] Launching browser with stealth plugin...');
    browser = await chromium.launch({
      headless,
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
    
    console.log('[Rumble] Creating browser context...');
    
    let proxyConfig;
    if (proxy) {
      try {
        const url = new URL(proxy);
        proxyConfig = {
          server: `${url.protocol}//${url.host}`,
          username: url.username || undefined,
          password: url.password || undefined,
        };
        console.log(`[Rumble] Using proxy: ${url.protocol}//${url.host}`);
      } catch (e) {
        console.warn(`[Rumble] Invalid proxy URL: ${proxy}`);
      }
    }

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      proxy: proxyConfig,
    });
    
    // Parse and inject cookies
    console.log('[Rumble] Injecting cookies...');
    const cookies = parseCookieString(cookieString);
    await context.addCookies(cookies);
    
    const page = await context.newPage();
    
    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
    
    console.log(`[Rumble] Navigating to: ${videoUrl}`);
    await page.goto(videoUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log('[Rumble] Page loaded, waiting for content...');
    await humanDelay(page, 3000, 5000);
    
    // Take screenshot for debugging
    const screenshotPath = '/tmp/rumble-stealth-debug.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[Rumble] Screenshot saved to: ${screenshotPath}`);
    
    // Try to detect if it's a live stream by checking for live chat elements
    console.log('[Rumble] Detecting video type (live stream vs normal video)...');
    
    let isLive = false;
    let inputSelector: string | null = null;
    let sendButtonSelector: string | null = null;
    
    // Check for live chat input (live streams)
    const liveChatInput = await page.locator('#chat-message-text-input').count();
    if (liveChatInput > 0) {
      console.log('[Rumble] Detected LIVE STREAM - using live chat selectors');
      isLive = true;
      inputSelector = '#chat-message-text-input';
      sendButtonSelector = 'button[type="submit"]'; // The send button in live chat
    } else {
      // Check for normal comment textarea
      const normalCommentInput = await page.locator('.comments-create-textarea').count();
      if (normalCommentInput > 0) {
        console.log('[Rumble] Detected NORMAL VIDEO - using comment selectors');
        inputSelector = '.comments-create-textarea';
        sendButtonSelector = '.comments-add-comment';
      }
    }
    
    if (!inputSelector) {
      throw new Error('Could not find any comment input field. Check screenshot at ' + screenshotPath);
    }
    
    // Wait for the input to be visible
    console.log(`[Rumble] Waiting for input field: ${inputSelector}`);
    await page.waitForSelector(inputSelector, { timeout: 10000, state: 'visible' });
    
    // Type the comment with human-like speed
    console.log('[Rumble] Typing comment...');
    await humanType(page, inputSelector, comment);
    
    // Wait a bit before clicking send
    await humanDelay(page, 500, 1000);
    
    // Click the send button or press Enter
    if (sendButtonSelector) {
      const sendButtonCount = await page.locator(sendButtonSelector).count();
      if (sendButtonCount > 0) {
        console.log(`[Rumble] Clicking send button: ${sendButtonSelector}`);
        await page.click(sendButtonSelector);
      } else {
        console.log('[Rumble] Send button not found, pressing Enter');
        await page.keyboard.press('Enter');
      }
    } else {
      console.log('[Rumble] Pressing Enter to submit');
      await page.keyboard.press('Enter');
    }
    
    // Wait to see if comment appears
    await humanDelay(page, 2000, 3000);
    
    // Take final screenshot
    await page.screenshot({ path: '/tmp/rumble-after-comment.png', fullPage: false });
    console.log('[Rumble] Final screenshot saved to: /tmp/rumble-after-comment.png');
    
    console.log('[Rumble] Comment posted successfully!');
    
    return {
      success: true,
      isLive,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Rumble] Error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}
