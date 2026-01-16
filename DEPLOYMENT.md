# Qodex Production Deployment Guide

## Overview

This guide deploys Qodex in two stages:

**Stage A: MVP Deployment (Get Live URL for Testing)**
- Deploy to Render immediately
- No authentication - open access for user testing
- Discussions stored in browser (existing behavior)

**Stage B: Production Auth (Add After User Testing)**
- WordPress SSO integration
- User-specific persistent discussions in Supabase
- JWT token authentication

---

## Progress Tracker

| Phase | Status | Description |
|-------|--------|-------------|
| **STAGE A: MVP** | | |
| Phase 1 | ✅ COMPLETE | Supabase Database Setup |
| Phase 2 | ⬚ NOT STARTED | Deploy to Render (Get Live URL) |
| Phase 3 | ⬚ NOT STARTED | User Testing & Feedback |
| **STAGE B: AUTH** | | |
| Phase 4 | ⬚ NOT STARTED | Backend Authentication |
| Phase 5 | ⬚ NOT STARTED | Frontend Authentication |
| Phase 6 | ⬚ NOT STARTED | WordPress SSO Configuration |
| Phase 7 | ⬚ NOT STARTED | Production Testing |

---

# STAGE A: MVP DEPLOYMENT

Get your app live for user testing with zero authentication.

---

# Phase 1: Supabase Database Setup ✅ COMPLETE

### What Was Completed
- [x] Supabase account created
- [x] Project created at `https://vosflamohodediuqfewn.supabase.co`
- [x] Database schema executed (3 tables: users, discussions, messages)
- [x] Environment variables added to `backend/.env`
- [x] Connection test passed

**Note:** The database is ready but won't be used until Stage B (auth). For MVP, discussions stay in browser localStorage.

---

# Phase 2: Deploy to Render ⬚ READY TO START

### Objectives
- Deploy backend (FastAPI) to Render
- Deploy frontend (Vite/React) to Render
- Get live URLs for user testing

### Prerequisites
- [x] GitHub repository with code pushed
- [x] `render.yaml` configuration file exists
- [ ] Render account created

### Step 2.1: Create Render Account ⬚

1. Go to https://render.com
2. Click "Get Started" → **Sign in with GitHub**
3. Authorize Render to access your repository

**Checkpoint:**
- [ ] Render account created
- [ ] GitHub connected

---

### Step 2.2: Deploy via Blueprint ⬚

1. In Render dashboard, click **"New"** → **"Blueprint"**
2. Select your **Qodex repository**
3. Render auto-detects `render.yaml`
4. Click **"Apply"**

This creates two services:
- `qodex-backend` (Web Service)
- `qodex-frontend` (Static Site)

**Checkpoint:**
- [ ] Both services appear in dashboard
- [ ] Services show "Building" status

---

### Step 2.3: Configure Backend Environment Variables ⬚

1. Click on `qodex-backend` service
2. Go to **"Environment"** tab
3. Add these variables:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://vosflamohodediuqfewn.supabase.co` |
| `SUPABASE_KEY` | Your Supabase anon key |
| `OPENAI_API_KEY` | Your OpenAI key |
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `MISTRAL_API_KEY` | Your Mistral key |
| `COHERE_API_KEY` | Your Cohere key |
| `PINECONE_API_KEY` | Your Pinecone key |
| `PINECONE_HOST` | Your Pinecone host URL |
| `CORS_ORIGINS` | `https://qodex-frontend.onrender.com` |
| `DEBUG` | `false` |

**Important:** Update `CORS_ORIGINS` after you see your actual frontend URL.

**Checkpoint:**
- [ ] All environment variables added
- [ ] No placeholder values

---

### Step 2.4: Configure Frontend Environment Variable ⬚

1. Click on `qodex-frontend` service
2. Go to **"Environment"** tab
3. Add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://qodex-backend.onrender.com` |

**Important:** Update after you see your actual backend URL.

**Checkpoint:**
- [ ] VITE_API_URL added

---

### Step 2.5: Wait for Deployment ⬚

1. Both services will build automatically
2. **Backend:** ~3-5 minutes (Python dependencies)
3. **Frontend:** ~1-2 minutes (npm build)
4. Watch logs for any errors

**Checkpoint:**
- [ ] Backend shows "Live" status
- [ ] Frontend shows "Live" status

---

### Step 2.6: Get Your Live URLs ⬚

After deployment completes, note your URLs:

- **Frontend:** `https://qodex-frontend.onrender.com` (or similar)
- **Backend:** `https://qodex-backend.onrender.com` (or similar)

**If URLs differ from expected, update:**
1. Backend `CORS_ORIGINS` → set to actual frontend URL
2. Frontend `VITE_API_URL` → set to actual backend URL
3. Services auto-redeploy after variable changes

**Checkpoint:**
- [ ] Frontend URL: ____________________
- [ ] Backend URL: ____________________
- [ ] CORS_ORIGINS matches frontend URL

---

### Step 2.7: Verify Deployment ⬚

**Test Backend:**
```bash
curl https://YOUR-BACKEND-URL.onrender.com/health
```

Expected:
```json
{"status":"healthy","providers":{"openai":true,...},"pinecone":true}
```

**Test Frontend:**
1. Open frontend URL in browser
2. Open DevTools (F12) → Console
3. Verify no CORS errors
4. Try sending a chat message

**Checkpoint:**
- [ ] Backend health check returns 200
- [ ] Frontend loads without errors
- [ ] Chat messages work
- [ ] AI responses stream correctly

---

### Phase 2 Complete! 🎉

You now have a **live URL** to share with users for testing.

**Free Tier Note:** Backend sleeps after 15 min inactivity. First request after sleep takes 30-60 seconds (cold start). This is fine for testing.

---

# Phase 3: User Testing & Feedback ⬚

### Objectives
- Share live URL with test users (educators)
- Gather feedback on features
- Identify bugs and improvements
- Decide which features to build next

### Testing Checklist

**Core Functionality:**
- [ ] Chat works with different AI providers
- [ ] Document upload works
- [ ] RAG/citations display correctly
- [ ] Sample questions dropdown works
- [ ] Nested sub-questions work
- [ ] Mobile responsive

**User Feedback to Gather:**
- [ ] Is the UI intuitive?
- [ ] Are AI responses helpful for climate education?
- [ ] What features are missing?
- [ ] Any confusing workflows?

### When to Move to Stage B

Move to Stage B (Authentication) when:
- ✅ Core features validated with users
- ✅ Clear need for user accounts identified
- ✅ WordPress site ready for SSO integration
- ✅ Ready for persistent user discussions

---

# STAGE B: PRODUCTION AUTHENTICATION

Add user accounts and persistent discussions after MVP validation.

---

# Phase 4: Backend Authentication ⬚ FUTURE

### What This Adds
- JWT token verification
- WordPress user sync to Supabase
- User-specific discussion storage
- Protected API endpoints

### Files to Create
- `backend/app/middleware/auth.py` - JWT verification
- `backend/app/services/user_service.py` - User CRUD
- `backend/app/services/discussion_service.py` - Supabase discussions

### Files to Modify
- `backend/app/config.py` - Add WORDPRESS_JWT_SECRET
- `backend/app/routers/discussions.py` - Use Supabase
- `backend/app/routers/chat.py` - Persist messages

### Environment Variables to Add
| Variable | Description |
|----------|-------------|
| `WORDPRESS_JWT_SECRET` | Must match WordPress JWT_AUTH_SECRET_KEY |

---

# Phase 5: Frontend Authentication ⬚ FUTURE

### What This Adds
- Auth context for React
- Token storage in localStorage
- Auth headers on API requests
- Login/logout UI

### Files to Create
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/components/auth/LoginButton.tsx`

### Files to Modify
- `frontend/src/services/api.ts` - Add auth headers
- `frontend/src/App.tsx` - Wrap with AuthProvider

### Environment Variables to Add
| Variable | Description |
|----------|-------------|
| `VITE_WORDPRESS_URL` | WordPress site URL for SSO redirect |

---

# Phase 6: WordPress SSO Configuration ⬚ FUTURE

### What This Adds
- WordPress JWT plugin setup
- SSO redirect endpoint
- CORS configuration for production
- Login button on WordPress site

### WordPress Changes
- Install "JWT Authentication for WP REST API" plugin
- Add `JWT_AUTH_SECRET_KEY` to wp-config.php
- Create SSO redirect endpoint in functions.php
- Add Qodex launch button shortcode

### The SSO Flow
```
1. User clicks "Launch Qodex" on WordPress
2. WordPress generates JWT token
3. Redirect to: qodex-frontend.onrender.com/?wp_token=xxx
4. Frontend captures token, stores in localStorage
5. API requests include Authorization: Bearer xxx
6. Backend verifies token, syncs user to Supabase
7. User's discussions persist across sessions
```

---

# Phase 7: Production Testing ⬚ FUTURE

### Full Auth Flow Test
- [ ] WordPress login works
- [ ] SSO redirect includes token
- [ ] Token captured by frontend
- [ ] API requests authenticated
- [ ] User created in Supabase
- [ ] Discussions persist to database
- [ ] Logout clears session
- [ ] Return visit loads previous discussions

---

# Appendix A: Environment Variables

## MVP Deployment (Stage A)

### Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon key |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Anthropic API key |
| `MISTRAL_API_KEY` | No | Mistral API key |
| `COHERE_API_KEY` | No | Cohere API key |
| `PINECONE_API_KEY` | Yes | Pinecone API key |
| `PINECONE_HOST` | Yes | Pinecone index host |
| `CORS_ORIGINS` | Yes | Frontend URL |
| `DEBUG` | No | Default: false |

### Frontend
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend URL |

## Auth Additions (Stage B)

### Backend (add to existing)
| Variable | Required | Description |
|----------|----------|-------------|
| `WORDPRESS_JWT_SECRET` | Yes | Must match WordPress |

### Frontend (add to existing)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_WORDPRESS_URL` | Yes | WordPress site URL |

---

# Appendix B: Troubleshooting

## CORS Errors
**Symptom:** Browser console shows CORS errors

**Fix:**
1. Check `CORS_ORIGINS` in backend matches frontend URL exactly
2. No trailing slash
3. Redeploy backend after changes

## Cold Start Timeout
**Symptom:** First request after idle times out

**This is normal for free tier:**
- Wait up to 60 seconds
- Subsequent requests are fast
- Upgrade to $7/month for always-on

## Build Failures
**Backend:**
- Check `requirements.txt` syntax
- Review build logs in Render dashboard

**Frontend:**
- Check `package.json` for errors
- Review build logs

---

# Appendix C: Cost Summary

## Stage A (MVP)
| Service | Cost |
|---------|------|
| Render Frontend | $0 (free static site) |
| Render Backend | $0 (free, sleeps after 15 min) |
| Supabase | $0 (free tier) |
| **Total** | **$0/month** |

## Stage B (Production)
| Service | Cost |
|---------|------|
| Render Frontend | $0 |
| Render Backend | $7/month (always-on, recommended) |
| Supabase | $0-25/month (depending on usage) |
| **Total** | **$7-32/month** |

---

# Quick Reference

## Current Status
- **Stage:** A (MVP)
- **Phase:** 2 (Deploy to Render)
- **Next Step:** Create Render account and deploy

## Commands

**Test backend locally:**
```bash
cd backend && uvicorn app.main:app --reload
```

**Test frontend locally:**
```bash
cd frontend && npm run dev
```

**Build frontend:**
```bash
cd frontend && npm run build
```

## Key Files
- `render.yaml` - Render deployment config
- `backend/.env` - Backend environment variables
- `backend/.env.production.example` - Production env template

## URLs (fill in after deployment)
- Frontend: ______________________
- Backend: ______________________
- Supabase: https://vosflamohodediuqfewn.supabase.co
