import sys
import os

# Add backend directory to path so server.py's relative imports resolve
_backend = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from server import app  # noqa: F401  — Vercel uses this as the ASGI entrypoint
