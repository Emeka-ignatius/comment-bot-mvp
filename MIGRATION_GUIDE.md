# Migration Guide: MySQL to Neon Postgres + Auth Options

## Current Situation

### Database
- **Current**: MySQL (via Drizzle)
- **Target**: Neon Postgres
- **Issue**: Schema uses MySQL-specific types that need conversion

### Authentication
- **Current**: Custom JWT-based auth (simple login endpoint)
- **Users**: Created via `POST /api/auth/login` with name/email
- **Not using**: AuthJS, NextAuth, or any OAuth provider

## Option 1: Keep Current Setup (Recommended for Vercel/Render)

### Pros
✅ Works everywhere (local, Vercel, Render)  
✅ No platform lock-in  
✅ Simple and straightforward  
✅ Already implemented  

### Cons
❌ Basic auth (name/email only, no password)  
❌ Need to migrate schema from MySQL to Postgres  

### Migration Steps

1. **Update Drizzle config for Postgres**
2. **Convert schema from MySQL to Postgres**
3. **Update database connection**
4. **Run migrations**

## Option 2: Revert to Manus

### Pros
✅ OAuth built-in  
✅ More features (notifications, etc.)  

### Cons
❌ **Won't work on Vercel/Render** - Manus OAuth only works on Manus platform  
❌ Platform lock-in  
❌ Can't deploy to your preferred platforms  

### If You Revert
- Local dev: Works with `LOCAL_DEV_MODE=true`
- Vercel/Render: **Will NOT work** - OAuth requires Manus platform

## Option 3: Add Proper Auth (Best Long-term)

### Use Auth.js (formerly NextAuth.js)
- Works with Express (not just Next.js)
- Supports multiple providers (Google, GitHub, Email, etc.)
- Works everywhere (local, Vercel, Render)
- Professional authentication

### Use Clerk / Supabase Auth
- Managed auth service
- Easy integration
- Works everywhere

## My Recommendation

**Go with Option 1 + Enhance Auth Later**

1. **Now**: Migrate to Neon Postgres, keep current simple auth
2. **Later**: Add Auth.js or Clerk for proper authentication
3. **Deploy**: Vercel (frontend) + Render (backend) as monorepo

This gives you:
- ✅ Working deployment on your preferred platforms
- ✅ Local development works
- ✅ Can enhance auth later without breaking changes
- ✅ No platform lock-in

## Next Steps

I can help you:
1. Migrate Drizzle schema from MySQL to Postgres
2. Update database connection for Neon
3. Optionally add Auth.js for proper authentication
4. Set up deployment configs for Vercel + Render

Which option do you prefer?
