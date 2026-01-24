import postgres from 'postgres';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Read SQL schema file
const schemaSql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

console.log('🔍 Connecting to database...');
console.log('   URL:', databaseUrl.replace(/:[^:@]+@/, ':****@'));

// Try both pooler and direct connection
const urlsToTry = [
  databaseUrl,
  databaseUrl.replace('-pooler', ''), // Direct connection
];

let connected = false;

for (const url of urlsToTry) {
  const sql = postgres(url, {
    max: 1,
    connect_timeout: 30,
    ssl: 'require',
    prepare: false,
  });

  try {
    console.log(`\n📡 Trying: ${url.includes('-pooler') ? 'Pooler' : 'Direct'} connection...`);
    
    // Test connection
    await sql`SELECT 1`;
    console.log('✅ Connected!');
    
    // Split SQL by semicolons and execute each statement
    console.log('\n📝 Applying schema...');
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await sql.unsafe(statement);
          console.log(`   ✓ Statement ${i + 1}/${statements.length} executed`);
        } catch (err) {
          // Ignore "already exists" errors
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log(`   ⚠ Statement ${i + 1} skipped (already exists)`);
          } else {
            console.error(`   ✗ Statement ${i + 1} failed:`, err.message);
            throw err;
          }
        }
      }
    }

    console.log('\n✅ Schema applied successfully!');
    await sql.end();
    connected = true;
    break;
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}`);
    await sql.end().catch(() => {});
    continue;
  }
}

if (!connected) {
  console.error('\n❌ Could not connect to database with either endpoint.');
  console.error('\n💡 Alternative: Use Neon\'s SQL Editor');
  console.error('   1. Go to https://console.neon.tech');
  console.error('   2. Open your database project');
  console.error('   3. Click "SQL Editor"');
  console.error('   4. Copy and paste the contents of schema.sql');
  console.error('   5. Run the SQL');
  process.exit(1);
}
