# Ledgerly Finance & Audit — Main FastAPI application.
from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

# Allow OAuth over http://localhost in development
os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from db import db, startup_db, shutdown_db
from starlette.middleware.cors import CORSMiddleware

from auth import (
    create_jwt,
    create_session,
    fetch_emergent_user,
    get_current_user,
    hash_password,
    upsert_user,
    verify_password,
)
from models import (
    Account,
    AccountCreate,
    AccountUpdate,
    Integration,
    Invoice,
    InvoiceCreate,
    InvoiceUpdate,
    JournalEntryCreate,
    LoginPayload,
    Receipt,
    ReceiptCreate,
    RegisterPayload,
    SessionExchange,
    SettingsUpdate,
    Transaction,
    TransactionCreate,
    TransactionUpdate,
    UserPublic,
)
from mock_psp import generate_mock_transactions
import coa
from statements import (
    balance_sheet,
    cash_flow,
    cost_center_pnl,
    general_ledger,
    profit_and_loss,
    statement_of_equity,
    tax_summary,
    trial_balance,
)
from coa import CHART_OF_ACCOUNTS, COST_CENTERS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await startup_db()   # creates connections + indexes/schema
    yield
    await shutdown_db()  # closes pool / Motor client


app = FastAPI(title="Ledgerly Finance API", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------- Helper: dependency that injects current user ----------
async def current_user(request: Request) -> dict:
    return await get_current_user(request, db)


# Default chart of accounts seed — NEXT Ventures Ltd. prop/CFD firm chart
# (assets, liabilities, equity + categorised income/expense ledgers). Sourced
# from coa.py so the seed script and statements stay in sync.
DEFAULT_ACCOUNTS = CHART_OF_ACCOUNTS


async def ensure_seed_cost_centers(user_id: str):
    """Seed the CC01–CC11 / CORP cost centres for a user (idempotent)."""
    try:
        existing = await db.cost_centers.count_documents({"user_id": user_id})
    except Exception:
        return  # cost_centers collection/table not available — skip silently
    if existing > 0:
        return
    docs = [{
        "cc_code": cc["cc_code"],
        "user_id": user_id,
        "name": cc["name"],
        "type": cc["type"],
        "allocation_method": cc["allocation_method"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    } for cc in COST_CENTERS]
    if docs:
        await db.cost_centers.insert_many(docs)


async def ensure_seed_accounts(user_id: str):
    await ensure_seed_cost_centers(user_id)
    existing = await db.accounts.count_documents({"user_id": user_id})
    if existing > 0:
        return
    docs = []
    for a in DEFAULT_ACCOUNTS:
        docs.append({
            "account_id": f"acc_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "name": a["name"],
            "code": a["code"],
            "type": a["type"],
            "currency": "USD",
            "description": "",
            "category": a.get("category", ""),
            "subcategory": a.get("subcategory", ""),
            "cost_center": a.get("cost_center", ""),
            "is_default": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    if docs:
        await db.accounts.insert_many(docs)


# ============================================================
# AUTH ROUTES
# ============================================================

@api.get("/")
async def root():
    return {"app": "Ledgerly Finance", "status": "ok"}


def _google_auth_redirect_uri(request: Request) -> str:
    base = os.environ.get("APP_BASE_URL") or f"{request.url.scheme}://{request.url.netloc}"
    return f"{base}/api/auth/google/callback"


@api.get("/auth/google/login")
async def auth_google_login(request: Request):
    if not (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET):
        raise HTTPException(status_code=400, detail="Google OAuth not configured")
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    )
    flow.redirect_uri = _google_auth_redirect_uri(request)
    auth_url, state = flow.authorization_url(prompt="select_account")
    await db.google_auth_state.update_one(
        {"state": state},
        {"$set": {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "code_verifier": flow.code_verifier,
        }},
        upsert=True,
    )
    return RedirectResponse(url=auth_url)


@api.get("/auth/google/callback")
async def auth_google_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code/state")
    
    # Verify state
    sd = await db.google_auth_state.find_one({"state": state})
    if not sd:
        raise HTTPException(status_code=400, detail="Invalid state")
    await db.google_auth_state.delete_one({"state": state})

    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
        state=state,
    )
    flow.redirect_uri = _google_auth_redirect_uri(request)
    flow.code_verifier = sd.get("code_verifier")
    flow.fetch_token(authorization_response=str(request.url))
    
    # Get user info from ID token or userinfo endpoint
    from googleapiclient.discovery import build
    service = build("oauth2", "v2", credentials=flow.credentials)
    user_info = service.userinfo().get().execute()
    
    email = user_info.get("email")
    name = user_info.get("name", "")
    picture = user_info.get("picture", "")

    if not email:
        raise HTTPException(status_code=400, detail="Could not get email from Google")

    user = await upsert_user(
        db,
        email=email,
        name=name,
        picture=picture,
        provider="google",
    )
    await ensure_seed_accounts(user["user_id"])
    token = create_jwt(user["user_id"])
    
    # Redirect to frontend with token
    # We use hash fragment so the token doesn't stay in browser history as much as query params
    frontend_url = os.environ.get("FRONTEND_URL", "https://fpna.nextlab.info")
    return RedirectResponse(url=f"{frontend_url}/auth-callback#token={token}")


@api.post("/auth/register")
async def auth_register(payload: RegisterPayload):
    existing = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if existing and existing.get("password_hash"):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = await upsert_user(
        db,
        email=payload.email,
        name=payload.name,
        provider="email",
        password_hash=hash_password(payload.password),
    )
    await ensure_seed_accounts(user["user_id"])
    token = create_jwt(user["user_id"])
    user.pop("password_hash", None)
    return {"access_token": token, "token_type": "bearer", "user": user}


@api.post("/auth/login")
async def auth_login(payload: LoginPayload):
    user = await db.users.find_one({"email": payload.email}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await ensure_seed_accounts(user["user_id"])
    token = create_jwt(user["user_id"])
    user.pop("password_hash", None)
    return {"access_token": token, "token_type": "bearer", "user": user}


@api.post("/auth/session")
async def auth_session(payload: SessionExchange, response: Response):
    """Exchange Emergent session_id for backend session cookie."""
    data = await fetch_emergent_user(payload.session_id)
    user = await upsert_user(
        db,
        email=data["email"],
        name=data.get("name", ""),
        picture=data.get("picture", ""),
        provider="google",
    )
    await ensure_seed_accounts(user["user_id"])
    sess = await create_session(db, user["user_id"])
    response.set_cookie(
        key="session_token",
        value=sess["session_token"],
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    user.pop("password_hash", None)
    return {"user": user, "session_token": sess["session_token"]}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(current_user)):
    user.pop("password_hash", None)
    return user


@api.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============================================================
# SETTINGS
# ============================================================

@api.patch("/settings")
async def update_settings(payload: SettingsUpdate, user: dict = Depends(current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})


# ============================================================
# ACCOUNTS (Chart of Accounts)
# ============================================================

@api.get("/accounts")
async def list_accounts(user: dict = Depends(current_user)):
    rows = await db.accounts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("code", 1).to_list(1000)
    return rows


@api.post("/accounts")
async def create_account(payload: AccountCreate, user: dict = Depends(current_user)):
    acc = Account(user_id=user["user_id"], **payload.model_dump())
    doc = acc.model_dump()
    await db.accounts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/accounts/{account_id}")
async def update_account(account_id: str, payload: AccountUpdate, user: dict = Depends(current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.accounts.update_one({"account_id": account_id, "user_id": user["user_id"]}, {"$set": update})
    return await db.accounts.find_one({"account_id": account_id, "user_id": user["user_id"]}, {"_id": 0})


@api.delete("/accounts/{account_id}")
async def delete_account(account_id: str, user: dict = Depends(current_user)):
    await db.accounts.delete_one({"account_id": account_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============================================================
# TRANSACTIONS
# ============================================================

@api.get("/transactions")
async def list_transactions(
    user: dict = Depends(current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    account_id: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 500,
):
    q = {"user_id": user["user_id"]}
    if account_id:
        q["account_id"] = account_id
    if source:
        q["source"] = source
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    rows = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(limit)
    return rows


@api.post("/transactions")
async def create_transaction(payload: TransactionCreate, user: dict = Depends(current_user)):
    txn = Transaction(user_id=user["user_id"], **payload.model_dump())
    doc = txn.model_dump()
    await db.transactions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/transactions/{txn_id}")
async def update_transaction(txn_id: str, payload: TransactionUpdate, user: dict = Depends(current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.transactions.update_one({"txn_id": txn_id, "user_id": user["user_id"]}, {"$set": update})
    return await db.transactions.find_one({"txn_id": txn_id, "user_id": user["user_id"]}, {"_id": 0})


@api.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str, user: dict = Depends(current_user)):
    await db.transactions.delete_one({"txn_id": txn_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============================================================
# JOURNAL ENTRIES  (balanced multi-line postings)
# ============================================================

@api.get("/journal-entries")
async def list_journal_entries(
    user: dict = Depends(current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    cost_center: Optional[str] = None,
    limit: int = 2000,
):
    """Group transaction postings into balanced journal entries.

    Postings sharing a ``journal_id`` form one entry; postings without one are
    returned as single-line entries keyed by their txn_id.
    """
    q = {"user_id": user["user_id"]}
    if date_from or date_to:
        q["date"] = {}
        if date_from:
            q["date"]["$gte"] = date_from
        if date_to:
            q["date"]["$lte"] = date_to
    rows = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(limit)
    accounts = await db.accounts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(2000)
    acc_by_id = {a["account_id"]: a for a in accounts}

    groups: dict = {}
    order: List[str] = []
    for t in rows:
        jid = t.get("journal_id") or t.get("txn_id")
        if jid not in groups:
            groups[jid] = []
            order.append(jid)
        groups[jid].append(t)

    entries = []
    for jid in order:
        lines = groups[jid]
        cc = next((l.get("department", "") for l in lines if l.get("department")), "")
        if cost_center and cc != cost_center:
            continue
        first = lines[0]
        out_lines = []
        td = tc = 0.0
        for l in lines:
            acc = acc_by_id.get(l.get("account_id"), {})
            amt = float(l.get("amount", 0) or 0)
            debit = amt if l.get("type") == "debit" else 0.0
            credit = amt if l.get("type") == "credit" else 0.0
            td += debit
            tc += credit
            out_lines.append({
                "txn_id": l.get("txn_id"),
                "account_id": l.get("account_id"),
                "account_code": acc.get("code", ""),
                "account_name": acc.get("name", l.get("description", "")),
                "debit": round(debit, 2),
                "credit": round(credit, 2),
                "description": l.get("description", ""),
            })
        entries.append({
            "journal_id": jid,
            "date": first.get("date", ""),
            "description": first.get("description", ""),
            "reference": first.get("tx_id", ""),
            "cost_center": cc,
            "currency": first.get("currency", "USD"),
            "source": first.get("source", "manual"),
            "lines": out_lines,
            "total_debit": round(td, 2),
            "total_credit": round(tc, 2),
            "balanced": abs(td - tc) < 0.005,
        })
    return entries


@api.post("/journal-entries")
async def create_journal_entry(payload: JournalEntryCreate, user: dict = Depends(current_user)):
    total_debit = round(sum(l.amount for l in payload.lines if l.type == "debit"), 2)
    total_credit = round(sum(l.amount for l in payload.lines if l.type == "credit"), 2)
    if abs(total_debit - total_credit) >= 0.005:
        raise HTTPException(
            status_code=400,
            detail=f"Entry is not balanced: debits {total_debit} ≠ credits {total_credit}",
        )
    journal_id = f"je_{uuid.uuid4().hex[:12]}"
    docs = []
    for l in payload.lines:
        txn = Transaction(
            user_id=user["user_id"],
            date=payload.date,
            description=l.description or payload.description,
            amount=l.amount,
            currency=payload.currency,
            type=l.type,
            account_id=l.account_id,
            department=payload.cost_center,
            tx_id=payload.reference,
            month=payload.month,
            journal_id=journal_id,
            source="journal",
            reconciled=True,
        )
        docs.append(txn.model_dump())
    await db.transactions.insert_many(docs)
    for d in docs:
        d.pop("_id", None)
    return {
        "journal_id": journal_id,
        "date": payload.date,
        "description": payload.description,
        "cost_center": payload.cost_center,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "balanced": True,
        "lines": docs,
    }


@api.delete("/journal-entries/{journal_id}")
async def delete_journal_entry(journal_id: str, user: dict = Depends(current_user)):
    await db.transactions.delete_many({"user_id": user["user_id"], "journal_id": journal_id})
    return {"ok": True}


# ============================================================
# INVOICES
# ============================================================

def _calc_invoice_totals(line_items: List[dict], tax_rate: float) -> dict:
    subtotal = sum((li.get("quantity", 0) or 0) * (li.get("unit_price", 0) or 0) for li in line_items)
    tax_amount = round(subtotal * (tax_rate or 0) / 100.0, 2)
    total = round(subtotal + tax_amount, 2)
    return {"subtotal": round(subtotal, 2), "tax_amount": tax_amount, "total": total}


async def _next_number(user_id: str, prefix: str, collection) -> str:
    count = await collection.count_documents({"user_id": user_id})
    return f"{prefix}-{(count + 1):05d}"


@api.get("/invoices")
async def list_invoices(user: dict = Depends(current_user)):
    rows = await db.invoices.find({"user_id": user["user_id"]}, {"_id": 0}).sort("issue_date", -1).to_list(500)
    return rows


@api.post("/invoices")
async def create_invoice(payload: InvoiceCreate, user: dict = Depends(current_user)):
    line_items = [li.model_dump() if hasattr(li, "model_dump") else li for li in payload.line_items]
    totals = _calc_invoice_totals(line_items, payload.tax_rate)
    number = payload.number or await _next_number(user["user_id"], "INV", db.invoices)
    inv = Invoice(
        user_id=user["user_id"],
        number=number,
        customer_name=payload.customer_name,
        customer_email=payload.customer_email or "",
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        line_items=line_items,
        tax_rate=payload.tax_rate,
        currency=payload.currency,
        notes=payload.notes,
        **totals,
    )
    doc = inv.model_dump()
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, payload: InvoiceUpdate, user: dict = Depends(current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "line_items" in update or "tax_rate" in update:
        # recalculate totals
        existing = await db.invoices.find_one({"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")
        line_items = update.get("line_items", existing.get("line_items", []))
        line_items = [li.model_dump() if hasattr(li, "model_dump") else li for li in line_items]
        tax_rate = update.get("tax_rate", existing.get("tax_rate", 0))
        update.update(_calc_invoice_totals(line_items, tax_rate))
        update["line_items"] = line_items
    if update:
        await db.invoices.update_one({"invoice_id": invoice_id, "user_id": user["user_id"]}, {"$set": update})
    return await db.invoices.find_one({"invoice_id": invoice_id, "user_id": user["user_id"]}, {"_id": 0})


@api.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(current_user)):
    await db.invoices.delete_one({"invoice_id": invoice_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============================================================
# RECEIPTS
# ============================================================

@api.get("/receipts")
async def list_receipts(user: dict = Depends(current_user)):
    rows = await db.receipts.find({"user_id": user["user_id"]}, {"_id": 0}).sort("issue_date", -1).to_list(500)
    return rows


@api.post("/receipts")
async def create_receipt(payload: ReceiptCreate, user: dict = Depends(current_user)):
    line_items = [li.model_dump() if hasattr(li, "model_dump") else li for li in payload.line_items]
    totals = _calc_invoice_totals(line_items, payload.tax_rate)
    number = payload.number or await _next_number(user["user_id"], "RCT", db.receipts)
    rec = Receipt(
        user_id=user["user_id"],
        number=number,
        payer_name=payload.payer_name,
        issue_date=payload.issue_date,
        line_items=line_items,
        tax_rate=payload.tax_rate,
        currency=payload.currency,
        method=payload.method,
        notes=payload.notes,
        **totals,
    )
    doc = rec.model_dump()
    await db.receipts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str, user: dict = Depends(current_user)):
    await db.receipts.delete_one({"receipt_id": receipt_id, "user_id": user["user_id"]})
    return {"ok": True}


# ============================================================
# STATEMENTS
# ============================================================

async def _user_data(user_id: str):
    # High limits: imported real data can run to tens of thousands of postings,
    # and statements must aggregate ALL of them to be correct.
    txns = await db.transactions.find({"user_id": user_id}, {"_id": 0}).to_list(1_000_000)
    accounts = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(5000)
    invoices = await db.invoices.find({"user_id": user_id}, {"_id": 0}).to_list(20000)
    return txns, accounts, invoices


def _default_range(date_from: Optional[str], date_to: Optional[str]):
    today = datetime.now(timezone.utc).date()
    df = date_from or (today.replace(month=1, day=1)).isoformat()
    dt = date_to or today.isoformat()
    return df, dt


@api.get("/statements/profit-loss")
async def stmt_pnl(date_from: Optional[str] = None, date_to: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    df, dt = _default_range(date_from, date_to)
    txns, accounts, _ = await _user_data(user["user_id"])
    return profit_and_loss(txns, accounts, df, dt, base)


@api.get("/statements/balance-sheet")
async def stmt_bs(as_of: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    as_of = as_of or datetime.now(timezone.utc).date().isoformat()
    txns, accounts, _ = await _user_data(user["user_id"])
    return balance_sheet(txns, accounts, as_of, base)


@api.get("/statements/cash-flow")
async def stmt_cf(date_from: Optional[str] = None, date_to: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    df, dt = _default_range(date_from, date_to)
    txns, accounts, _ = await _user_data(user["user_id"])
    return cash_flow(txns, accounts, df, dt, base)


@api.get("/statements/trial-balance")
async def stmt_tb(as_of: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    as_of = as_of or datetime.now(timezone.utc).date().isoformat()
    txns, accounts, _ = await _user_data(user["user_id"])
    return trial_balance(txns, accounts, as_of, base)


@api.get("/statements/general-ledger")
async def stmt_gl(account_id: str, date_from: Optional[str] = None, date_to: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    df, dt = _default_range(date_from, date_to)
    txns, accounts, _ = await _user_data(user["user_id"])
    return general_ledger(txns, accounts, account_id, df, dt, base)


@api.get("/statements/tax-summary")
async def stmt_tax(date_from: Optional[str] = None, date_to: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    df, dt = _default_range(date_from, date_to)
    txns, accounts, invoices = await _user_data(user["user_id"])
    return tax_summary(txns, accounts, invoices, df, dt, base)


@api.get("/statements/equity")
async def stmt_equity(date_from: Optional[str] = None, date_to: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    df, dt = _default_range(date_from, date_to)
    txns, accounts, _ = await _user_data(user["user_id"])
    return statement_of_equity(txns, accounts, df, dt, base)


# ============================================================
# COST CENTERS
# ============================================================

@api.get("/cost-centers")
async def list_cost_centers(user: dict = Depends(current_user)):
    await ensure_seed_cost_centers(user["user_id"])
    rows = await db.cost_centers.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    rows.sort(key=lambda r: r.get("cc_code", ""))
    return rows


@api.get("/statements/cost-center-pnl")
async def stmt_cost_center_pnl(date_from: Optional[str] = None, date_to: Optional[str] = None, base: str = "USD", user: dict = Depends(current_user)):
    df, dt = _default_range(date_from, date_to)
    txns, accounts, _ = await _user_data(user["user_id"])
    await ensure_seed_cost_centers(user["user_id"])
    ccs = await db.cost_centers.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    cc_names = {c["cc_code"]: c.get("name", "") for c in ccs}
    return cost_center_pnl(txns, accounts, df, dt, base, cc_names)


@api.get("/cost-centers/used")
async def cost_centers_used(user: dict = Depends(current_user)):
    """Distinct cost-centre / department values actually present on transactions."""
    txns = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0, "department": 1}).to_list(1_000_000)
    seen = sorted({(t.get("department") or "").strip() for t in txns if (t.get("department") or "").strip()})
    return seen


# ============================================================
# DASHBOARD
# ============================================================

@api.get("/dashboard/summary")
async def dashboard_summary(base: str = "USD", user: dict = Depends(current_user)):
    today = datetime.now(timezone.utc).date()
    df = today.replace(month=1, day=1).isoformat()
    dt = today.isoformat()
    txns, accounts, invoices = await _user_data(user["user_id"])

    pnl = profit_and_loss(txns, accounts, df, dt, base)
    bs = balance_sheet(txns, accounts, dt, base)

    # Monthly P&L trend (last 6 months)
    from statements import to_base
    months = []
    for i in range(5, -1, -1):
        m_first = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        m_label = m_first.strftime("%b")
        m_start = m_first.isoformat()
        next_first = (m_first.replace(day=28) + timedelta(days=4)).replace(day=1)
        m_end = (next_first - timedelta(days=1)).isoformat()
        m_pnl = profit_and_loss(txns, accounts, m_start, m_end, base)
        months.append({"month": m_label, "income": m_pnl["total_income"], "expenses": m_pnl["total_expenses"], "profit": m_pnl["net_profit"]})

    # Expense breakdown by category
    by_cat = {}
    by_id = {a["account_id"]: a for a in accounts}
    for t in txns:
        acc = by_id.get(t.get("account_id"))
        if not acc or acc["type"] != "expense":
            continue
        v = to_base(float(t.get("amount", 0)), t.get("currency", "USD"), base)
        if t.get("type") == "debit":
            by_cat[acc["name"]] = by_cat.get(acc["name"], 0) + v
    expense_breakdown = sorted([{"category": k, "value": round(v, 2)} for k, v in by_cat.items()], key=lambda x: -x["value"])[:6]

    # Outstanding invoices
    outstanding = sum(inv.get("total", 0) for inv in invoices if inv.get("status") in ("sent", "overdue"))

    return {
        "currency": base,
        "kpis": {
            "revenue": pnl["total_income"],
            "expenses": pnl["total_expenses"],
            "net_profit": pnl["net_profit"],
            "cash_balance": next((a["balance"] for a in bs["assets"] if a["account"] in ("Cash", "Bank Account")), bs["total_assets"]),
            "total_assets": bs["total_assets"],
            "outstanding_invoices": round(outstanding, 2),
        },
        "monthly_trend": months,
        "expense_breakdown": expense_breakdown,
        "recent_transactions": sorted(txns, key=lambda x: x.get("date", ""), reverse=True)[:8],
    }


# ============================================================
# INTEGRATIONS (PSPs + Google Sheets)
# ============================================================

PROVIDER_META = {
    "paypal": {"name": "PayPal", "color": "#003087", "category": "PSP"},
    "stripe": {"name": "Stripe", "color": "#635bff", "category": "PSP"},
    "skrill": {"name": "Skrill", "color": "#862165", "category": "PSP"},
    "paysafe": {"name": "Paysafe", "color": "#f0bc00", "category": "PSP"},
    "google-sheets": {"name": "Google Sheets", "color": "#0F9D58", "category": "Productivity"},
}


@api.get("/integrations")
async def list_integrations(user: dict = Depends(current_user)):
    rows = await db.integrations.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    by_provider = {r["provider"]: r for r in rows}
    out = []
    for prov, meta in PROVIDER_META.items():
        rec = by_provider.get(prov)
        out.append({
            "provider": prov,
            "name": meta["name"],
            "color": meta["color"],
            "category": meta["category"],
            "status": rec["status"] if rec else "disconnected",
            "last_sync": rec.get("last_sync") if rec else None,
            "config": rec.get("config", {}) if rec else {},
            "is_mock": prov != "google-sheets",
        })
    return out


@api.post("/integrations/{provider}/connect")
async def connect_integration(provider: str, user: dict = Depends(current_user)):
    if provider not in PROVIDER_META:
        raise HTTPException(status_code=400, detail="Unknown provider")
    if provider == "google-sheets":
        return {"requires_oauth": True, "authorize_url": f"/api/sheets/connect"}
    existing = await db.integrations.find_one({"user_id": user["user_id"], "provider": provider}, {"_id": 0})
    if existing:
        await db.integrations.update_one(
            {"user_id": user["user_id"], "provider": provider},
            {"$set": {"status": "connected", "config": {"mock": True, "merchant_id": f"mock_{uuid.uuid4().hex[:8]}"}}}
        )
    else:
        doc = Integration(
            user_id=user["user_id"],
            provider=provider,
            status="connected",
            config={"mock": True, "merchant_id": f"mock_{uuid.uuid4().hex[:8]}"},
        ).model_dump()
        await db.integrations.insert_one(doc)
    return {"ok": True, "provider": provider, "status": "connected"}


@api.post("/integrations/{provider}/disconnect")
async def disconnect_integration(provider: str, user: dict = Depends(current_user)):
    await db.integrations.update_one(
        {"user_id": user["user_id"], "provider": provider},
        {"$set": {"status": "disconnected"}}
    )
    return {"ok": True}


@api.post("/integrations/{provider}/sync")
async def sync_integration(provider: str, user: dict = Depends(current_user)):
    if provider not in PROVIDER_META or provider == "google-sheets":
        raise HTTPException(status_code=400, detail="Sync not supported for this provider")
    rec = await db.integrations.find_one({"user_id": user["user_id"], "provider": provider}, {"_id": 0})
    if not rec or rec.get("status") != "connected":
        raise HTTPException(status_code=400, detail="Provider not connected")

    # Find Bank Account / Sales accounts to use as default
    bank = await db.accounts.find_one({"user_id": user["user_id"], "name": "Bank Account"}, {"_id": 0})
    sales = await db.accounts.find_one({"user_id": user["user_id"], "name": "Sales"}, {"_id": 0})
    if not bank:
        raise HTTPException(status_code=400, detail="Setup chart of accounts first")
    txns = generate_mock_transactions(provider, bank["account_id"], sales["account_id"] if sales else None)
    docs = [{**t, "user_id": user["user_id"]} for t in txns]
    if docs:
        await db.transactions.insert_many(docs)
    await db.integrations.update_one(
        {"user_id": user["user_id"], "provider": provider},
        {"$set": {"last_sync": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True, "imported": len(docs), "provider": provider}


# ============================================================
# GOOGLE SHEETS (real OAuth)
# ============================================================

GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]


def _redirect_uri(request: Request) -> str:
    base = os.environ.get("APP_BASE_URL") or f"{request.url.scheme}://{request.url.netloc}"
    return f"{base}/api/sheets/callback"


@api.get("/sheets/status")
async def sheets_status(user: dict = Depends(current_user)):
    has_creds = bool(GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)
    rec = await db.google_sheets_tokens.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {
        "configured": has_creds,
        "connected": bool(rec and rec.get("access_token")),
        "email": rec.get("email") if rec else None,
    }


@api.get("/sheets/connect")
async def sheets_connect(request: Request, user: dict = Depends(current_user)):
    if not (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET):
        raise HTTPException(
            status_code=400,
            detail="Google OAuth not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to backend/.env"
        )
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GOOGLE_SCOPES,
    )
    flow.redirect_uri = _redirect_uri(request)
    auth_url, state = flow.authorization_url(prompt="consent", access_type="offline", state=user["user_id"])
    await db.google_oauth_state.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "state": state,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "code_verifier": flow.code_verifier,
        }},
        upsert=True,
    )
    return {"authorize_url": auth_url}


@api.get("/sheets/callback")
async def sheets_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None):
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code/state")
    sd = await db.google_oauth_state.find_one({"user_id": state}, {"_id": 0})
    if not sd:
        raise HTTPException(status_code=400, detail="Invalid state")
    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_OAUTH_CLIENT_ID,
                "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=GOOGLE_SCOPES,
        state=sd["state"],
    )
    flow.redirect_uri = _redirect_uri(request)
    flow.code_verifier = sd.get("code_verifier")
    flow.fetch_token(authorization_response=str(request.url))
    creds = flow.credentials
    await db.google_sheets_tokens.update_one(
        {"user_id": state},
        {"$set": {
            "user_id": state,
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
            "scopes": creds.scopes,
        }},
        upsert=True,
    )
    frontend_url = os.environ.get("FRONTEND_URL", "https://fpna.nextlab.info")
    return RedirectResponse(url=f"{frontend_url}/integrations?sheets=connected")


@api.post("/transactions/bulk")
async def bulk_import_transactions(payload: dict, user: dict = Depends(current_user)):
    transactions = payload.get("transactions", [])
    if not transactions:
        raise HTTPException(status_code=400, detail="No transactions provided")
    docs = []
    for t in transactions:
        docs.append({
            "txn_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "date": str(t.get("date", "")),
            "description": str(t.get("description", "")),
            "type": str(t.get("type", "credit")).lower(),
            "amount": float(t.get("amount", 0)),
            "currency": str(t.get("currency", "USD")),
            "category": str(t.get("category", "")),
            "month": str(t.get("month", "")),
            "department": str(t.get("department", "")),
            "subcategory": str(t.get("subcategory", "")),
            "ledger": str(t.get("ledger", "")),
            "vendor": str(t.get("vendor", "")),
            "tx_id": str(t.get("tx_id", "")),
            "source": str(t.get("source", "import")),
            "account_id": str(t.get("account_id", "")),
            "reconciled": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    if docs:
        await db.transactions.insert_many(docs)
    return {"ok": True, "imported": len(docs)}


@api.post("/sheets/read-preview")
async def sheets_read_preview(payload: dict, user: dict = Depends(current_user)):
    rec = await db.google_sheets_tokens.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Google Sheets not connected")
    spreadsheet_id = payload.get("spreadsheet_id", "")
    rng = payload.get("range", "A1:G100")
    if not spreadsheet_id:
        raise HTTPException(status_code=400, detail="spreadsheet_id required")
    from googleapiclient.discovery import build
    creds = _get_creds(rec)
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    res = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=rng).execute()
    values = res.get("values", [])
    return {"rows": values, "count": len(values)}


def _get_creds(token_doc: dict):
    from google.oauth2.credentials import Credentials
    return Credentials(
        token=token_doc["access_token"],
        refresh_token=token_doc.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=GOOGLE_OAUTH_CLIENT_ID,
        client_secret=GOOGLE_OAUTH_CLIENT_SECRET,
        scopes=token_doc.get("scopes", GOOGLE_SCOPES),
    )


@api.post("/sheets/export")
async def sheets_export(payload: dict, user: dict = Depends(current_user)):
    """Export a statement or transactions to a new Google Sheet.
    Payload: {kind: 'transactions'|'profit-loss'|'balance-sheet'|'trial-balance', title?: str}
    """
    rec = await db.google_sheets_tokens.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Google Sheets not connected")
    from googleapiclient.discovery import build
    creds = _get_creds(rec)
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)

    kind = payload.get("kind", "transactions")
    title = payload.get("title") or f"Ledgerly Export - {kind} - {datetime.now(timezone.utc).date().isoformat()}"

    rows: List[List] = []
    if kind == "transactions":
        txns = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(2000)
        rows.append(["Date", "Description", "Type", "Amount", "Currency", "Category", "Source"])
        for t in txns:
            rows.append([t["date"], t["description"], t["type"], t["amount"], t["currency"], t.get("category", ""), t.get("source", "")])
    else:
        df = (datetime.now(timezone.utc).date().replace(month=1, day=1)).isoformat()
        dt = datetime.now(timezone.utc).date().isoformat()
        txns, accounts, invoices = await _user_data(user["user_id"])
        if kind == "profit-loss":
            data = profit_and_loss(txns, accounts, df, dt)
            rows.append(["Profit & Loss", df, "to", dt, "Currency", data["currency"]])
            rows.append([])
            rows.append(["Income"])
            for x in data["income"]:
                rows.append([x["account"], x["amount"]])
            rows.append(["Total Income", data["total_income"]])
            rows.append([])
            rows.append(["Expenses"])
            for x in data["expenses"]:
                rows.append([x["account"], x["amount"]])
            rows.append(["Total Expenses", data["total_expenses"]])
            rows.append([])
            rows.append(["Net Profit", data["net_profit"]])
        elif kind == "balance-sheet":
            data = balance_sheet(txns, accounts, dt)
            rows.append(["Balance Sheet", "as of", dt, "Currency", data["currency"]])
            for section in ("assets", "liabilities", "equity"):
                rows.append([])
                rows.append([section.title()])
                for x in data[section]:
                    rows.append([x["account"], x["balance"]])
        elif kind == "trial-balance":
            data = trial_balance(txns, accounts, dt)
            rows.append(["Trial Balance", "as of", dt])
            rows.append(["Code", "Account", "Type", "Debit", "Credit"])
            for r in data["rows"]:
                rows.append([r["code"], r["account"], r["type"], r["debit"], r["credit"]])
            rows.append(["TOTAL", "", "", data["total_debit"], data["total_credit"]])
        elif kind == "cash-flow":
            df_p = payload.get("date_from") or df
            dt_p = payload.get("date_to") or dt
            txns, accounts, _ = await _user_data(user["user_id"])
            data = cash_flow(txns, accounts, df_p, dt_p)
            rows.append(["Cash Flow Statement", "Period:", df_p, "to", dt_p, "Currency", data["currency"]])
            rows.append([])
            rows.append(["Activity", "Amount"])
            rows.append(["Operating Activities", data["operating"]])
            rows.append(["Investing Activities", data["investing"]])
            rows.append(["Financing Activities", data["financing"]])
            rows.append([])
            rows.append(["Net Change in Cash", data["net_change"]])
        elif kind == "general-ledger":
            acct_id = payload.get("account_id", "")
            df_p = payload.get("date_from") or df
            dt_p = payload.get("date_to") or dt
            txns, accounts, _ = await _user_data(user["user_id"])
            data = general_ledger(txns, accounts, acct_id, df_p, dt_p)
            if "error" in data:
                raise HTTPException(status_code=400, detail=data["error"])
            rows.append(["General Ledger", data["account"]["name"], "Period:", df_p, "to", dt_p])
            rows.append(["Date", "Description", "Debit", "Credit", "Running Balance"])
            for r in data.get("rows", []):
                rows.append([r["date"], r["description"], r["debit"], r["credit"], r["balance"]])
            rows.append(["", "Ending Balance", "", "", data.get("ending_balance", 0)])
        elif kind == "tax-summary":
            df_p = payload.get("date_from") or df
            dt_p = payload.get("date_to") or dt
            txns, accounts, invoices = await _user_data(user["user_id"])
            data = tax_summary(txns, accounts, invoices, df_p, dt_p)
            rows.append(["Tax Summary", "Period:", df_p, "to", dt_p, "Currency", data["currency"]])
            rows.append([])
            rows.append(["Metric", "Value"])
            rows.append(["Taxable Sales", data["taxable_sales"]])
            rows.append(["Tax Collected", data["tax_collected"]])
            rows.append(["Paid Invoice Total", data["paid_invoice_total"]])
            rows.append(["Invoice Count", data["invoices_count"]])
        elif kind == "cost-center-pnl":
            df_p = payload.get("date_from") or df
            dt_p = payload.get("date_to") or dt
            ccs = await db.cost_centers.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
            cc_names = {c["cc_code"]: c.get("name", "") for c in ccs}
            data = cost_center_pnl(txns, accounts, df_p, dt_p, cc_names=cc_names)
            rows.append(["Cost-Center P&L", "Period:", df_p, "to", dt_p, "Currency", data["currency"]])
            rows.append([])
            rows.append(["Cost Center", "Name", "Revenue", "Expenses", "Contribution", "Margin %"])
            for r in data["rows"]:
                rows.append([r["cost_center"], r["name"], r["revenue"], r["expenses"], r["contribution"], r["margin_pct"]])
            rows.append(["TOTAL", "", data["total_revenue"], data["total_expenses"], data["total_contribution"], ""])
        elif kind == "journal":
            df_p = payload.get("date_from") or df
            dt_p = payload.get("date_to") or dt
            jtxns = await db.transactions.find(
                {"user_id": user["user_id"], "date": {"$gte": df_p, "$lte": dt_p}}, {"_id": 0}
            ).sort("date", -1).to_list(100000)
            acc_by_id = {a["account_id"]: a for a in accounts}
            rows.append(["Journal Entries", "Period:", df_p, "to", dt_p])
            rows.append(["Date", "Journal ID", "Cost Center", "Account Code", "Account", "Debit", "Credit", "Description"])
            for t in jtxns:
                acc = acc_by_id.get(t.get("account_id"), {})
                amt = float(t.get("amount", 0) or 0)
                rows.append([
                    t.get("date", ""), t.get("journal_id", "") or t.get("txn_id", ""),
                    t.get("department", ""), acc.get("code", ""), acc.get("name", ""),
                    amt if t.get("type") == "debit" else 0,
                    amt if t.get("type") == "credit" else 0,
                    t.get("description", ""),
                ])
        elif kind == "equity":
            df_p = payload.get("date_from") or df
            dt_p = payload.get("date_to") or dt
            data = statement_of_equity(txns, accounts, df_p, dt_p)
            rows.append(["Statement of Changes in Equity", "Period:", df_p, "to", dt_p, "Currency", data["currency"]])
            rows.append([])
            rows.append(["Item", "Amount"])
            rows.append(["Beginning Equity", data["beginning_equity"]])
            rows.append(["Beginning Retained Earnings", data["beginning_retained_earnings"]])
            rows.append(["Capital Contributions", data["contributions"]])
            rows.append(["Net Income for Period", data["net_income"]])
            rows.append(["Dividends / Distributions", data["dividends"]])
            rows.append(["Ending Retained Earnings", data["ending_retained_earnings"]])
            rows.append(["Ending Equity", data["ending_equity"]])

    spreadsheet = service.spreadsheets().create(body={"properties": {"title": title}}).execute()
    spreadsheet_id = spreadsheet["spreadsheetId"]
    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range="A1",
        valueInputOption="RAW",
        body={"values": rows},
    ).execute()
    return {"ok": True, "spreadsheet_id": spreadsheet_id, "url": spreadsheet.get("spreadsheetUrl")}


@api.post("/sheets/import-transactions")
async def sheets_import(payload: dict, user: dict = Depends(current_user)):
    """Import transactions from a Google Sheet by spreadsheet_id and range.
    Payload: {spreadsheet_id, range?: 'A1:G1000', account_id}
    Sheet expected columns: Date, Description, Type(debit/credit), Amount, Currency, Category, Source
    """
    rec = await db.google_sheets_tokens.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Google Sheets not connected")
    spreadsheet_id = payload.get("spreadsheet_id")
    rng = payload.get("range", "A1:G1000")
    account_id = payload.get("account_id")
    if not (spreadsheet_id and account_id):
        raise HTTPException(status_code=400, detail="spreadsheet_id and account_id required")

    from googleapiclient.discovery import build
    creds = _get_creds(rec)
    service = build("sheets", "v4", credentials=creds, cache_discovery=False)
    res = service.spreadsheets().values().get(spreadsheetId=spreadsheet_id, range=rng).execute()
    values = res.get("values", [])
    if not values:
        return {"ok": True, "imported": 0}
    # skip header if exists
    start = 1 if values and values[0] and values[0][0].lower() in ("date", "txn date") else 0
    docs = []
    for row in values[start:]:
        if len(row) < 4:
            continue
        try:
            docs.append({
                "txn_id": f"txn_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "date": row[0],
                "description": row[1] if len(row) > 1 else "",
                "type": (row[2] if len(row) > 2 else "credit").lower(),
                "amount": float(row[3]),
                "currency": (row[4] if len(row) > 4 else "USD"),
                "category": row[5] if len(row) > 5 else "",
                "source": row[6] if len(row) > 6 else "google-sheets",
                "account_id": account_id,
                "reconciled": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            continue
    if docs:
        await db.transactions.insert_many(docs)
    return {"ok": True, "imported": len(docs)}


# ============================================================
# DEMO DATA SEED
# ============================================================

@api.post("/demo/seed")
async def seed_demo_data(user: dict = Depends(current_user)):
    """Seed NEXT Ventures Ltd. Jan–May 2026 P&L data (FundedNext / FNmarkets)."""
    uid = user["user_id"]

    existing = await db.transactions.count_documents({"user_id": uid, "source": "seed-next"})
    if existing > 0:
        return {"ok": True, "skipped": True, "message": "NEXT Ventures data already seeded"}

    # Ensure chart of accounts + cost centres exist
    await ensure_seed_accounts(uid)

    # Build {account_code: account_id} map
    all_accts = await db.accounts.find({"user_id": uid}, {"_id": 0}).to_list(2000)
    code_to_id: dict = {a.get("code"): a["account_id"] for a in all_accts if a.get("code")}

    # Insert any accounts that coa defines but aren't in the DB yet
    existing_codes = set(code_to_id.keys())
    new_docs = []
    for a in coa.CHART_OF_ACCOUNTS:
        if a["code"] not in existing_codes:
            aid = f"acc_{uuid.uuid4().hex[:12]}"
            new_docs.append({
                "account_id": aid, "user_id": uid,
                "name": a["name"], "code": a["code"], "type": a["type"],
                "currency": "USD", "description": "",
                "category": a.get("category", ""), "subcategory": a.get("subcategory", ""),
                "cost_center": a.get("cost_center", ""),
                "is_default": True, "created_at": datetime.now(timezone.utc).isoformat(),
            })
            code_to_id[a["code"]] = aid
    if new_docs:
        await db.accounts.insert_many(new_docs)

    clearing_id = code_to_id.get(coa.CLEARING_ACCOUNT_CODE, "")

    # Build (category, subcategory, ledger) → account meta lookup
    acc_lookup = {
        (a["category"], a["subcategory"], a["name"]): a
        for a in coa.build_pnl_accounts()
    }

    def _legs(acc_type: str, amount: float):
        positive = amount >= 0
        primary = ("credit" if positive else "debit") if acc_type == "income" else ("debit" if positive else "credit")
        return primary, ("debit" if primary == "credit" else "credit")

    txns = []
    for category, subcategory, ledger, amounts in coa.PNL_ROWS:
        meta = acc_lookup.get((category, subcategory, ledger))
        if not meta:
            continue
        acc_id = code_to_id.get(meta["code"], "")
        if not acc_id:
            continue
        acc_type = meta["type"]
        cc = meta.get("cost_center", "")
        for col, amount in zip(coa.PERIOD_COLUMNS, amounts):
            if not amount:
                continue
            date_str = coa.PERIOD_END_DATE[col]
            primary_side, clearing_side = _legs(acc_type, amount)
            mag = round(abs(amount), 2)
            journal_id = f"je_seed_{meta['code']}_{col}"
            common = {
                "user_id": uid, "date": date_str, "amount": mag,
                "currency": "USD", "category": category,
                "subcategory": subcategory, "ledger": ledger,
                "month": col, "department": cc, "journal_id": journal_id,
                "source": "seed-next", "reconciled": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            base = f"txn_seed_{meta['code']}_{col}"
            txns.append({**common, "txn_id": base, "type": primary_side,
                         "account_id": acc_id, "contra_account_id": clearing_id,
                         "description": f"{ledger} ({col})"})
            txns.append({**common, "txn_id": f"{base}_clr", "type": clearing_side,
                         "account_id": clearing_id, "contra_account_id": acc_id,
                         "description": f"Cash settlement — {ledger} ({col})"})

    BATCH = 500
    for i in range(0, len(txns), BATCH):
        await db.transactions.insert_many(txns[i:i + BATCH])

    return {"ok": True, "inserted": len(txns), "message": f"NEXT Ventures Jan–May 2026 data seeded ({len(txns)} postings)"}


# ============================================================
# Wire up app
# ============================================================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)