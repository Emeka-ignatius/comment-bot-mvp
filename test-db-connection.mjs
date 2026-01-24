import postgres from 'postgres';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

console.log('🔍 Testing connection to:', databaseUrl.replace(/:[^:@]+@/, ':****@')); // Hide password

// Try with pooler endpoint first
console.log('\n📡 Attempting connection with pooler endpoint...');
let sql = postgres(databaseUrl, {
  max: 1,
  connect_timeout: 30, // Increased timeout
  ssl: 'require',
  prepare: false,
});

try {
  const result = await sql`SELECT version(), current_database()`;
  console.log('✅ Connection successful!');
  console.log('   Database:', result[0].current_database);
  console.log('   Version:', result[0].version.split(',')[0]);
  await sql.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  console.error('   Error code:', error.code);
  console.error('   Error syscall:', error.syscall);
  
  if (error.code === 'EAI_AGAIN') {
    console.error('\n💡 DNS resolution failed. Possible issues:');
    console.error('   1. The database endpoint might not exist');
    console.error('   2. Check Neon dashboard to verify the connection string');
    console.error('   3. Try using the direct connection (non-pooler) endpoint');
    console.error('   4. The database might not be fully provisioned yet');
  }
  
  await sql.end().catch(() => {});
  
  // Try direct connection (non-pooler) if pooler fails
  if (error.code === 'CONNECT_TIMEOUT' || error.code === 'EAI_AGAIN') {
    console.log('\n🔄 Trying direct connection (non-pooler) endpoint...');
    const directUrl = databaseUrl.replace('-pooler', '');
    console.log('   Direct URL:', directUrl.replace(/:[^:@]+@/, ':****@'));
    
    sql = postgres(directUrl, {
      max: 1,
      connect_timeout: 30,
      ssl: 'require',
      prepare: false,
    });
    
    try {
      const result = await sql`SELECT version(), current_database()`;
      console.log('✅ Direct connection successful!');
      console.log('   Database:', result[0].current_database);
      console.log('   Version:', result[0].version.split(',')[0]);
      console.log('\n💡 Use this connection string in your .env:');
      console.log('   ' + directUrl.replace(/:[^:@]+@/, ':****@'));
      await sql.end();
      process.exit(0);
    } catch (directError) {
      console.error('❌ Direct connection also failed:', directError.message);
      console.error('   Error code:', directError.code);
      await sql.end().catch(() => {});
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}
