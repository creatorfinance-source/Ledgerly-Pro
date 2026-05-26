import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plug, RefreshCw, CheckCircle2, ExternalLink, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import ImportPreviewModal from "@/components/ImportPreviewModal";

const PROVIDER_LOGOS = {
  paypal: "https://images.unsplash.com/photo-1641350625112-3b1d73c71418?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwxfHxwYXlwYWwlMjBzdHJpcGUlMjBsb2dvfGVufDB8fHx8MTc3ODM3Njc3M3ww&ixlib=rb-4.1.0&q=85",
};
const FALLBACK = "https://images.unsplash.com/photo-1652017687934-d14ec6280dd5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwzfHxwYXlwYWwlMjBzdHJpcGUlMjBsb2dvfGVufDB8fHx8MTc3ODM3Njc3M3ww&ixlib=rb-4.1.0&q=85";

export default function Integrations() {
  const [items, setItems] = useState([]);
  const [sheetsStatus, setSheetsStatus] = useState({ configured: false, connected: false });
  const [accounts, setAccounts] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [sheetsImportOpen, setSheetsImportOpen] = useState(false);
  const [importForm, setImportForm] = useState({ spreadsheet_id: "", range: "A1:G1000", account_id: "" });

  const load = async () => {
    try {
      const [a, s, ac] = await Promise.all([api.get("/integrations"), api.get("/sheets/status"), api.get("/accounts")]);
      setItems(a.data); setSheetsStatus(s.data); setAccounts(ac.data);
      if (ac.data[0]) setImportForm((f) => ({ ...f, account_id: f.account_id || ac.data[0].account_id }));
    } catch {
      toast.error("Failed to load integrations");
    }
  };
  useEffect(() => { load(); }, []);

  // Detect ?sheets=connected after redirect
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("sheets") === "connected") {
      toast.success("Google Sheets connected");
      url.searchParams.delete("sheets");
      window.history.replaceState({}, "", url.toString());
      load();
    }
  }, []);

  const connect = async (provider) => {
    if (provider === "google-sheets") {
      try {
        const { data } = await api.get("/sheets/connect");
        window.location.href = data.authorize_url;
      } catch (e) {
        toast.error(e?.response?.data?.detail || "Configure GOOGLE_OAUTH_CLIENT_ID first");
      }
      return;
    }
    await api.post(`/integrations/${provider}/connect`);
    toast.success("Connected");
    load();
  };

  const disconnect = async (provider) => {
    await api.post(`/integrations/${provider}/disconnect`);
    toast.success("Disconnected");
    load();
  };

  const sync = async (provider) => {
    try {
      const { data } = await api.post(`/integrations/${provider}/sync`);
      toast.success(`Imported ${data.imported} transactions`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Sync failed"); }
  };

  const importFromSheet = async () => {
    try {
      const { data } = await api.post("/sheets/import-transactions", importForm);
      toast.success(`Imported ${data.imported} transactions`);
      setSheetsImportOpen(false);
    } catch (e) { toast.error(e?.response?.data?.detail || "Import failed"); }
  };

  const handleBulkImport = async (transactions) => {
    // Modal handles chunked upload itself and passes empty array as "done" signal
    if (!transactions || transactions.length === 0) { load(); return; }
    try {
      await api.post("/transactions/bulk", { transactions });
      toast.success(`${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} imported`);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import failed");
    }
  };

  const psps = items.filter((i) => i.category === "PSP");
  const sheets = items.find((i) => i.provider === "google-sheets");

  return (
    <div className="p-6 md:p-8" data-testid="integrations-page">
      <div className="mb-8">
        <div className="label-eyebrow">Add‑ons</div>
        <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Integrations</h1>
        <p className="mt-2 text-sm text-[#5C5C5C] max-w-2xl">Pre‑built connectors for payment processors and Google Sheets. Connect once and let your books update themselves.</p>
      </div>

      <div className="mb-6">
        <div className="label-eyebrow mb-3">Payment Service Providers</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {psps.map((it) => (
            <Card key={it.provider} className="surface-card p-6" data-testid={`psp-card-${it.provider}`}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-md overflow-hidden border border-cream flex items-center justify-center" style={{ background: it.color, color: "white", fontFamily: "Outfit", fontWeight: 600 }}>
                  {it.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium" style={{ fontFamily: "Outfit" }}>{it.name}</h3>
                    {it.is_mock && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wider bg-[#FBEDE9] text-terracotta">Sample data</span>}
                  </div>
                  <div className="text-xs text-[#5C5C5C] mt-1">Auto‑reconciled transactions, fee tracking and refunds.</div>
                  <div className="mt-3 flex items-center gap-2">
                    {it.status === "connected" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-moss"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span>
                    ) : (
                      <span className="text-xs text-[#5C5C5C]">Not connected</span>
                    )}
                    {it.last_sync && <span className="text-[10px] text-[#5C5C5C]">· last sync {new Date(it.last_sync).toLocaleString()}</span>}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {it.status === "connected" ? (
                      <>
                        <Button size="sm" onClick={() => sync(it.provider)} className="bg-moss hover:bg-[#3D5247] text-white" data-testid={`sync-${it.provider}-btn`}><RefreshCw className="w-3 h-3 mr-1" />Sync now</Button>
                        <Button size="sm" variant="outline" onClick={() => disconnect(it.provider)} data-testid={`disconnect-${it.provider}-btn`}>Disconnect</Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => connect(it.provider)} className="bg-moss hover:bg-[#3D5247] text-white" data-testid={`connect-${it.provider}-btn`}><Plug className="w-3 h-3 mr-1" />Connect</Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="label-eyebrow mb-3">Productivity</div>
        <Card className="surface-card p-6" data-testid="sheets-card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-md flex items-center justify-center text-white font-semibold" style={{ background: "#0F9D58", fontFamily: "Outfit" }}>G</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium" style={{ fontFamily: "Outfit" }}>Google Sheets</h3>
              <div className="text-xs text-[#5C5C5C] mt-1">Export any statement to a fresh sheet, or import transactions from an existing sheet.</div>
              <div className="mt-3">
                {!sheetsStatus.configured ? (
                  <div className="text-xs text-terracotta">OAuth not configured. Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to backend/.env</div>
                ) : sheetsStatus.connected ? (
                  <span className="inline-flex items-center gap-1 text-xs text-moss"><CheckCircle2 className="w-3.5 h-3.5" /> Connected{sheetsStatus.email ? ` · ${sheetsStatus.email}` : ""}</span>
                ) : (
                  <span className="text-xs text-[#5C5C5C]">Not connected</span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {sheetsStatus.connected ? (
                  <>
                    <Button size="sm" onClick={() => setSheetsImportOpen(true)} className="bg-moss hover:bg-[#3D5247] text-white" data-testid="sheets-import-btn"><Download className="w-3 h-3 mr-1" />Import transactions</Button>
                    <Button size="sm" variant="outline" onClick={() => window.open("/statements", "_self")}>Export from Statements</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => connect("google-sheets")} className="bg-moss hover:bg-[#3D5247] text-white" data-testid="sheets-connect-btn"><ExternalLink className="w-3 h-3 mr-1" />Connect Google</Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* File Import — always available regardless of Sheets connection */}
        <Card className="surface-card p-6 mt-4" data-testid="file-import-card">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-md flex items-center justify-center text-white font-semibold" style={{ background: "#4A6741", fontFamily: "Outfit" }}>
              <Upload className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium" style={{ fontFamily: "Outfit" }}>File Import</h3>
              <div className="text-xs text-[#5C5C5C] mt-1">Import transactions from a local Excel (.xlsx, .xls) or CSV file. Drag-and-drop supported with column mapping preview.</div>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  className="bg-moss hover:bg-[#3D5247] text-white"
                  onClick={() => setImportOpen(true)}
                  data-testid="file-import-btn"
                >
                  <Upload className="w-3 h-3 mr-1" />Import File
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* File import modal */}
      <ImportPreviewModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleBulkImport}
        accounts={accounts}
      />

      {/* Classic Google Sheets import dialog */}
      <Dialog open={sheetsImportOpen} onOpenChange={setSheetsImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>Import transactions from Sheet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Spreadsheet ID</Label><Input value={importForm.spreadsheet_id} onChange={(e) => setImportForm({ ...importForm, spreadsheet_id: e.target.value })} className="mt-1.5" data-testid="sheets-id-input" /></div>
            <div><Label>Range</Label><Input value={importForm.range} onChange={(e) => setImportForm({ ...importForm, range: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Target account</Label>
              <Select value={importForm.account_id} onValueChange={(v) => setImportForm({ ...importForm, account_id: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{accounts.map((a) => <SelectItem key={a.account_id} value={a.account_id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="text-xs text-[#5C5C5C]">Expected columns: Date, Description, Type (debit/credit), Amount, Currency, Category, Source.</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSheetsImportOpen(false)}>Cancel</Button>
            <Button className="bg-moss hover:bg-[#3D5247] text-white" onClick={importFromSheet} data-testid="sheets-import-submit">Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
