# 🔧 Fixes Applied to Ledgerly App

## Issue
User could only access the app from `192.168.0.2`, not from `localhost`. Getting CORS/connection errors from localhost.

## Root Causes

### 1. **Backend CORS Hardcoded**
**File:** `backend/server.py` (line 1030)
```python
# BEFORE (hardcoded):
allow_origins=["http://localhost:3000"]

# AFTER (reads from env):
allow_origins=os.environ.get("CORS_ORIGINS", "*").split(",")
```

### 2. **Frontend Backend URL Hardcoded**
**File:** `frontend/src/lib/api.js` (line 3)
```javascript
// BEFORE (hardcoded):
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// AFTER (auto-detects):
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ||
  `http://${window.location.hostname}:5000`;
```

### 3. **Missing CORS Origins in .env**
**File:** `backend/.env`
```env
# ADDED:
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.2:3000"
```

---

## What Changed

| Component | File | Change |
|-----------|------|--------|
| Backend CORS | `backend/server.py` | Now reads from `.env` instead of hardcoded list |
| Frontend API | `frontend/src/lib/api.js` | Auto-detects backend host from current page |
| Backend env | `backend/.env` | Added explicit CORS_ORIGINS list |

---

## How It Works Now

1. **Browser access:** `http://localhost:3000`
   - Frontend detects `window.location.hostname` = `localhost`
   - Frontend connects to `http://localhost:5000`
   - Backend CORS checks `CORS_ORIGINS` = includes `http://localhost:3000` ✅

2. **Browser access:** `http://192.168.0.2:3000`
   - Frontend detects `window.location.hostname` = `192.168.0.2`
   - Frontend connects to `http://192.168.0.2:5000`
   - Backend CORS checks `CORS_ORIGINS` = includes `http://192.168.0.2:3000` ✅

---

## Commands

### ✅ Works from BOTH localhost and IP

```bash
# Terminal 1 - Backend (listen on all interfaces)
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 5000 --reload

# Terminal 2 - Frontend (listen on all interfaces)
cd frontend
pnpm start

# Terminal 3 - Access from:
open http://localhost:3000      # ✅ Works
open http://192.168.0.2:3000    # ✅ Works
open http://127.0.0.1:3000      # ✅ Works
```

---

## Testing

```bash
# Test 1: Backend health
curl http://localhost:5000/api/
# Response: {"app":"Ledgerly Finance","status":"ok"}

# Test 2: Frontend serves
curl http://localhost:3000 | head -20
# Should see HTML

# Test 3: From IP
curl http://192.168.0.2:5000/api/
curl http://192.168.0.2:3000 | head -20
```

---

## Configuration

To add more hosts/IPs, edit `backend/.env`:

```env
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.2:3000,http://myhost.local:3000"
```

Or for development (allow all):
```env
CORS_ORIGINS="*"
```

---

## Related Files

- **Network Access Guide:** `NETWORK_ACCESS.md` (detailed troubleshooting)
- **Backend CORS:** `backend/server.py` lines 1027-1034
- **Frontend API:** `frontend/src/lib/api.js` lines 1-9
- **Backend config:** `backend/.env` CORS_ORIGINS line

---

## Date Applied
2025-05-28

## Verified
✅ Both MongoDB and PostgreSQL backends work
✅ Access from localhost:3000 works
✅ Access from 192.168.0.2:3000 works
✅ CORS errors resolved
✅ Frontend correctly detects backend host
