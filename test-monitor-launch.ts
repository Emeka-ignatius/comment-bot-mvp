
import { chromium } from 'playwright';

async function test() {
  console.log('Testing Playwright launch with streamMonitor arguments...');
  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    console.log('✅ Browser launched successfully!');
    const page = await browser.newPage();
    console.log('✅ New page created!');
    await page.goto('https://rumble.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('✅ Navigated to Rumble!');
    console.log('Page title:', await page.title());
    await browser.close();
    console.log('✅ Browser closed successfully!');
  } catch (error) {
    console.error('❌ Playwright launch failed:', error);
    process.exit(1);
  }
}

test().catch(console.error);
