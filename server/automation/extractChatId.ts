import axios from "axios";

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
    console.log(
      `[ChatID Extractor] Found via content_id: ${contentIdMatch[1]}`
    );
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
    console.log(
      `[ChatID Extractor] Found via data-video-id: ${dataVideoIdMatch[1]}`
    );
    return dataVideoIdMatch[1];
  }

  // Method 5: Look for API endpoint with chat ID
  const apiMatch = html.match(/\/chat\/api\/chat\/(\d+)\//);
  if (apiMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via API endpoint: ${apiMatch[1]}`);
    return apiMatch[1];
  }

  // Method 6: Look for hx-vals with video_id (HTMX attribute)
  const htmxMatch = html.match(
    /hx-vals=["'].*?"video_id"\s*:\s*["'](\d+)["']/i
  );
  if (htmxMatch?.[1]) {
    console.log(`[ChatID Extractor] Found via hx-vals: ${htmxMatch[1]}`);
    return htmxMatch[1];
  }

  // Method 7: Look for any large number (6+ digits) in video_id context
  const largeNumberMatch = html.match(/video_id["\s:=]*["']?(\d{6,})/i);
  if (largeNumberMatch?.[1]) {
    console.log(
      `[ChatID Extractor] Found via large number pattern: ${largeNumberMatch[1]}`
    );
    return largeNumberMatch[1];
  }

  return null;
}

/**
 * Extract video ID from Rumble URL
 */
function extractVideoIdFromRumbleUrl(videoUrl: string): string | null {
  try {
    const match = videoUrl.match(/\/v([a-z0-9]+)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function extractEmbedIdFromIframeHtml(html: string): string | null {
  // Example: <iframe src="https://rumble.com/embed/v72525s/" ...></iframe>
  const match = html.match(/rumble\.com\/embed\/(v[a-z0-9]+)\//i);
  return match?.[1] ?? null;
}

async function extractChatIdViaEmbedEndpoints(
  videoUrl: string,
  cookieString?: string,
  proxy?: string
): Promise<string | null> {
  try {
    // 1) oEmbed gives us an embed id without Cloudflare HTML scraping.
    // Example response contains: html: <iframe src="https://rumble.com/embed/v72525s/">
    const oembedUrl = `https://rumble.com/api/Media/oembed.json?url=${encodeURIComponent(videoUrl)}`;
    const oembed = await axios.get(oembedUrl, {
      timeout: 15000,
      validateStatus: () => true,
    });

    if (oembed.status !== 200) {
      console.warn(
        `[ChatID Extractor] oEmbed returned status ${oembed.status} for ${videoUrl}`
      );
      return null;
    }

    const oembedData =
      typeof oembed.data === "string" ? JSON.parse(oembed.data) : oembed.data;
    const iframeHtml = String(oembedData?.html ?? "");
    const embedId = extractEmbedIdFromIframeHtml(iframeHtml);
    if (!embedId) {
      console.warn(
        `[ChatID Extractor] oEmbed did not contain embed iframe for ${videoUrl}`
      );
      return null;
    }

    // 2) The embed page is typically accessible and contains the embedJS version path.
    const embedPageUrl = `https://rumble.com/embed/${embedId}/`;
    const embedPage = await axios.get(embedPageUrl, {
      timeout: 15000,
      validateStatus: () => true,
    });

    if (embedPage.status !== 200 || typeof embedPage.data !== "string") {
      console.warn(
        `[ChatID Extractor] Embed page returned status ${embedPage.status} for ${embedPageUrl}`
      );
      return null;
    }

    const embedHtml = embedPage.data;
    const embedJsMatch = embedHtml.match(/\/embedJS\/u[a-z0-9]+/i);
    const embedJsPath = embedJsMatch?.[0] ?? "/embedJS/u4";

    // 3) embedJS request=video returns JSON that includes `vid` (numeric video_id).
    // Example: https://rumble.com/embedJS/u4/?request=video&v=v72525s  -> { vid: 426858544, ... }
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      Referer: embedPageUrl,
      Origin: "https://rumble.com",
    };
    if (cookieString) headers["Cookie"] = cookieString;

    let httpsAgent;
    if (proxy) {
      try {
        const { HttpsProxyAgent } = await import("https-proxy-agent");
        httpsAgent = new HttpsProxyAgent(proxy);
      } catch {
        // ignore proxy issues
      }
    }

    const embedVideoUrl = `https://rumble.com${embedJsPath}/?request=video&v=${encodeURIComponent(embedId)}`;
    console.log(
      `[ChatID Extractor] Using embed endpoints: embedId=${embedId}, embedJS=${embedJsPath}`
    );
    const embedVideo = await axios.get(embedVideoUrl, {
      headers,
      httpsAgent,
      proxy: false,
      timeout: 15000,
      validateStatus: () => true,
    });

    if (embedVideo.status !== 200) {
      console.warn(
        `[ChatID Extractor] embedJS returned status ${embedVideo.status} for ${embedVideoUrl}`
      );
      return null;
    }

    const embedVideoData =
      typeof embedVideo.data === "string"
        ? JSON.parse(embedVideo.data)
        : embedVideo.data;

    const vid = embedVideoData?.vid ?? embedVideoData?.a?.pause_ads_params?.cvid;
    const chatId = vid != null ? String(vid) : "";
    if (/^\d{6,}$/.test(chatId)) {
      console.log(
        `[ChatID Extractor] ✅ Found numeric video_id via embedJS: ${chatId}`
      );
      return chatId;
    }

    console.warn(
      `[ChatID Extractor] embedJS response did not contain numeric vid for ${videoUrl}`
    );
    return null;
  } catch (e) {
    console.warn(
      `[ChatID Extractor] Embed endpoint method failed:`,
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }
}

/**
 * Try to extract chat ID using Rumble service API endpoint
 * This endpoint often bypasses Cloudflare better than scraping HTML
 * Tries both alphanumeric video ID (from URL) and numeric video_id (from page)
 */
async function extractChatIdViaServiceAPI(
  videoId: string,
  cookieString?: string,
  proxy?: string,
  numericVideoId?: string
): Promise<string | null> {
  if (!videoId) return null;

  // Try numeric video_id first if available (more reliable)
  const videoIdsToTry = numericVideoId ? [numericVideoId, videoId] : [videoId];

  for (const vid of videoIdsToTry) {
    try {
      const serviceUrl = `https://wn0.rumble.com/service.php?video_id=${vid}&name=video.watching-now&included_js_libs=loc%2Cmain%2Cweb_services%2Cevents%2Cerror%2Cnotify%2Chtmx.org%2Cnavigation-state%2Cdarkmode%2Cqrcode%2Crandom%2Clocal_storage%2Cchannel-action-buttons%2Cpopout%2Cfollow-button%2Ctooltip%2Cui%2Crac-ad%2Ctrack-viewable-impression%2Ccontext-menus%2Cprovider%2Cswipe-slider%2Cfortis%2Cinputs%2Cdefer%2Csearch-bar%2Ctrack-click%2Cui_header%2Cmain-menu-item-hover%2Cuser_header%2Cuser_notifications%2Cunified-header-navigation%2Cnews-notification%2Cevent_handler%2Cui_overlay%2Csave-to-playlist-modal-list-view%2Cform-validation-helpers%2Cform-input-counter%2Csave-to-playlist-modal-form-view%2Cfacebook&included_css_libs=global%2Cui_overlay%2Cservice.media`;

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://rumble.com/",
        Origin: "https://rumble.com",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
      };

      if (cookieString) {
        headers["Cookie"] = cookieString;
      }

      let httpsAgent;
      if (proxy) {
        try {
          const { HttpsProxyAgent } = await import("https-proxy-agent");
          httpsAgent = new HttpsProxyAgent(proxy);
        } catch (e) {
          // Proxy setup failed, continue without it
        }
      }

      console.log(
        `[ChatID Extractor] Trying service API endpoint for video_id: ${vid}`
      );
      const response = await axios.get(serviceUrl, {
        headers,
        httpsAgent,
        proxy: false,
        timeout: 15000,
        validateStatus: () => true,
      });

      console.log(
        `[ChatID Extractor] Service API response status: ${response.status}, type: ${typeof response.data}`
      );

      if (response.status === 200) {
        // Handle both JSON object and string responses
        let responseData: any;
        if (typeof response.data === "string") {
          try {
            responseData = JSON.parse(response.data);
          } catch {
            responseData = response.data;
          }
        } else {
          responseData = response.data;
        }

        // If we used a numeric video_id and got 200, the video_id IS the chat ID
        // The response will be: {"data":{"video_id":426858544,...}}
        // So if we passed in a numeric video_id, use it directly!
        if (/^\d{6,}$/.test(vid)) {
          // Check if response confirms this video_id
          if (responseData?.data?.video_id && String(responseData.data.video_id) === vid) {
            console.log(
              `[ChatID Extractor] ✅ Service API confirmed numeric video_id as chat ID: ${vid}`
            );
            return vid;
          }
          // Even if response doesn't match exactly, if we got 200 with numeric ID, it's valid
          console.log(
            `[ChatID Extractor] ✅ Using numeric video_id as chat ID (service API returned 200): ${vid}`
          );
          return vid;
        }

        // Try to extract video_id from response (for non-numeric input)
        let dataString = typeof responseData === "string" ? responseData : JSON.stringify(responseData);
        
        // Look for video_id in the response (this is the chat ID)
        const videoIdMatch = dataString.match(/"video_id"\s*:\s*"?(\d+)"?/);
        if (videoIdMatch?.[1]) {
          console.log(
            `[ChatID Extractor] ✅ Found chat ID via service API: ${videoIdMatch[1]}`
          );
          return videoIdMatch[1];
        }

        // Also try direct JSON path
        if (responseData?.data?.video_id) {
          const chatId = String(responseData.data.video_id);
          console.log(
            `[ChatID Extractor] ✅ Found chat ID via service API (JSON path): ${chatId}`
          );
          return chatId;
        }

        // Also try content_id
        const contentIdMatch = dataString.match(
          /"content_id"\s*:\s*"?(\d+)"?/
        );
        if (contentIdMatch?.[1]) {
          console.log(
            `[ChatID Extractor] ✅ Found chat ID via service API (content_id): ${contentIdMatch[1]}`
          );
          return contentIdMatch[1];
        }
      } else {
        console.warn(
          `[ChatID Extractor] Service API returned status ${response.status} for video_id: ${vid}`
        );
      }
    } catch (error) {
      // Try next video ID format
      continue;
    }
  }

  return null;
}

/**
 * Extract chat ID using Playwright (better Cloudflare bypass)
 */
async function extractChatIdViaPlaywright(
  videoUrl: string,
  cookieString?: string,
  proxy?: string
): Promise<string | null> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      proxy: proxy ? { server: proxy } : undefined,
    });

    // Set cookies if provided
    if (cookieString) {
      try {
        const cookieParser = await import("./cookieParser");
        const cookies = cookieParser.parseCookies(cookieString, "rumble");
        await context.addCookies(cookies);
        console.log(
          `[ChatID Extractor] Set ${cookies.length} cookies in Playwright context`
        );
      } catch (e) {
        console.warn(
          `[ChatID Extractor] Failed to parse cookies for Playwright:`,
          e instanceof Error ? e.message : String(e)
        );
      }
    }

    const page = await context.newPage();
    console.log(`[ChatID Extractor] Loading page with Playwright: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Wait a bit for any dynamic content
    await page.waitForTimeout(2000);

    const html = await page.content();
    const chatId = extractChatIdFromHTML(html);

    await browser.close();

    if (chatId) {
      console.log(
        `[ChatID Extractor] ✅ Found chat ID via Playwright: ${chatId}`
      );
      return chatId;
    }

    return null;
  } catch (error) {
    console.warn(
      `[ChatID Extractor] Playwright method failed:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

/**
 * Extract chat ID using authenticated account cookies
 */
export async function extractChatIdFromPage(
  videoUrl: string,
  cookieString?: string,
  proxy?: string
): Promise<string | null> {
  // Check cache first
  const cached = getCachedChatId(videoUrl);
  if (cached) {
    return cached;
  }

  // Extract video ID from URL (do this once at the start)
  const videoId = extractVideoIdFromRumbleUrl(videoUrl);

  // Method 0 (best): Use Rumble oEmbed -> embedJS to get numeric `vid` without Cloudflare.
  // This returns the numeric `video_id` which is what we want to store as chatId.
  const embedChatId = await extractChatIdViaEmbedEndpoints(
    videoUrl,
    cookieString,
    proxy
  );
  if (embedChatId) {
    setCachedChatId(videoUrl, embedChatId);
    return embedChatId;
  }

  // Method 1: Try Playwright first (best Cloudflare bypass, can extract numeric video_id)
  if (cookieString) {
    console.log(
      `[ChatID Extractor] Attempting Playwright method (best Cloudflare bypass)`
    );
    const playwrightChatId = await extractChatIdViaPlaywright(
      videoUrl,
      cookieString,
      proxy
    );
    if (playwrightChatId) {
      setCachedChatId(videoUrl, playwrightChatId);
      return playwrightChatId;
    }
  }

  // Method 2: Try service API endpoint (fastest, often bypasses Cloudflare)
  if (videoId) {
    console.log(
      `[ChatID Extractor] Attempting service API method for video_id: ${videoId}`
    );
    const serviceApiChatId = await extractChatIdViaServiceAPI(
      videoId,
      cookieString,
      proxy
    );
    if (serviceApiChatId) {
      setCachedChatId(videoUrl, serviceApiChatId);
      return serviceApiChatId;
    }
  }

  // Method 3: Fallback to axios (original method)
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[ChatID Extractor] Fetching page (attempt ${attempt}/${MAX_RETRIES}): ${videoUrl}`
      );

      // Build headers with cookies if provided - improved browser-like headers
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
        DNT: "1",
        Referer: "https://www.google.com/",
      };

      if (cookieString) {
        headers["Cookie"] = cookieString;
        console.log(
          "[ChatID Extractor] Using authenticated request with account cookies"
        );
      } else {
        console.log(
          "[ChatID Extractor] ⚠️ No cookies provided - may hit Cloudflare challenge"
        );
      }

      let httpsAgent;
      if (proxy) {
        try {
          const { HttpsProxyAgent } = await import("https-proxy-agent");
          httpsAgent = new HttpsProxyAgent(proxy);
          console.log(
            `[ChatID Extractor] Using proxy: ${proxy.split("@").pop()}`
          );
        } catch (e) {
          console.warn(
            `[ChatID Extractor] Proxy error: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      }

      const response = await axios.get(videoUrl, {
        headers,
        httpsAgent,
        proxy: false,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true, // Accept any status code
      });

      const html =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);

      // Check response status
      if (response.status !== 200) {
        console.warn(
          `[ChatID Extractor] ⚠️ HTTP ${response.status} on attempt ${attempt}`
        );
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error(`HTTP ${response.status} - page not accessible`);
      }

      // Check if we got Cloudflare challenge page
      if (
        html.includes("Just a moment") ||
        html.includes("Checking your browser") ||
        html.includes("cf_clearance")
      ) {
        console.warn(
          `[ChatID Extractor] ⚠️ Cloudflare challenge detected on attempt ${attempt}`
        );
        if (!cookieString) {
          console.warn(
            "[ChatID Extractor] ⚠️ No cookies provided - cannot bypass Cloudflare"
          );
        }
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw new Error("Cloudflare challenge - need authenticated cookies");
      }

      console.log(
        "[ChatID Extractor] Page fetched successfully, searching for chat ID..."
      );

      // Extract chat ID from HTML
      const chatId = extractChatIdFromHTML(html);

      if (chatId) {
        console.log(`[ChatID Extractor] ✅ Found chat ID: ${chatId}`);
        setCachedChatId(videoUrl, chatId);
        return chatId;
      }

      console.warn(
        `[ChatID Extractor] ⚠️ Could not find chat ID in page (attempt ${attempt}/${MAX_RETRIES})`
      );
      console.log("[ChatID Extractor] HTML length:", html.length);

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      throw new Error("Chat ID not found in page after all extraction methods");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(
        `[ChatID Extractor] ❌ Error on attempt ${attempt}:`,
        lastError.message
      );

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    }
  }

  console.error(
    "[ChatID Extractor] ❌ Failed to extract chat ID after",
    MAX_RETRIES,
    "attempts"
  );
  if (lastError) {
    console.error("[ChatID Extractor] Last error:", lastError.message);
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
    console.log(
      `[ChatID Extractor] Cleared ${keysToDelete.length} old cache entries`
    );
  }
}

// Clear old cache entries every 30 minutes
setInterval(clearOldCacheEntries, 1800000);
