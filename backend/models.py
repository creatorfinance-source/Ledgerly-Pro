# Pydantic models for the finance app.
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

CURRENCIES = ["USD", "EUR", "BDT", "LKR", "MYR"]
ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"]
TXN_TYPES = ["debit", "credit"]
PSP_PROVIDERS = ["paypal", "stripe", "skrill", "paysafe"]


def _id_factory(prefix: str):
    return lambda: f"{prefix}_{uuid.uuid4().hex[:12]}"


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str
    picture: Optional[str] = ""
    provider: str = "email"
    default_currency: str = "USD"
    organization: str = "My Company"
    job_title: Optional[str] = ""
    phone: Optional[str] = ""
    timezone: Optional[str] = "UTC"
    bio: Optional[str] = ""


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class SessionExchange(BaseModel):
    session_id: str


class Account(BaseModel):
    model_config = ConfigDict(extra="ignore")
    account_id: str = Field(default_factory=_id_factory("acc"))
    user_id: str
    name: str
    code: str
    type: Literal["asset", "liability", "equity", "income", "expense"]
    currency: str = "USD"
    description: str = ""
    category: str = ""       # P&L / balance-sheet grouping (e.g. "Operating Expenses (OPEX)")
    subcategory: str = ""    # ledger grouping within a category
    cost_center: str = ""    # CC01–CC11 / CORP
    is_default: bool = False
    created_at: str = Field(default_factory=_now_iso)


class AccountCreate(BaseModel):
    name: str
    code: str
    type: Literal["asset", "liability", "equity", "income", "expense"]
    currency: str = "USD"
    description: str = ""
    category: str = ""
    subcategory: str = ""
    cost_center: str = ""


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[Literal["asset", "liability", "equity", "income", "expense"]] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    cost_center: Optional[str] = None


class CostCenter(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cc_code: str                       # CC01–CC11 / CORP
    user_id: str
    name: str
    type: Literal["Revenue", "Support"] = "Support"
    allocation_method: str = ""
    created_at: str = Field(default_factory=_now_iso)


class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    txn_id: str = Field(default_factory=_id_factory("txn"))
    user_id: str
    date: str  # ISO date
    description: str
    amount: float
    currency: str = "USD"
    type: Literal["debit", "credit"]  # debit increases assets/expenses
    account_id: str  # primary account
    contra_account_id: Optional[str] = None
    category: str = ""
    month: str = ""
    department: str = ""
    subcategory: str = ""
    ledger: str = ""
    vendor: str = ""
    tx_id: str = ""
    journal_id: str = ""  # groups postings belonging to the same journal entry
    source: str = "manual"  # manual | paypal | stripe | skrill | paysafe | google-sheets
    external_ref: Optional[str] = None
    reconciled: bool = False
    created_at: str = Field(default_factory=_now_iso)


class TransactionCreate(BaseModel):
    date: str
    description: str
    amount: float
    currency: str = "USD"
    type: Literal["debit", "credit"]
    account_id: str
    contra_account_id: Optional[str] = None
    category: str = ""
    month: str = ""
    department: str = ""
    subcategory: str = ""
    ledger: str = ""
    vendor: str = ""
    tx_id: str = ""
    journal_id: str = ""
    source: str = "manual"
    external_ref: Optional[str] = None


class JournalLine(BaseModel):
    account_id: str
    type: Literal["debit", "credit"]
    amount: float = Field(gt=0)
    description: str = ""


class JournalEntryCreate(BaseModel):
    date: str
    description: str = ""
    reference: str = ""          # stored as tx_id on each line
    cost_center: str = ""        # stored as department on each line
    currency: str = "USD"
    month: str = ""
    lines: List[JournalLine] = Field(min_length=2)


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    type: Optional[Literal["debit", "credit"]] = None
    account_id: Optional[str] = None
    contra_account_id: Optional[str] = None
    category: Optional[str] = None
    month: Optional[str] = None
    department: Optional[str] = None
    subcategory: Optional[str] = None
    ledger: Optional[str] = None
    vendor: Optional[str] = None
    tx_id: Optional[str] = None
    reconciled: Optional[bool] = None


class InvoiceLine(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0


class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invoice_id: str = Field(default_factory=_id_factory("inv"))
    user_id: str
    number: str
    customer_name: str
    customer_email: Optional[str] = ""
    issue_date: str
    due_date: str
    line_items: List[InvoiceLine] = []
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float = 0
    currency: str = "USD"
    notes: str = ""
    status: Literal["draft", "sent", "paid", "overdue"] = "draft"
    created_at: str = Field(default_factory=_now_iso)


class InvoiceCreate(BaseModel):
    number: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = ""
    issue_date: str
    due_date: str
    line_items: List[InvoiceLine] = []
    tax_rate: float = 0
    currency: str = "USD"
    notes: str = ""


class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    line_items: Optional[List[InvoiceLine]] = None
    tax_rate: Optional[float] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[Literal["draft", "sent", "paid", "overdue"]] = None


class Receipt(BaseModel):
    model_config = ConfigDict(extra="ignore")
    receipt_id: str = Field(default_factory=_id_factory("rec"))
    user_id: str
    number: str
    payer_name: str
    issue_date: str
    line_items: List[InvoiceLine] = []
    subtotal: float = 0
    tax_rate: float = 0
    tax_amount: float = 0
    total: float = 0
    currency: str = "USD"
    method: str = "cash"  # cash, bank, card
    notes: str = ""
    created_at: str = Field(default_factory=_now_iso)


class ReceiptCreate(BaseModel):
    number: Optional[str] = None
    payer_name: str
    issue_date: str
    line_items: List[InvoiceLine] = []
    tax_rate: float = 0
    currency: str = "USD"
    method: str = "cash"
    notes: str = ""


class Integration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    integration_id: str = Field(default_factory=_id_factory("int"))
    user_id: str
    provider: str  # paypal, stripe, skrill, paysafe, google-sheets
    status: Literal["disconnected", "connected", "error"] = "disconnected"
    last_sync: Optional[str] = None
    config: dict = {}
    created_at: str = Field(default_factory=_now_iso)


class SettingsUpdate(BaseModel):
    organization: Optional[str] = None
    default_currency: Optional[str] = None
    name: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    bio: Optional[str] = None