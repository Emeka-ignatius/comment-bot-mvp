# Supabase Setup Guide

## Quick Setup Steps

### 1. Create Supabase Project
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - Project name: `comment-bot-mvp` (or your choice)
   - Database password: (save this!)
   - Region: Choose closest to you
4. Wait 2-3 minutes for project to be ready

### 2. Get Connection String
1. In Supabase dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Select **URI** tab
4. Copy the connection string (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your actual database password

### 3. Update .env File
Replace the `DATABASE_URL` in your `.env` file with the Supabase connection string:
```env
DATABASE_URL=postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres
```

### 4. Apply Schema

**Option A: Using Drizzle (Recommended)**
```bash
pnpm db:push
```

**Option B: Using Supabase SQL Editor**
1. Go to Supabase dashboard → **SQL Editor**
2. Copy contents of `schema.sql`
3. Paste and click "Run"

**Option C: Using the apply script**
```bash
node apply-schema.mjs
```

## Connection String Format

Supabase connection strings look like:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Make sure to:
- Replace `[PASSWORD]` with your actual database password
- URL-encode the password if it contains special characters
- Use the **URI** format, not the other connection string formats

## Troubleshooting

### Connection Issues
- Make sure your password is URL-encoded if it has special characters
- Check that your project is fully provisioned (can take 2-3 minutes)
- Verify the connection string in Settings → Database

### Schema Issues
- If you get "already exists" errors, that's fine - tables are already created
- You can drop and recreate if needed (be careful with production data!)

## Next Steps

Once schema is applied:
1. Test connection: `node test-db-connection.mjs`
2. Start your app: `pnpm dev`
3. Check database in Supabase dashboard → **Table Editor**
