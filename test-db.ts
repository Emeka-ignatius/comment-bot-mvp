
import { getDb } from './server/db';

async function test() {
  console.log('Testing database connectivity...');
  try {
    const db = await getDb();
    if (!db) {
      console.log('❌ Database URL not set or connection failed.');
      return;
    }
    console.log('✅ Database connection initialized!');
    
    // Try a simple query
    // Note: This might fail if tables aren't created yet, which is also useful info
    try {
      const result = await db.execute('SELECT 1 + 1 AS result');
      console.log('✅ Simple query successful:', result);
    } catch (queryError) {
      console.error('❌ Simple query failed:', queryError.message);
    }
  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

test().catch(console.error);
