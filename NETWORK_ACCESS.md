# 🌐 Network Access Configuration

## What was fixed
- ✅ Backend CORS now reads from `.env` (not hardcoded)
- ✅ Frontend auto-detects backend host (no hardcoded URLs)
- ✅ Works from both `localhost` AND `192.168.0.2`

## How to Access

### ✅ Option 1: Access from Localhost (Recommended for local development)
```bash
# Terminal 1 - Backend
cd backend
python -m uvicorn server:app --host 127.0.0.1 --port 5000 --reload

# Terminal 2 - Frontend
cd frontend
pnpm start

# Browser
open http://localhost:3000
```

### ✅ Option 2: Access from Network IP (Recommended for mobile/other devices)
```bash
# Terminal 1 - Backend (listen on all interfaces)
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 5000 --reload

# Terminal 2 - Frontend (listen on all interfaces)
cd frontend
pnpm start

# Browser on same network
open http://192.168.0.2:3000
# or your actual IP: http://YOUR_IP:3000
```

### ✅ Option 3: Access from BOTH localhost AND network IP (simultaneous)
- Start backend on `0.0.0.0` (all interfaces)
- Start frontend on `0.0.0.0` (all interfaces)
- Then access from:
  - `http://localhost:3000` ← works
  - `http://192.168.0.2:3000` ← works
  - `http://YOUR_IP:3000` ← works

---

## Current Configuration

### Backend (.env)
```env
DB_BACKEND="mongo"  # or "postgres"
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.2:3000"
```

### Frontend (.env)
```env
REACT_APP_BACKEND_URL=http://localhost:5000
# ↓ If NOT set, frontend auto-detects using window.location.hostname
```

---

## 🚀 Quick Commands

### Localhost Only (127.0.0.1)
```bash
# Backend
cd backend && python -m uvicorn server:app --host 127.0.0.1 --port 5000 --reload

# Frontend
cd frontend && pnpm start

# Access: http://localhost:3000
```

### Network IP (0.0.0.0 — all interfaces)
```bash
# Backend
cd backend && python -m uvicorn server:app --host 0.0.0.0 --port 5000 --reload

# Frontend  
cd frontend && pnpm start

# Access: http://192.168.0.2:3000 or http://YOUR_IP:3000
```

---

## ✅ Test Connectivity

### From Localhost
```bash
# Should work
curl http://localhost:5000/api/
curl http://localhost:3000

# Should NOT work (backend on different IP)
curl http://192.168.0.2:5000/api/  # ← Will fail if backend on localhost only
```

### From Network IP
```bash
# Should work (if backend on 0.0.0.0)
curl http://192.168.0.2:5000/api/
curl http://192.168.0.2:3000

# Will fail if backend listening on 127.0.0.1 only
curl http://127.0.0.1:5000/api/  # ← Backend sees request from wrong interface
```

---

## 🔧 If You Get "Connection Refused" Errors

### Check 1: Is backend running?
```bash
lsof -i :5000
# If nothing shows, backend isn't running
```

### Check 2: Backend listening on right interface
```bash
# See what the backend is listening on
netstat -an | grep 5000

# If shows 127.0.0.1:5000 → can only access from localhost
# If shows 0.0.0.0:5000 → can access from any host
```

### Check 3: Is frontend on same host as browser?
```
✅ Browser on localhost → Frontend on localhost:3000 → Backend on 0.0.0.0:5000
✅ Browser on 192.168.0.2 → Frontend on 192.168.0.2:3000 → Backend on 0.0.0.0:5000
❌ Browser on 192.168.0.2 → Frontend on localhost:3000 → Fails (different hosts)
```

### Check 4: CORS allowed?
```bash
# If frontend can't reach backend, check CORS in backend/.env
# Make sure origin is listed:
CORS_ORIGINS="http://localhost:3000,http://192.168.0.2:3000"
```

---

## 📱 Mobile/Other Device Access

To access from mobile or another computer on your network:

```bash
# 1. Find your IP
ipconfig getifaddr en0  # macOS
# or: hostname -I  # Linux
# Result: 192.168.0.2

# 2. Start backend on all interfaces
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 5000

# 3. Start frontend on all interfaces  
cd frontend
pnpm start

# 4. On mobile/other device, open:
# http://192.168.0.2:3000
```

---

## 🎯 Recommended Setup

For **development** with multiple access methods:

```bash
# Terminal 1 - Backend (all interfaces, auto-reload)
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 5000 --reload

# Terminal 2 - Frontend (all interfaces, auto-reload)
cd frontend
pnpm start

# Then access from:
# - Localhost: http://localhost:3000
# - Network: http://192.168.0.2:3000
# - Other devices: http://YOUR_IP:3000
```

---

## 📋 Troubleshooting Checklist

| Issue | Solution |
|-------|----------|
| `Connection refused on port 5000` | Start backend: `python -m uvicorn server:app --host 0.0.0.0 --port 5000` |
| `Connection refused on port 3000` | Start frontend: `pnpm start` |
| `CORS error` | Update `backend/.env` CORS_ORIGINS to include your host |
| `Frontend can't reach backend` | Ensure backend is listening on `0.0.0.0`, not `127.0.0.1` |
| `Works on localhost, not on IP` | Backend needs `--host 0.0.0.0` instead of `--host 127.0.0.1` |
| `Port already in use` | Kill existing process: `lsof -i :5000` then `kill -9 PID` |

