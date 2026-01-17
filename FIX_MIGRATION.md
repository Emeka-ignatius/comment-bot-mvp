# Fixing Migration Issues

## Problem
1. Old MySQL migration snapshots are incompatible with Postgres
2. DNS resolution error (network/connection issue)

## Solution

### Option 1: Use `drizzle-kit push` (Recommended for Fresh Start)

This directly syncs your schema to the database without migration files:

```bash
pnpm db:push
```

This will:
- Skip old migration files
- Directly apply your Postgres schema
- Create all tables and enums

### Option 2: Clean Up and Start Fresh

If you want to use migrations:

1. **Backup old migrations** (optional):
```bash
mv drizzle drizzle.mysql.backup
mkdir drizzle
```

2. **Generate fresh migrations**:
```bash
pnpm db:generate
```

3. **Apply migrations**:
```bash
pnpm db:migrate
```

## Fixing DNS Error

The DNS error `EAI_AGAIN` usually means:
- Network connectivity issue
- Connection string format issue
- Database not accessible

### Check Your Connection String

Your Neon connection string should look like:
```
postgresql://user:password@ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech/dbname?sslmode=require
```

### Common Issues:

1. **Missing SSL mode**: Add `?sslmode=require` to connection string
2. **Wrong hostname**: Make sure you're using the pooler endpoint (ends with `-pooler`)
3. **Network/Firewall**: Check if your network allows connections to Neon

### Test Connection Manually

```bash
# Test if you can reach the database
ping ep-withered-cloud-ahqi2jgn-pooler.c-3.us-east-1.aws.neon.tech

# Or use psql if installed
psql "your-connection-string"
```

## Quick Fix Steps

1. **Use push instead of migrate** (already updated in package.json):
   ```bash
   pnpm db:push
   ```

2. **If DNS error persists**, check:
   - Your `.env` file has correct `DATABASE_URL`
   - Connection string includes `?sslmode=require`
   - You're connected to the internet
   - Neon database is active in dashboard

3. **If still failing**, try:
   ```bash
   # Use direct connection (not pooler)
   # Change -pooler to direct endpoint in your connection string
   ```
