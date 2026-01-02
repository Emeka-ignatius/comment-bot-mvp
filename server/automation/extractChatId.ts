import axios from 'axios';

/**
 * Extract chat ID from Rumble video page using authenticated request
 * 
 * The chat ID is embedded in the page HTML/JavaScript and is different from the video ID.
 * Example: https://rumble.com/v73mkg8-shakers.html → chat ID: 425684736
 * 
 * This function uses account cookies to bypass Cloudflare protection.
 */
export async function extractChatIdFromPage(videoUrl: string, cookieString?: string): Promise<string | null> {
  try {
    console.log('[ChatID Extractor] Fetching page:', videoUrl);
    
    // Build headers with cookies if provided
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
      console.log('[ChatID Extractor] Using authenticated request with cookies');
    } else {
      console.log('[ChatID Extractor] No cookies provided, attempting unauthenticated request');
    }
    
    const response = await axios.get(videoUrl, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
    });
    
    const html = response.data;
    
    // Check if we got Cloudflare challenge page
    if (html.includes('Just a moment') || html.includes('Checking your browser')) {
      console.error('[ChatID Extractor] ❌ Cloudflare challenge detected - need authenticated cookies');
      return null;
    }
    
    console.log('[ChatID Extractor] Page fetched successfully, searching for chat ID...');
    
    // Method 1: Look for video_id in hx-vals attribute
    // Pattern: "video_id": "425684736"
    const videoIdMatch = html.match(/["']video_id["']\s*:\s*["'](\d+)["']/i);
    if (videoIdMatch && videoIdMatch[1]) {
      console.log('[ChatID Extractor] ✅ Found chat ID (video_id):', videoIdMatch[1]);
      return videoIdMatch[1];
    }
    
    // Method 2: Look for content_id in hx-vals attribute
    // Pattern: "content_id":425684736 or &#34;content_id&#34;:425684736
    const contentIdMatch = html.match(/(?:["']|&#34;)content_id(?:["']|&#34;)\s*:\s*(\d+)/i);
    if (contentIdMatch && contentIdMatch[1]) {
      console.log('[ChatID Extractor] ✅ Found chat ID (content_id):', contentIdMatch[1]);
      return contentIdMatch[1];
    }
    
    // Method 3: Look for data-id attribute on rumbles-vote-pill
    // Pattern: data-id="425684736"
    const dataIdMatch = html.match(/data-id=["'](\d{6,})["']/i);
    if (dataIdMatch && dataIdMatch[1]) {
      console.log('[ChatID Extractor] ✅ Found chat ID (data-id):', dataIdMatch[1]);
      return dataIdMatch[1];
    }
    
    // Method 4: Look for chat ID in script tags or data attributes
    // Pattern: "chat":{"id":425684736 or similar
    const chatIdMatch = html.match(/["']chat["']\s*:\s*{\s*["']id["']\s*:\s*(\d+)/i);
    if (chatIdMatch && chatIdMatch[1]) {
      console.log('[ChatID Extractor] ✅ Found chat ID (chat.id):', chatIdMatch[1]);
      return chatIdMatch[1];
    }
    
    // Method 5: Look for API endpoint with chat ID
    // Pattern: /chat/api/chat/425684736/message
    const apiMatch = html.match(/\/chat\/api\/chat\/(\d+)\//);
    if (apiMatch && apiMatch[1]) {
      console.log('[ChatID Extractor] ✅ Found chat ID (API endpoint):', apiMatch[1]);
      return apiMatch[1];
    }
    
    console.error('[ChatID Extractor] ❌ Could not find chat ID in page');
    // Log a snippet for debugging
    const snippet = html.substring(0, 500);
    console.log('[ChatID Extractor] HTML snippet:', snippet);
    
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ChatID Extractor] ❌ Error fetching page:', errorMessage);
    return null;
  }
}

/**
 * Extract chat ID using stored account cookies from database
 * This is the main function to call - it will fetch cookies from DB and use them
 */
export async function extractChatIdWithAccountCookies(
  videoUrl: string, 
  getAccountCookies: () => Promise<string | null>
): Promise<string | null> {
  // First try with account cookies
  const cookies = await getAccountCookies();
  
  if (cookies) {
    console.log('[ChatID Extractor] Attempting extraction with account cookies...');
    const chatId = await extractChatIdFromPage(videoUrl, cookies);
    if (chatId) {
      return chatId;
    }
    console.log('[ChatID Extractor] Extraction with cookies failed, trying without...');
  }
  
  // Fallback to unauthenticated request (might get blocked by Cloudflare)
  return extractChatIdFromPage(videoUrl);
}
