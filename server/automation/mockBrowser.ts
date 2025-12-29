/**
 * Mock browser automation for MVP testing
 * Simulates successful comment submissions without requiring actual browser automation
 */

import { Page } from 'playwright';

interface MockBrowserConfig {
  headless?: boolean;
  timeout?: number;
}

class MockBrowserAutomation {
  private simulatedDelay = 2000; // Simulate realistic delay

  async initialize(config: MockBrowserConfig = {}) {
    console.log('[MockBrowser] Initialized (mock mode)');
    await this.delay(500);
  }

  async createPage(): Promise<any> {
    console.log('[MockBrowser] Created page (mock)');
    return {
      goto: async (url: string) => {
        console.log('[MockBrowser] Navigated to:', url);
        await this.delay(1000);
      },
      context: () => ({
        addCookies: async (cookies: any[]) => {
          console.log('[MockBrowser] Added', cookies.length, 'cookies (mock)');
        },
      }),
      evaluate: async (fn: Function) => {
        console.log('[MockBrowser] Evaluated script (mock)');
        return fn();
      },
      waitForTimeout: async (ms: number) => {
        await this.delay(ms);
      },
      keyboard: {
        type: async (text: string) => {
          console.log('[MockBrowser] Typed:', text.substring(0, 50) + '...');
          await this.delay(text.length * 10);
        },
      },
      $: async (selector: string) => {
        console.log('[MockBrowser] Found element:', selector);
        return {
          click: async () => {
            console.log('[MockBrowser] Clicked:', selector);
            await this.delay(500);
          },
        };
      },
      setExtraHTTPHeaders: async () => {
        console.log('[MockBrowser] Set HTTP headers (mock)');
      },
      addInitScript: async () => {
        console.log('[MockBrowser] Added init script (mock)');
      },
    };
  }

  async injectCookies(page: any, cookiesInput: string | Record<string, string>, platform: 'youtube' | 'rumble' = 'youtube') {
    console.log(`[MockBrowser] Injecting cookies for ${platform} (mock)`);
    await this.delay(500);
  }

  async close() {
    console.log('[MockBrowser] Closed (mock)');
    await this.delay(200);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new MockBrowserAutomation();
