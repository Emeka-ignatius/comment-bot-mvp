import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { parseCookies, validateCookies } from './cookieParser';

interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
}

class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async initialize(config: BrowserConfig = {}) {
    const { headless = true } = config;

    try {
      this.browser = await chromium.launch({
        headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-web-resources',
          '--disable-sync',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-preconnect',
          '--disable-component-extensions-with-background-pages',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
          '--no-pings',
          '--no-sandbox',
          '--password-store=basic',
          '--use-mock-keychain',
        ],
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        geolocation: { latitude: 40.7128, longitude: -74.0060 },
        permissions: ['geolocation'],
      });

      console.log('[Browser] Initialized successfully');
    } catch (error) {
      console.error('[Browser] Failed to initialize:', error);
      throw error;
    }
  }

  async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const page = await this.context.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    });

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    return page;
  }

  async injectCookies(page: Page, cookiesInput: string | Record<string, string>, platform: 'youtube' | 'rumble' = 'youtube') {
    try {
      let cookieArray;

      if (typeof cookiesInput === 'string') {
        cookieArray = parseCookies(cookiesInput, platform);
      } else {
        cookieArray = Object.entries(cookiesInput).map(([name, value]) => ({
          name,
          value,
          domain: platform === 'youtube' ? '.youtube.com' : '.rumble.com',
          path: '/',
          expires: Math.floor(Date.now() / 1000) + 86400 * 365,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax' as const,
        }));
      }

      const validation = validateCookies(cookieArray);
      if (!validation.valid) {
        throw new Error(`Invalid cookies: ${validation.errors.join(', ')}`);
      }

      await page.context().addCookies(cookieArray);
      console.log(`[Browser] ${cookieArray.length} cookies injected for ${platform}`);
    } catch (error) {
      console.error('[Browser] Failed to inject cookies:', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      console.log('[Browser] Closed successfully');
    } catch (error) {
      console.error('[Browser] Failed to close:', error);
    }
  }
}

export default new BrowserAutomation();
