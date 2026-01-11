import { chromium } from 'playwright';

/**
 * Extract Chat ID from Rumble video URL
 * Uses Playwright to bypass Cloudflare and extract the actual chat ID
 */

const chatIdCache = new Map<string, { id: string; timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

function getCachedChatId(videoUrl: string): string | null {
  const cached = chatIdCache.get(videoUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[ChatID Extractor] ✅ Using cached chat ID: ${cached.id}`);
    return cached.id;
  }
  return null;
}

function setCachedChatId(videoUrl: string, chatId: string): void {
  chatIdCache.set(videoUrl, { id: chatId, timestamp: Date.now() });
}

/**
 * Extract chat ID from page HTML using multiple methods
 */
function extractChatIdFromHTML(html: string): string | null {
  // Method 1: Look for "video_id" in JSON data
  const videoIdMatch = html.match(/"video_id"\s*:\s*"?(\d+)"?/);
  if (videoIdMatch?.[1]) {
    return videoIdMatch[1];
  }

  // Method 2: Look for chatId in window.__INITIAL_STATE__
  const initialStateMatch = html.match(/__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
  if (initialStateMatch) {
    try {
      const state = JSON.parse(initialStateMatch[1]);
      if (state?.video?.id) {
        return String(state.video.id);
      }
    } catch (e) {
      // Continue to next method
    }
  }

  // Method 3: Look for data-video-id attribute
  const dataVideoIdMatch = html.match(/data-video-id="(\d+)"/);
  if (dataVideoIdMatch?.[1]) {
    return dataVideoIdMatch[1];
  }

  // Method 4: Look for "chatId" directly
  const chatIdMatch = html.match(/"chatId"\s*:\s*"?(\d+)"?/);
  if (chatIdMatch?.[1]) {
    return chatIdMatch[1];
  }

  // Method 5: Look for content_id
  const contentIdMatch = html.match(/"content_id"\s*:\s*"?(\d+)"?/);
  if (contentIdMatch?.[1]) {
    return contentIdMatch[1];
  }

  // Method 6: Look for hx-vals with video_id (HTMX attribute)
  const htmxMatch = html.match(/hx-vals=["'].*?"video_id"\s*:\s*["'](\d+)["']/i);
  if (htmxMatch?.[1]) {
    return htmxMatch[1];
  }

  // Method 7: Look for API endpoint with chat ID
  const apiMatch = html.match(/\/chat\/api\/chat\/(\d+)\//);
  if (apiMatch?.[1]) {
    return apiMatch[1];
  }

  // Method 8: Look for any large number (6+ digits) in video_id context
  const largeNumberMatch = html.match(/video_id["\s:=]*["']?(\d{6,})/i);
  if (largeNumberMatch?.[1]) {
    return largeNumberMatch[1];
  }

  return null;
}

/**
 * Extract chat ID using Playwright (handles Cloudflare)
 */
export async function extractChatIdFromPagePlaywright(videoUrl: string): Promise<string | null> {
  // Check cache first
  const cached = getCachedChatId(videoUrl);
  if (cached) {
    return cached;
  }

  let browser = null;
  try {
    console.log(`[ChatID Extractor] Fetching page with Playwright: ${videoUrl}`);
    
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    
    // Set timeout to 30 seconds
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Navigate to the page
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });

    // Wait a bit for dynamic content to load
    await page.waitForTimeout(2000);

    // Get the page content
    const html = await page.content();

    // Extract chat ID from HTML
    const chatId = extractChatIdFromHTML(html);

    if (chatId) {
      console.log(`[ChatID Extractor] ✅ Found chat ID: ${chatId}`);
      setCachedChatId(videoUrl, chatId);
      return chatId;
    }

    console.warn(`[ChatID Extractor] ⚠️ Could not extract chat ID from page`);
    return null;
  } catch (error) {
    console.error(`[ChatID Extractor] Error fetching page:`, error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract video ID from URL (fallback only)
 */
export function extractVideoIdFromUrl(url: string): string | null {
  // Extract video ID from URL like: https://rumble.com/v742hom-test.html
  const match = url.match(/\/v([a-z0-9]+)/i);
  if (match?.[1]) {
    return match[1];
  }
  return null;
}

/**
 * Main function to extract chat ID with fallback
 */
export async function extractChatId(videoUrl: string): Promise<string | null> {
  try {
    // Try Playwright method first (handles Cloudflare)
    const chatId = await extractChatIdFromPagePlaywright(videoUrl);
    if (chatId) {
      return chatId;
    }

    // Fallback to video ID extraction (not ideal, but better than nothing)
    console.warn(`[ChatID Extractor] ⚠️ Falling back to video ID extraction`);
    const videoId = extractVideoIdFromUrl(videoUrl);
    if (videoId) {
      console.warn(`[ChatID Extractor] ⚠️ Using video ID as fallback: ${videoId}`);
      return videoId;
    }

    console.error(`[ChatID Extractor] ❌ Could not extract any ID from URL`);
    return null;
  } catch (error) {
    console.error(`[ChatID Extractor] Error:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Clear old cache entries
 */
export function clearOldCacheEntries(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  chatIdCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => chatIdCache.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`[ChatID Extractor] Cleared ${keysToDelete.length} old cache entries`);
  }
}

// Clear old cache entries every 30 minutes
setInterval(clearOldCacheEntries, 1800000);
