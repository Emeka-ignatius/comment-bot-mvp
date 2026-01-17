# Neon Database Connection Timeout Fix

## Issue
Getting `CONNECT_TIMEOUT` errors when connecting to Neon database, especially in the job queue processor.

## Changes Made

### 1. Improved Database Connection Configuration (`server/db.ts`)
- **Increased timeout**: Changed from 10s to 30s (Neon can be slow to wake up)
- **Connection pooling**: Detects pooled connections and uses appropriate pool size
- **Better error handling**: Properly cleans up failed connections
- **Connection testing**: Tests connection before marking as ready
- **Serverless optimizations**: 
  - `prepare: false` - Disables prepared statements (can cause issues with serverless)
  - `idle_timeout: 20` - Closes idle connections
  - `max_lifetime: 30min` - Limits connection lifetime

### 2. Job Queue Error Handling (`server/automation/jobQueue.ts`)
- Added try-catch around database queries
- Handles `CONNECT_TIMEOUT` and `ECONNREFUSED` gracefully
- Retries after 10 seconds on connection failures
- Prevents job queue from crashing on intermittent connection issues

## Configuration

### Using Pooled Connection (Recommended)
Neon provides two connection string types:
1. **Direct connection**: `postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname`
2. **Pooled connection**: `postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname`

**Use the pooled connection** (`-pooler` in hostname) for better performance and reliability.

### Environment Variables
```bash
# Use Neon pooled connection string
DATABASE_URL=postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require

# Optional: Disable local dev mode if you want to test real auth
LOCAL_DEV_MODE=false
```

## Troubleshooting

### Still Getting Timeouts?

1. **Check Your Connection String**:
   ```bash
   # Verify it's the pooled connection
   echo $DATABASE_URL | grep pooler
   ```

2. **Test Connection Directly**:
   ```bash
   # Using psql
   psql "$DATABASE_URL" -c "SELECT 1;"
   
   # Or using node
   node -e "const postgres = require('postgres'); const sql = postgres(process.env.DATABASE_URL); sql\`SELECT 1\`.then(() => console.log('Connected!')).catch(console.error);"
   ```

3. **Check Neon Dashboard**:
   - Verify your database is active (not paused)
   - Check connection limits
   - Review connection logs

4. **Network Issues**:
   - Check firewall settings
   - Verify you can reach Neon's servers
   - Try from a different network

5. **Connection String Format**:
   - Ensure it includes `?sslmode=require`
   - Remove any `&channel_binding=require` (can cause issues)
   - Use the pooled connection URL

### Connection String Format
```
✅ Good (Pooled):
postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require

✅ Good (Direct):
postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

❌ Bad (Missing SSL):
postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname

❌ Bad (Has channel_binding):
postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require&channel_binding=require
```

## Expected Behavior

- **First Connection**: May take 5-30 seconds (Neon waking up)
- **Subsequent Connections**: Should be fast (< 1 second)
- **Job Queue**: Will retry automatically on connection failures
- **Server Startup**: Should connect within 30 seconds

## Monitoring

Watch for these log messages:
- `[Database] Connected to Postgres database (pooled)` - Success!
- `[Database] Failed to connect:` - Connection error (check logs)
- `[JobQueue] Database connection timeout, will retry in 10 seconds` - Auto-retry in progress

## Next Steps

1. **Restart your dev server**:
   ```bash
   pnpm dev
   ```

2. **Check the logs** for connection messages

3. **Test the connection** by visiting the dashboard

4. **If issues persist**:
   - Verify your DATABASE_URL in `.env`
   - Check Neon dashboard for any alerts
   - Try generating a new connection string from Neon
