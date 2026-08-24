# MongoDB to Supabase Migration Guide

## Overview

This guide explains how to migrate the Booqlly backend from MongoDB to Supabase.

## What Changed

### Database
- **MongoDB** → **Supabase (PostgreSQL)**
- Mongoose models → Supabase tables with SQL schema
- MongoDB ObjectId → UUID primary keys
- MongoDB aggregation pipelines → PostgreSQL functions and triggers

### Authentication
- **Custom JWT + bcrypt** → **Supabase Auth**
- **passport-google-oauth20** → **Supabase Auth OAuth providers**
- Password hashing handled by Supabase Auth
- JWT verification via Supabase `auth.getUser()`

### File Storage
- **Cloudinary** → **Supabase Storage**
- Image uploads stored in `business-images` bucket
- Base64 fallback removed (Supabase Storage is always available)

### Email
- **Nodemailer** → kept as-is (Supabase doesn't replace transactional email)
- Database queries in email service updated to use Supabase

## Migration Steps

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings → API
3. Also get your service_role key (keep this secret!)

### Step 2: Run Database Schema

1. Open your Supabase project
2. Go to **SQL Editor**
3. Copy and paste the contents of `supabase-schema.sql`
4. Click **Run** to create all tables, indexes, functions, and triggers

### Step 3: Configure Authentication

1. In Supabase Dashboard, go to **Authentication → Providers**
2. Enable **Email** provider (ensure "Confirm email" is disabled for this app)
3. If using Google OAuth:
   - Enable **Google** provider
   - Enter your Google Client ID and Secret
   - Set the Authorized redirect URI to: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Go to **Authentication → URL Configuration**
   - Set Redirect URLs to include your frontend URL

### Step 4: Configure Storage

1. Go to **Storage** in Supabase Dashboard
2. The `business-images` bucket should already be created by the schema
3. Verify the bucket is set to **Public**

### Step 5: Install Dependencies

```bash
cd Backend
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- Remove old deps: `mongoose`, `bcryptjs`, `passport`, `passport-google-oauth20`, `mongodb`

### Step 6: Configure Environment Variables

Create a `.env` file in the Backend directory:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

FRONTEND_URL=http://localhost:5173
PORT=3000

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Step 7: Migrate Existing Data

If you have existing MongoDB data, use the migration script:

```bash
node scripts/migrate-to-supabase.js
```

This script will:
1. Connect to MongoDB
2. Read all users, services, appointments, and reviews
3. Insert them into Supabase
4. Preserve all relationships and data

### Step 8: Test the Application

```bash
npm run dev
```

Test all endpoints:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/business` - List businesses
- `POST /api/dashboard/appointments` - Create appointment
- etc.

### Step 9: Update Frontend

The frontend API calls remain the same! The endpoints are unchanged:
- `/api/auth/*` - same endpoints
- `/api/business/*` - same endpoints
- `/api/services/*` - same endpoints
- `/api/dashboard/*` - same endpoints

The only change needed is the token format. Supabase returns `access_token` instead of a custom JWT. Update the frontend auth context to store the Supabase token.

## Key Architecture Changes

### Before (MongoDB)
```
Client → Express → Mongoose → MongoDB
                         ↓
                    Password: bcrypt
                    Auth: Custom JWT
                    Files: Cloudinary
```

### After (Supabase)
```
Client → Express → Supabase Client → PostgreSQL
                         ↓
                    Password: Supabase Auth
                    Auth: Supabase JWT
                    Files: Supabase Storage
```

## Important Notes

### UUIDs Instead of ObjectIds
- All IDs are now UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Frontend should handle UUID strings properly

### Authentication Flow
1. User registers/logs in → Supabase Auth returns `access_token`
2. Frontend stores token in localStorage
3. All API requests include `Authorization: Bearer <access_token>`
4. Backend verifies token using `supabase.auth.getUser()`

### Row Level Security (RLS)
- Supabase uses PostgreSQL RLS for data access control
- The schema includes policies for:
  - Public read access to businesses, services, and reviews
  - Authenticated users can create appointments
  - Business owners can manage their own services and appointments
  - Users can manage their own reviews

### Rating Aggregation
- Instead of MongoDB aggregation pipelines, we use PostgreSQL triggers
- `update_business_rating()` and `update_service_rating()` functions
- Triggers automatically update ratings when reviews change

## Troubleshooting

### "Database not connected" errors
- Check that Supabase URL and keys are correct in `.env`
- Verify the schema was run successfully in SQL Editor

### Authentication errors
- Ensure Supabase Auth providers are configured
- Check that email provider is enabled
- For Google OAuth, verify redirect URIs are correct

### Upload errors
- Verify `business-images` bucket exists and is public
- Check RLS policies allow authenticated uploads

### CORS errors
- Add your frontend URL to `allowedOrigins` in `index.js`
- Or configure CORS in Supabase Dashboard → API → CORS

## Rollback Plan

If you need to rollback to MongoDB:
1. Keep the old `src/models/` directory (rename to `src/models-mongo/`)
2. Keep the old route files (rename to `routes-mongo/`)
3. Restore `package.json` from git
4. Run `npm install` to restore MongoDB dependencies
