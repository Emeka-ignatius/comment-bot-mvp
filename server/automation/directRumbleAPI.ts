import axios from 'axios';
import { randomUUID } from 'crypto';

/**
 * Post a comment directly to Rumble's undocumented chat API
 * This bypasses browser automation but has medium detection risk
 * Best for low-volume usage (5-10 comments/hour per account)
 */
export async function postRumbleCommentDirect(
  chatId: string,
  comment: string,
  cookieString: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const chatUrl = `https://web7.rumble.com/chat/api/chat/${chatId}/message`;
    
    const payload = {
      data: {
        message: {
          text: comment,
          // Note: username is NOT included - Rumble uses the cookie's account
        },
        rant: null,
        request_id: randomUUID(),
      },
    };
    
    console.log(`[Rumble Direct API] Posting to: ${chatUrl}`);
    console.log(`[Rumble Direct API] Comment: ${comment}`);
    
    const response = await axios.post(chatUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'Origin': 'https://rumble.com',
        'Referer': 'https://rumble.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });
    
    console.log('[Rumble Direct API] Success:', response.data);
    
    return {
      success: true,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = `HTTP ${error.response?.status}: ${JSON.stringify(error.response?.data)}`;
      console.error('[Rumble Direct API] Error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Rumble Direct API] Error:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Extract chat ID from Rumble video URL
 * Example: https://rumble.com/v73kr84-nitro-age-returns.html
 * The chat ID is typically the video ID (v73kr84)
 */
export function extractChatIdFromUrl(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    const pathname = url.pathname;
    
    // Match pattern like /v73kr84-title or /v73kr84
    const match = pathname.match(/\/(v[a-z0-9]+)/i);
    if (match && match[1]) {
      return match[1];
    }
    
    return null;
  } catch (error) {
    console.error('[Rumble Direct API] Invalid URL:', error);
    return null;
  }
}
