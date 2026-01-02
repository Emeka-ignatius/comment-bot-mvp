import puppeteer from 'puppeteer';

(async () => {
  try {
    console.log('=== Rumble Cookie Detection Test ===\n');
    
    const executablePath = '/home/ubuntu/.cache/puppeteer/chrome/linux-143.0.7499.169/chrome-linux64/chrome';
    
    const browser = await puppeteer.launch({
      headless: false,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('Opening Rumble login page...');
    await page.goto('https://rumble.com/account/signin', { waitUntil: 'networkidle2' });
    
    console.log('\n🔍 PLEASE LOG IN NOW. The script will check cookies every 2 seconds.\n');
    console.log('Press Ctrl+C to stop when done.\n');
    
    let checkCount = 0;
    let lastUrl = page.url();
    
    const interval = setInterval(async () => {
      try {
        checkCount++;
        const currentUrl = page.url();
        const cookies = await page.cookies();
        
        console.log(`\n=== Check #${checkCount} ===`);
        console.log(`URL: ${currentUrl}`);
        console.log(`Total cookies: ${cookies.length}`);
        
        if (currentUrl !== lastUrl) {
          console.log(`✅ URL CHANGED from: ${lastUrl}`);
          console.log(`             to: ${currentUrl}`);
          lastUrl = currentUrl;
        }
        
        if (cookies.length > 0) {
          console.log('\nCookies:');
          cookies.forEach((c, idx) => {
            const valuePreview = c.value.substring(0, 40) + (c.value.length > 40 ? '...' : '');
            console.log(`  [${idx + 1}] ${c.name}`);
            console.log(`      Value: ${valuePreview}`);
            console.log(`      Domain: ${c.domain}, Path: ${c.path}`);
            console.log(`      Secure: ${c.secure}, HttpOnly: ${c.httpOnly}`);
          });
        }
        
        // Check for potential auth cookies
        const authCookies = cookies.filter(c => 
          c.name.toLowerCase().includes('auth') || 
          c.name.toLowerCase().includes('session') || 
          c.name.toLowerCase().includes('rumble') ||
          c.name.toLowerCase().includes('sid') ||
          c.name.toLowerCase().includes('user') ||
          c.name.toLowerCase().includes('token')
        );
        
        if (authCookies.length > 0) {
          console.log(`\n🎯 POTENTIAL AUTH COOKIES: ${authCookies.map(c => c.name).join(', ')}`);
        }
        
      } catch (error) {
        console.error('Error:', error.message);
        clearInterval(interval);
        await browser.close();
        process.exit(1);
      }
    }, 2000);
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
})();
