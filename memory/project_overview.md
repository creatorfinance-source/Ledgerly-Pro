---
name: project-overview
description: FNmarkets/Ledgerly FP&A dashboard — FastAPI backend + React frontend for NEXT Ventures
metadata:
  type: project
---

FNmarkets is a production-grade FP&A accounting dashboard for NEXT Ventures (prop-trading/CFD firm). FastAPI (Python) backend with MongoDB, React frontend deployed on Vercel. Financial data covers Jan–May 2026 for FundedNext/FNmarkets.

**Why:** Used for internal financial reporting across the NEXT Ventures org.

**How to apply:** When making backend changes, remember data is shared across all authenticated org users (seed-next transactions). Domain restriction enforced at registration and Google OAuth login.
