import axios from 'axios';

/**
 * Extract Chat ID from Rumble video page using authenticated account cookies
 * 
 * The chat ID is embedded in the page HTML/JavaScript and is different from the video ID.
 * Example: https://rumble.com/v73mkg8-shakers.html → chat ID: 425684736
 * 
 * This function uses account cookies to bypass Cloudflare protection.
 * Includes retry logic with exponential backoff for reliability.
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
  // Method 1: Look for "video_id" in JSON data (most reliable)
  const videoIdMatch = html.match(/"video_id"\s*:\s*"?(\d+)"?/);
  if (videoIdMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via video_id: ${videoIdMatch[1]}`);
    return videoIdMatch[1];
  }

  // Method 2: Look for content_id
  const contentIdMatch = html.match(/"content_id"\s*:\s*"?(\d+)"?/);
  if (contentIdMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via content_id: ${contentIdMatch[1]}`);
    return contentIdMatch[1];
  }

  // Method 3: Look for chatId directly
  const chatIdMatch = html.match(/"chatId"\s*:\s*"?(\d+)"?/);
  if (chatIdMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via chatId: ${chatIdMatch[1]}`);
    return chatIdMatch[1];
  }

  // Method 4: Look for data-video-id attribute
  const dataVideoIdMatch = html.match(/data-video-id="(\d+)"/);
  if (dataVideoIdMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via data-video-id: ${dataVideoIdMatch[1]}`);
    return dataVideoIdMatch[1];
  }

  // Method 5: Look for API endpoint with chat ID
  const apiMatch = html.match(/\/chat\/api\/chat\/(\d+)\//);
  if (apiMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via API endpoint: ${apiMatch[1]}`);
    return apiMatch[1];
  }

  // Method 6: Look for hx-vals with video_id (HTMX attribute)
  const htmxMatch = html.match(/hx-vals=["'].*?"video_id"\s*:\s*["'](\d+)["']/i);
  if (htmxMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via hx-vals: ${htmxMatch[1]}`);
    return htmxMatch[1];
  }

  // Method 7: Look for any large number (6+ digits) in video_id context
  const largeNumberMatch = html.match(/video_id["\s:=]*["']?(\d{6,})/i);
  if (largeNumberMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via large number pattern: ${largeNumberMatch[1]}`);
    return largeNumberMatch[1];
  }

  return null;
}

/**
 * Extract chat ID using authenticated account cookies
 */
export async function extractChatIdFromPage(videoUrl: string, cookieString?: string): Promise<string | null> {
  // Check cache first
  const cached = getCachedChatId(videoUrl);
  if (cached) {
    return cached;
  }

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[ChatID Extractor] Fetching page (attempt ${attempt}/${MAX_RETRIES}): ${videoUrl}`);

      // Build headers with cookies if provided
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      };

      if (cookieString) {
        headers['Cookie'] = cookieString;
        console.log('[ChatID Extractor] Using authenticated request with account cookies');
      } else {
        console.log('[ChatID Extractor] ⚠️ No cookies provided - may hit Cloudflare challenge');
      }

      const response = await axios.get(videoUrl, {
        headers,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true, // Accept any status code
      });

      const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      // Check response status
      if (response.status !== 200) {
        console.warn(`[ChatID Extractor] ⚠️ HTTP ${response.status} on attempt ${attempt}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status} - page not accessible`);
      }

      // Check if we got Cloudflare challenge page
      if (html.includes('Just a moment') || html.includes('Checking your browser') || html.includes('cf_clearance')) {
        console.warn(`[ChatID Extractor] ⚠️ Cloudflare challenge detected on attempt ${attempt}`);
        if (!cookieString) {
          console.warn('[ChatID Extractor] ⚠️ No cookies provided - cannot bypass Cloudflare');
        }
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error('Cloudflare challenge - need authenticated cookies');
      }

      console.log('[ChatID Extractor] Page fetched successfully, searching for chat ID...');

      // Extract chat ID from HTML
      const chatId = extractChatIdFromHTML(html);

      if (chatId) {
        console.log(`[ChatID Extractor] ✅ Found chat ID: ${chatId}`);
        setCachedChatId(videoUrl, chatId);
        return chatId;
      }

      console.warn(`[ChatID Extractor] ⚠️ Could not find chat ID in page (attempt ${attempt}/${MAX_RETRIES})`);
      console.log('[ChatID Extractor] HTML length:', html.length);

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      throw new Error('Chat ID not found in page after all extraction methods');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[ChatID Extractor] ❌ Error on attempt ${attempt}:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }

  console.error('[ChatID Extractor] ❌ Failed to extract chat ID after', MAX_RETRIES, 'attempts');
  if (lastError) {
    console.error('[ChatID Extractor] Last error:', lastError.message);
  }

  return null;
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
