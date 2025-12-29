import { chromium, Browser, BrowserContext, Page } from 'playwright';

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

    // Set realistic headers
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

    // Mask webdriver property
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    return page;
  }

  async injectCookies(page: Page, cookies: Record<string, string>) {
    try {
      const cookieArray = Object.entries(cookies).map(([name, value]) => ({
        name,
        value,
        domain: name.includes('youtube') ? '.youtube.com' : '.rumble.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year
        httpOnly: false,
        secure: true,
        sameSite: 'Lax' as const,
      }));

      await page.context().addCookies(cookieArray);
      console.log('[Browser] Cookies injected');
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
