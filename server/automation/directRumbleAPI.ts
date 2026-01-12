import axios from 'axios';
import { randomUUID } from 'crypto';
import { proxyRotation } from './proxyRotation';

/**
 * Generate a random username from a predefined list
 * This helps avoid detection by rotating usernames
 */
const USERNAMES = [
  "FreeVoiceMedia",
  "UnfilteredMic",
  "LibertyCaster",
  "RawSignalTV",
  "OpenMindStudio",
  "TruthWave",
  "RebelBroadcast",
  "IronOpinion",
  "SignalOverNoise",
  "BoldNarrative",
  "IndependentAngle",
  "VoxUnchained",
  "ClearFrameMedia",
  "StraightTalkerHQ",
  "RealScopeTV",
  "PublicSignal",
  "UntamedMedia",
  "DirectLineCast",
  "NoSpinStudio",
  "FrontierVoice",
];

let currentUsernameIndex = 0;

function getNextUsername(): string {
  const username = USERNAMES[currentUsernameIndex];
  currentUsernameIndex = (currentUsernameIndex + 1) % USERNAMES.length;
  return username;
}

/**
 * Post a comment directly to Rumble's undocumented chat API
 * This bypasses browser automation but has medium detection risk
 * Best for low-volume usage (5-10 comments/hour per account)
 */
export async function postRumbleCommentDirect(
  chatId: string,
  comment: string,
  cookieString: string,
  proxy?: string // Format: protocol://user:pass@host:port
): Promise<{ success: boolean; error?: string; timestamp?: number }> {
  const startTime = Date.now();
  try {
    const chatUrl = `https://web7.rumble.com/chat/api/chat/${chatId}/message`;
    
    const username = getNextUsername();
    
    const payload = {
      data: {
        message: {
          text: comment,
          // username: username, // Temporarily removed - Rumble may infer from cookies
        },
        rant: null,
        request_id: randomUUID(),
      },
    };
    
    console.log(`[Rumble Direct API] Posting to: ${chatUrl}`);
    console.log(`[Rumble Direct API] Comment as ${username}: ${comment}`);
    
    let httpsAgent;
    if (proxy) {
      try {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        httpsAgent = new HttpsProxyAgent(proxy);
        console.log(`[Rumble Direct API] Using proxy: ${proxy.split('@').pop()}`);
      } catch (e) {
        console.warn(`[Rumble Direct API] Proxy error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const response = await axios.post(chatUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieString,
        'Origin': 'https://rumble.com',
        'Referer': 'https://rumble.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      },
      httpsAgent,
      proxy: false, // Disable default axios proxy handling when using agent
      timeout: 10000, // Reduced to 10 seconds for faster feedback
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
