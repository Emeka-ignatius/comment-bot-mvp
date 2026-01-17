# Troubleshooting Neon Connection Issues

## Current Issue
`drizzle-kit push` is hanging on "Pulling schema from database..." - this indicates a connection timeout.

## Your Connection String
```
postgresql://neondb_owner:npg_9lyjTNwnqUI3@ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## Troubleshooting Steps

### 1. Test Connection Directly

Try connecting with `psql` or a database client:
```bash
# If you have psql installed
psql "postgresql://neondb_owner:npg_9lyjTNwnqUI3@ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

### 2. Check Network Connectivity

```bash
# Test DNS resolution
ping ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech

# Test port connectivity (Postgres uses 5432)
telnet ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech 5432
```

### 3. Try Direct Connection (Not Pooler)

In your Neon dashboard, get the **direct connection** string (not pooler):
- Go to Neon dashboard
- Click on your database
- Get connection string
- Use the direct endpoint (without `-pooler`)

### 4. Simplify Connection String

Try removing `channel_binding=require`:
```
postgresql://neondb_owner:npg_9lyjTNwnqUI3@ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 5. Check Neon Dashboard

1. Go to https://console.neon.tech
2. Check if your database is **active**
3. Verify the connection string is correct
4. Check if there are any IP restrictions

### 6. Alternative: Use Neon's Connection Pooler

Neon provides a connection pooler. Try using:
- **Session mode**: `?sslmode=require`
- **Transaction mode**: `?sslmode=require&pgbouncer=true`

### 7. Test with Node.js Script

Create a test file `test-connection.js`:
```javascript
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: 'require'
});

try {
  const result = await sql`SELECT version()`;
  console.log('✅ Connected!', result);
  await sql.end();
} catch (error) {
  console.error('❌ Connection failed:', error);
  process.exit(1);
}
```

Run: `node test-connection.js`

## Quick Fix: Update .env

Make sure your `.env` has **only one** DATABASE_URL (the Neon one):

```bash
# Remove or comment out the old MySQL one
# DATABASE_URL=mysql://...

# Keep only the Neon one
DATABASE_URL=postgresql://neondb_owner:npg_9lyjTNwnqUI3@ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

## If Still Failing

1. **Check Neon Status**: https://status.neon.tech
2. **Try Different Endpoint**: Use direct connection instead of pooler
3. **Check Firewall**: Make sure your network allows outbound connections
4. **Contact Neon Support**: If database is inaccessible

## Once Connected

After connection works, run:
```bash
pnpm db:push
```

This will create all tables and enums in your Neon database.
