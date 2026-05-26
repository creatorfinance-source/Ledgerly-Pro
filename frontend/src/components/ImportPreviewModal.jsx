import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileSpreadsheet, Link, GripHorizontal, ChevronUp, ChevronDown, ArrowUpToLine, ArrowDownToLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// Column mapping options
// ──────────────────────────────────────────────
const FIELD_OPTIONS = [
  { value: "__skip__", label: "— Skip —" },
  { value: "date", label: "Date" },
  { value: "description", label: "Description" },
  { value: "type", label: "Type" },
  { value: "amount", label: "Amount" },
  { value: "currency", label: "Currency" },
  { value: "month", label: "Month" },
  { value: "category", label: "Category" },
  { value: "subcategory", label: "Subcategory" },
  { value: "department", label: "Department" },
  { value: "ledger", label: "Ledger" },
  { value: "vendor", label: "Vendor" },
  { value: "tx_id", label: "txId" },
  { value: "source", label: "Source" },
];

// Auto-detect field mapping from header name
function autoDetectField(header) {
  if (!header) return "__skip__";
  const h = String(header).toLowerCase().trim();
  if (h.includes("date") || h === "txn date" || h === "transaction date") return "date";
  if (h.includes("desc") || h.includes("narration") || h.includes("particulars") || h.includes("memo")) return "description";
  if (h === "type" || h.includes("dr/cr") || h === "dr cr" || h.includes("debit/credit")) return "type";
  if (h.includes("amount") || h.includes("value") || h.includes("sum") || h === "amt") return "amount";
  if (h.includes("currency") || h === "ccy" || h === "cur") return "currency";
  if (h === "month" || h.includes("month")) return "month";
  if (h === "subcategory" || h.includes("subcat")) return "subcategory";
  if (h.includes("categ") || h.includes("class")) return "category";
  if (h.includes("dept") || h.includes("department") || h.includes("division")) return "department";
  if (h === "ledger" || h.includes("ledger")) return "ledger";
  if (h === "vendor" || h.includes("vendor") || h.includes("supplier")) return "vendor";
  if (h === "txid" || h === "tx_id" || h === "txn id" || h === "transaction id" || h === "ref" || h === "reference") return "tx_id";
  if (h.includes("source") || h.includes("channel") || h.includes("origin")) return "source";
  return "__skip__";
}

// ──────────────────────────────────────────────
// Sortable column header component
// ──────────────────────────────────────────────
function SortableColHeader({ id, header, mapping, onMappingChange, sortKey, sortDir, onSort }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="border border-[#E8E3DC] bg-[#F7F5F2] px-3 py-2 text-left min-w-[140px] select-none"
    >
      <div className="flex flex-col gap-1.5">
        {/* Drag handle + header name + sort */}
        <div className="flex items-center gap-1">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-[#9E9E9E] hover:text-moss"
            title="Drag to reorder"
          >
            <GripHorizontal className="w-3.5 h-3.5" />
          </span>
          <button
            type="button"
            className="flex items-center gap-0.5 text-xs font-semibold text-[#1A1A1A] hover:text-moss truncate max-w-[90px]"
            onClick={() => onSort(id)}
            title={header}
          >
            <span className="truncate">{header}</span>
            {sortKey === id ? (
              sortDir === "asc" ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />
            ) : null}
          </button>
        </div>
        {/* Mapping dropdown */}
        <Select value={mapping} onValueChange={(v) => onMappingChange(id, v)}>
          <SelectTrigger className="h-7 text-[10px] border-[#E8E3DC] bg-white w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </th>
  );
}

// ──────────────────────────────────────────────
// Editable cell component
// ──────────────────────────────────────────────
function EditableCell({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(value); setEditing(false); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="w-full min-w-[80px] border border-moss rounded px-1.5 py-0.5 text-xs outline-none bg-white"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <span
      className="block truncate max-w-[180px] cursor-pointer hover:bg-[#F2F0ED] px-1 rounded text-xs text-[#1A1A1A]"
      title={value}
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      {value === "" ? <span className="text-[#BDBDBD]">—</span> : value}
    </span>
  );
}

// ──────────────────────────────────────────────
// Main ImportPreviewModal
// ──────────────────────────────────────────────
export default function ImportPreviewModal({ open, onClose, onImport, accounts = [] }) {
  const [activeTab, setActiveTab] = useState("file");
  const [columns, setColumns] = useState([]); // array of { id, header }
  const [mappings, setMappings] = useState({}); // id -> field
  const [rows, setRows] = useState([]); // array of arrays (cells per column, indexed same as columns)
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [editCell, setEditCell] = useState(null); // {row, col} — kept for tracking
  const [targetAccount, setTargetAccount] = useState(accounts[0]?.account_id || "");
  const [isDragOver, setIsDragOver] = useState(false);
  const [sheetsId, setSheetsId] = useState("");
  const [sheetsTab, setSheetsTab] = useState("");
  const [sheetsRange, setSheetsRange] = useState("A1:G500");
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importEta, setImportEta] = useState(null);
  const fileInputRef = useRef(null);
  const bodyRef = useRef(null);

  // Sync default account when accounts list loads
  useEffect(() => {
    if (accounts.length > 0 && !targetAccount) {
      setTargetAccount(accounts[0].account_id);
    }
  }, [accounts]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setColumns([]);
      setMappings({});
      setRows([]);
      setSortKey(null);
      setSortDir("asc");
      setEditCell(null);
      setSheetsId("");
      setSheetsTab("");
      setSheetsRange("A1:G500");
      setIsImporting(false);
      setImportProgress(0);
      setImportDone(0);
      setImportTotal(0);
      setImportEta(null);
    }
  }, [open]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Load raw data (2D array) into state ──────────────────────
  const loadData = useCallback((raw2d) => {
    if (!raw2d || raw2d.length < 2) {
      toast.error("File must have at least a header row and one data row.");
      return;
    }
    const headers = raw2d[0].map((h) => String(h ?? "").trim());
    const dataRows = raw2d.slice(1);

    // Normalise: ensure every row has same length as headers
    const maxCols = headers.length;
    const normalised = dataRows.map((r) => {
      const row = [...r];
      while (row.length < maxCols) row.push("");
      return row.slice(0, maxCols).map((c) => String(c ?? ""));
    });

    const cols = headers.map((h, i) => ({ id: `col_${i}`, header: h }));
    const newMappings = {};
    cols.forEach((c) => { newMappings[c.id] = autoDetectField(c.header); });

    setColumns(cols);
    setMappings(newMappings);
    setRows(normalised);
    setSortKey(null);
  }, []);

  // ── File parsing ─────────────────────────────────────────────
  const parseFile = useCallback((file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (result) => loadData(result.data),
        error: (err) => toast.error(`CSV parse error: ${err.message}`),
      });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          loadData(data);
        } catch (err) {
          toast.error(`Excel parse error: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Unsupported file type. Use .xlsx, .xls, or .csv");
    }
  }, [loadData]);

  // ── Drag-and-drop for file drop zone ─────────────────────────
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileBrowse = (e) => {
    const file = e.target.files[0];
    if (file) parseFile(file);
  };

  // ── Google Sheets preview load ────────────────────────────────
  const loadSheetsPreview = async () => {
    if (!sheetsId.trim()) { toast.error("Enter a spreadsheet URL or ID"); return; }
    const m = sheetsId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const id = m ? m[1] : sheetsId.trim();
    const fullRange = sheetsTab.trim() ? `${sheetsTab.trim()}!${sheetsRange}` : sheetsRange;
    setSheetsLoading(true);
    try {
      const { data } = await api.post("/sheets/read-preview", { spreadsheet_id: id, range: fullRange });
      loadData(data.rows);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to load sheet. Make sure Google Sheets is connected.");
    } finally {
      setSheetsLoading(false);
    }
  };

  // ── DnD column reorder ────────────────────────────────────────
  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    const newColumns = arrayMove(columns, oldIndex, newIndex);
    // Reorder each row's cells to match
    const newRows = rows.map((row) => arrayMove(row, oldIndex, newIndex));
    setColumns(newColumns);
    setRows(newRows);
    setSortKey(null);
  };

  // ── Column sort ───────────────────────────────────────────────
  const handleSort = (colId) => {
    const newDir = sortKey === colId ? (sortDir === "asc" ? "desc" : "asc") : "asc";
    setSortKey(colId);
    setSortDir(newDir);
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const colIndex = columns.findIndex((c) => c.id === sortKey);
    if (colIndex === -1) return rows;
    return [...rows].sort((a, b) => {
      const va = a[colIndex] ?? "";
      const vb = b[colIndex] ?? "";
      const na = parseFloat(va);
      const nb = parseFloat(vb);
      let cmp;
      if (!isNaN(na) && !isNaN(nb)) {
        cmp = na - nb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  // ── Cell edit commit ──────────────────────────────────────────
  const handleCellCommit = (displayRowIndex, colIndex, newValue) => {
    // sortedRows is a view — we need to find the original row in `rows`
    const displayRow = sortedRows[displayRowIndex];
    const originalIndex = rows.findIndex((r) => r === displayRow);
    if (originalIndex === -1) return;
    const updated = rows.map((r, i) => {
      if (i !== originalIndex) return r;
      const newRow = [...r];
      newRow[colIndex] = newValue;
      return newRow;
    });
    setRows(updated);
  };

  // ── Mapping change ────────────────────────────────────────────
  const handleMappingChange = (colId, value) => {
    setMappings((prev) => ({ ...prev, [colId]: value }));
  };

  // ── Build & validate final transactions ──────────────────────
  const handleImport = async () => {
    if (isImporting) return;
    // Validation
    const mappingValues = Object.values(mappings);
    if (!mappingValues.includes("date")) { toast.error("Please map a column to 'Date'"); return; }
    if (!mappingValues.includes("amount")) { toast.error("Please map a column to 'Amount'"); return; }
    if (!targetAccount) { toast.error("Please select a target account"); return; }

    // Build field -> column index map
    const fieldToColIndex = {};
    columns.forEach((col, idx) => {
      const field = mappings[col.id];
      if (field && field !== "__skip__") fieldToColIndex[field] = idx;
    });

    const transactions = [];
    for (const row of rows) {
      const get = (field) => {
        const idx = fieldToColIndex[field];
        return idx !== undefined ? (row[idx] ?? "") : "";
      };
      const rawAmount = get("amount");
      const amount = parseFloat(String(rawAmount).replace(/[,$\s]/g, ""));
      if (isNaN(amount)) continue;

      const rawType = String(get("type") || "").toLowerCase();
      let type = "credit";
      if (rawType.includes("debit") || rawType === "dr" || rawType.startsWith("dr ") || rawType.endsWith(" dr")) type = "debit";
      else if (rawType.includes("credit") || rawType === "cr" || rawType.startsWith("cr ") || rawType.endsWith(" cr")) type = "credit";

      transactions.push({
        date: get("date") || new Date().toISOString().slice(0, 10),
        description: get("description"),
        type,
        amount: Math.abs(amount),
        currency: get("currency") || "USD",
        month: get("month"),
        category: get("category"),
        subcategory: get("subcategory"),
        department: get("department"),
        ledger: get("ledger"),
        vendor: get("vendor"),
        tx_id: get("tx_id"),
        source: get("source") || "import",
        account_id: targetAccount,
      });
    }

    if (transactions.length === 0) {
      toast.error("No valid transactions found. Make sure Amount column has numeric values.");
      return;
    }

    // Chunked upload with progress
    const CHUNK = 250;
    const chunks = [];
    for (let i = 0; i < transactions.length; i += CHUNK) chunks.push(transactions.slice(i, i + CHUNK));

    setIsImporting(true);
    setImportTotal(transactions.length);
    setImportDone(0);
    setImportProgress(0);
    setImportEta(null);

    const t0 = Date.now();
    let done = 0;
    try {
      for (const chunk of chunks) {
        await api.post("/transactions/bulk", { transactions: chunk });
        done += chunk.length;
        const pct = Math.round((done / transactions.length) * 100);
        const elapsed = (Date.now() - t0) / 1000;
        const eta = elapsed > 0.5 ? Math.ceil(((transactions.length - done) / done) * elapsed) : null;
        setImportDone(done);
        setImportProgress(pct);
        setImportEta(eta);
      }
      toast.success(`${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} imported`);
      onImport([]); // signal parent to reload
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import failed");
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportEta(null);
    }
  };

  const hasData = columns.length > 0 && rows.length > 0;
  const previewRows = sortedRows.slice(0, 100);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isImporting) onClose(); }}>
      <DialogContent className="max-w-5xl w-full flex flex-col gap-0 p-0 overflow-hidden" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E8E3DC] flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle style={{ fontFamily: "Outfit" }} className="text-xl font-light tracking-tight text-[#1A1A1A]">
                Import Transactions
              </DialogTitle>
              <p className="text-xs text-[#5C5C5C] mt-0.5">Upload a file or connect Google Sheets, map columns, then import.</p>
            </div>
            {/* Top-right action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8"
                onClick={() => { setActiveTab("file"); setTimeout(() => fileInputRef.current?.click(), 50); }}
                disabled={isImporting}
              >
                <Upload className="w-3.5 h-3.5 mr-1" />Upload File
              </Button>
              {hasData && (
                <Button
                  size="sm"
                  className="bg-moss hover:bg-[#3D5247] text-white text-xs h-8 min-w-[110px]"
                  onClick={handleImport}
                  disabled={isImporting}
                >
                  {isImporting
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{importProgress}%</>
                    : <>Import {rows.length} row{rows.length !== 1 ? "s" : ""}</>
                  }
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Progress bar */}
        {isImporting && (
          <div className="px-6 py-3 border-b border-[#E8E3DC] bg-[#F7F5F2] flex-shrink-0">
            <div className="flex justify-between items-center text-xs text-[#5C5C5C] mb-1.5">
              <span className="font-medium text-moss">{importDone.toLocaleString()} / {importTotal.toLocaleString()} rows uploaded</span>
              {importEta !== null && (
                <span>~{importEta < 60 ? `${importEta}s` : `${Math.ceil(importEta / 60)}m`} remaining</span>
              )}
            </div>
            <div className="h-2 bg-[#E8E3DC] rounded-full overflow-hidden">
              <div
                className="h-full bg-moss rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto relative">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Tab switcher */}
            <div className="px-6 pt-4 flex-shrink-0">
              <TabsList className="bg-[#F2F0ED] p-1">
                <TabsTrigger
                  value="file"
                  className="data-[state=active]:bg-white data-[state=active]:text-moss data-[state=active]:shadow-sm text-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  File (xlsx / csv)
                </TabsTrigger>
                <TabsTrigger
                  value="sheets"
                  className="data-[state=active]:bg-white data-[state=active]:text-moss data-[state=active]:shadow-sm text-xs"
                >
                  <Link className="w-3.5 h-3.5 mr-1.5" />
                  Google Sheets
                </TabsTrigger>
              </TabsList>
            </div>

            {/* File tab */}
            <TabsContent value="file" className="px-6 pt-4 pb-2 m-0">
              {!hasData ? (
                <div className="flex flex-col gap-3">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleFileDrop}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-colors",
                      isDragOver ? "border-moss bg-[#F0F5EF]" : "border-[#D8D3CC] bg-[#FAFAF8]"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-[#EEF2ED] flex items-center justify-center">
                      <Upload className="w-5 h-5 text-moss" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>
                        Drag & drop your file here
                      </div>
                      <div className="text-xs text-[#5C5C5C] mt-1">supports .xlsx, .xls, .csv</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#E8E3DC]" />
                    <span className="text-xs text-[#9E9E9E]">or</span>
                    <div className="flex-1 h-px bg-[#E8E3DC]" />
                  </div>
                  <Button
                    className="bg-moss hover:bg-[#3D5247] text-white w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleFileBrowse}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-7 h-7 rounded bg-[#EEF2ED] flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-moss" />
                  </div>
                  <div className="text-sm text-[#1A1A1A]">
                    <span className="font-medium">{rows.length} rows</span>
                    <span className="text-[#5C5C5C]"> · {columns.length} columns detected</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-xs text-[#5C5C5C] h-7"
                    onClick={() => { setColumns([]); setRows([]); setMappings({}); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  >
                    Change file
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Sheets tab */}
            <TabsContent value="sheets" className="px-6 pt-4 pb-2 m-0">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-[#5C5C5C] uppercase tracking-wider">Spreadsheet URL or ID</Label>
                  <Input
                    className="mt-1.5 text-sm"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetsId}
                    onChange={(e) => setSheetsId(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-[#5C5C5C] uppercase tracking-wider">Tab Name</Label>
                    <Input
                      className="mt-1.5 text-sm"
                      placeholder="e.g. Sheet1, Jan-2026"
                      value={sheetsTab}
                      onChange={(e) => setSheetsTab(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#5C5C5C] uppercase tracking-wider">Range</Label>
                    <Input
                      className="mt-1.5 text-sm"
                      value={sheetsRange}
                      onChange={(e) => setSheetsRange(e.target.value)}
                      placeholder="A1:J500"
                    />
                  </div>
                </div>
                {sheetsTab.trim() && (
                  <div className="text-xs text-[#5C5C5C] bg-[#F7F5F2] rounded px-3 py-2">
                    Will read: <span className="font-mono text-moss">{sheetsTab.trim()}!{sheetsRange}</span>
                  </div>
                )}
                <Button
                  className="bg-moss hover:bg-[#3D5247] text-white w-full"
                  onClick={loadSheetsPreview}
                  disabled={sheetsLoading}
                >
                  {sheetsLoading ? "Loading…" : "Load Preview"}
                </Button>
                {!hasData && (
                  <div className="text-xs text-[#5C5C5C] bg-[#F7F5F2] rounded p-3">
                    Make sure Google Sheets is connected in Integrations. The sheet must have a header row as the first row.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview table */}
          {hasData && (
            <div className="px-6 pt-4 pb-2">
              <div className="label-eyebrow mb-2 flex items-center justify-between">
                <span>Preview</span>
                <span className="text-[#5C5C5C] font-normal normal-case tracking-normal text-[11px]">
                  Showing {Math.min(previewRows.length, 100)} of {rows.length} rows · Drag column headers to reorder · Click cells to edit
                </span>
              </div>
              <div className="overflow-x-auto border border-[#E8E3DC] rounded-lg">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <table className="text-xs w-full border-collapse min-w-full">
                    <thead>
                      <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                        <tr>
                          {columns.map((col, colIdx) => (
                            <SortableColHeader
                              key={col.id}
                              id={col.id}
                              header={col.header}
                              mapping={mappings[col.id] ?? "__skip__"}
                              onMappingChange={handleMappingChange}
                              sortKey={sortKey}
                              sortDir={sortDir}
                              onSort={handleSort}
                            />
                          ))}
                        </tr>
                      </SortableContext>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={rowIdx % 2 === 0 ? "bg-white" : "bg-[#FAFAF8]"}
                        >
                          {row.map((cell, colIdx) => (
                            <td
                              key={colIdx}
                              className="border border-[#F0EDE8] px-3 py-1.5 max-w-[200px]"
                            >
                              <EditableCell
                                value={cell}
                                onCommit={(v) => handleCellCommit(rowIdx, colIdx, v)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DndContext>
              </div>
            </div>
          )}

          {/* Floating scroll buttons */}
          {hasData && (
            <div className="sticky bottom-4 flex justify-end pr-4 pointer-events-none">
              <div className="flex flex-col gap-1.5 pointer-events-auto">
                <button
                  title="Scroll to top"
                  onClick={() => bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                  className="w-8 h-8 rounded-full bg-white border border-[#E8E3DC] shadow-md flex items-center justify-center text-[#5C5C5C] hover:bg-[#F2F0ED] hover:text-moss transition-colors"
                >
                  <ArrowUpToLine className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Scroll to bottom"
                  onClick={() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" })}
                  className="w-8 h-8 rounded-full bg-white border border-[#E8E3DC] shadow-md flex items-center justify-center text-[#5C5C5C] hover:bg-[#F2F0ED] hover:text-moss transition-colors"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasData && (
          <div className="border-t border-[#E8E3DC] px-6 py-4 flex items-center gap-3 flex-wrap bg-[#FAFAF8] flex-shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Label className="text-xs text-[#5C5C5C] whitespace-nowrap uppercase tracking-wider">Target account</Label>
              <Select value={targetAccount} onValueChange={setTargetAccount} disabled={isImporting}>
                <SelectTrigger className="h-8 text-xs w-56">
                  <SelectValue placeholder="Select account…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.account_id} value={a.account_id} className="text-xs">
                      {a.code} · {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs" disabled={isImporting}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-moss hover:bg-[#3D5247] text-white text-xs min-w-[120px]"
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{importProgress}% — {importDone.toLocaleString()} done</>
                  : <>Import {rows.length} row{rows.length !== 1 ? "s" : ""}</>
                }
              </Button>
            </div>
          </div>
        )}

        {!hasData && (
          <div className="border-t border-[#E8E3DC] px-6 py-4 flex justify-end bg-[#FAFAF8] flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
