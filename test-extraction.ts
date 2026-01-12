
import { extractChatIdFromPage } from './server/automation/extractChatId';

async function test() {
  const url = 'https://rumble.com/v746ht8-shakers.html'; // URL from user's message
  console.log(`Testing extraction for: ${url}`);
  
  // Test without cookies first
  console.log('\n--- Testing WITHOUT cookies ---');
  const idNoCookies = await extractChatIdFromPage(url);
  console.log(`Result without cookies: ${idNoCookies}`);
  
  // Test with mock cookies (to see if it handles the header correctly)
  console.log('\n--- Testing WITH mock cookies ---');
  const idWithCookies = await extractChatIdFromPage(url, 'test_cookie=123');
  console.log(`Result with mock cookies: ${idWithCookies}`);
}

test().catch(console.error);
