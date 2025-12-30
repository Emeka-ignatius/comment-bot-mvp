import axios from 'axios';

/**
 * Extract chat ID from Rumble video page
 * 
 * The chat ID is embedded in the page HTML/JavaScript and is different from the video ID.
 * Example: https://rumble.com/v73mkg8-shakers.html → chat ID: 425684736
 * 
 * This function fetches the page and extracts the chat ID from the embedded data.
 */
export async function extractChatIdFromPage(videoUrl: string): Promise<string | null> {
  try {
    console.log('[ChatID Extractor] Fetching page:', videoUrl);
    
    const response = await axios.get(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    });
    
    const html = response.data;
    
    // Method 1: Look for video_id in hx-vals attribute
    // Pattern: "video_id": "425684736"
    const videoIdMatch = html.match(/["']video_id["']\s*:\s*["'](\d+)["']/i);
    if (videoIdMatch && videoIdMatch[1]) {
      console.log('[ChatID Extractor] Found chat ID (video_id):', videoIdMatch[1]);
      return videoIdMatch[1];
    }
    
    // Method 2: Look for content_id in hx-vals attribute
    // Pattern: "content_id":425684736
    const contentIdMatch = html.match(/["']content_id["']\s*:\s*(\d+)/i);
    if (contentIdMatch && contentIdMatch[1]) {
      console.log('[ChatID Extractor] Found chat ID (content_id):', contentIdMatch[1]);
      return contentIdMatch[1];
    }
    
    // Method 3: Look for chat ID in script tags or data attributes
    // Pattern: "chat":{"id":425684736 or similar
    const chatIdMatch = html.match(/["']chat["']\s*:\s*{\s*["']id["']\s*:\s*(\d+)/i);
    if (chatIdMatch && chatIdMatch[1]) {
      console.log('[ChatID Extractor] Found chat ID (chat.id):', chatIdMatch[1]);
      return chatIdMatch[1];
    }
    
    // Method 4: Look for API endpoint with chat ID
    // Pattern: /chat/api/chat/425684736/message
    const apiMatch = html.match(/\/chat\/api\/chat\/(\d+)\//);
    if (apiMatch && apiMatch[1]) {
      console.log('[ChatID Extractor] Found chat ID (method 3):', apiMatch[1]);
      return apiMatch[1];
    }
    
    console.error('[ChatID Extractor] Could not find chat ID in page');
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ChatID Extractor] Error fetching page:', errorMessage);
    return null;
  }
}
