---
name: project-domain-restriction
description: Only @wearenext.io and @nextventures.io email addresses can register or log in
metadata:
  type: project
---

`ALLOWED_EMAIL_DOMAINS = {"wearenext.io", "nextventures.io"}` in `backend/server.py`.

`_check_email_domain()` is called in `auth_register` and `auth_google_callback`. Returns HTTP 403 with clear message if domain doesn't match.

**Why:** Access is restricted to NEXT Ventures org staff only.

**How to apply:** Any future auth routes must also call `_check_email_domain()`. Frontend shows the restriction hint on Login and Register pages.
