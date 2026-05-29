---
title: FNmarkets API
emoji: 📊
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# FNmarkets Backend API

FastAPI backend for FNmarkets — prop-firm finance & accounting platform.

Set the following environment variables in Space Settings → Variables and secrets:

| Variable | Description |
|----------|-------------|
| `DB_BACKEND` | `postgres` |
| `POSTGRES_URL` | Full PostgreSQL connection string |
| `JWT_SECRET` | Long random secret for signing JWTs |
| `JWT_ALGORITHM` | `HS256` |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret |
| `APP_BASE_URL` | This Space URL e.g. `https://username-fnmarkets-api.hf.space` |
| `FRONTEND_URL` | Your Vercel frontend URL |
| `CORS_ORIGINS` | Your Vercel frontend URL |
