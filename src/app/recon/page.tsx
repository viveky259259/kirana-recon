"use client";

import { useEffect, useState, useCallback } from "react";
import { AppBadge, StatusBadge, inr } from "@/components/ui";

type Payment = {
  id: string;
  externalId: string;
  txnRef: string | null;
  amount: number;
  paidAt: string;
  payerVpa: string | null;
  sourceApp: string;
  matchStatus: string;
  invoice: { id: string; reconId: string; amount: number; customerName: string | null } | null;
};

type Invoice = { id: string; reconId: string; amount: number; customerName: string | null; status: string };

type ImportSummary = {
  detectedApp: string;
  total: number;
  imported: number;
  duplicates: number;
  matched: number;
  mismatch: number;
  unmatched: number;
  parseErrors: string[];
};

export default function ReconPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [forceApp, setForceApp] = useState("AUTO");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkFor, setLinkFor] = useState<Payment | null>(null);

  const load = useCallback(() => {
    fetch("/api/payments").then((r) => r.json()).then((d) => setPayments(d.payments));
    fetch("/api/invoices").then((r) => r.json()).then((d) => setInvoices(d.invoices));
  }, []);

  useEffect(() => load(), [load]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setSummary(null);
    try {
      const csv = await file.text();
      const res = await fetch("/api/payments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, forceApp: forceApp === "AUTO" ? undefined : forceApp }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Import failed");
        return;
      }
      setSummary(data.summary);
      load();
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function link(invoiceId: string) {
    if (!linkFor) return;
    const res = await fetch("/api/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: linkFor.id, invoiceId }),
    });
    if (res.ok) {
      setLinkFor(null);
      load();
    } else {
      alert("Link failed");
    }
  }

  const matched = payments.filter((p) => p.matchStatus === "MATCHED");
  const needsAttention = payments.filter((p) => p.matchStatus !== "MATCHED");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-paytm-navy">Reconcile payments</h1>

      {/* Upload */}
      <div className="pt-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="pt-label">Source app</label>
            <select className="pt-input" value={forceApp} onChange={(e) => setForceApp(e.target.value)}>
              <option value="AUTO">Auto-detect</option>
              <option value="PAYTM">Paytm</option>
              <option value="GPAY">Google Pay</option>
              <option value="PHONEPE">PhonePe</option>
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="pt-label">UPI settlement CSV</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} className="pt-input" />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Re-uploading the same file is safe — duplicate transactions are detected by UTR/RRN and skipped.
        </p>

        {summary && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
            <Pill label="Detected" value={summary.detectedApp} />
            <Pill label="Rows" value={summary.total} />
            <Pill label="Imported" value={summary.imported} />
            <Pill label="Matched" value={summary.matched} tone="good" />
            <Pill label="Unmatched" value={summary.unmatched + summary.mismatch} tone="bad" />
            <Pill label="Duplicates" value={summary.duplicates} tone="warn" />
            {summary.parseErrors.length > 0 && (
              <div className="col-span-full text-xs text-amber-700 bg-amber-50 rounded p-2">
                {summary.parseErrors.slice(0, 4).map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
                {summary.parseErrors.length > 4 && <div>+{summary.parseErrors.length - 4} more…</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Needs attention */}
      <Section title={`Needs attention (${needsAttention.length})`} accent="rose">
        {needsAttention.length === 0 ? (
          <Empty good>Nothing to resolve — every payment is matched.</Empty>
        ) : (
          <PaymentTable payments={needsAttention} onLink={(p) => setLinkFor(p)} />
        )}
      </Section>

      {/* Matched */}
      <Section title={`Matched (${matched.length})`} accent="emerald">
        {matched.length === 0 ? <Empty>No matched payments yet.</Empty> : <PaymentTable payments={matched} />}
      </Section>

      {/* Link modal */}
      {linkFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-30" onClick={() => setLinkFor(null)}>
          <div className="pt-card p-5 w-full max-w-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-paytm-navy">Link payment to an invoice</h3>
            <p className="text-sm text-slate-500 mb-3">
              {inr(linkFor.amount)} · <AppBadge app={linkFor.sourceApp} /> · {linkFor.payerVpa ?? linkFor.externalId}
            </p>
            <div className="space-y-2">
              {invoices.filter((i) => i.status !== "PAID").length === 0 && (
                <p className="text-sm text-slate-400">No open invoices. Create one first.</p>
              )}
              {invoices
                .slice()
                .sort((a, b) => Math.abs(a.amount - linkFor.amount) - Math.abs(b.amount - linkFor.amount))
                .map((inv) => {
                  const exact = Math.abs(inv.amount - linkFor.amount) < 0.01;
                  return (
                    <button
                      key={inv.id}
                      onClick={() => link(inv.id)}
                      className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-paytm-cyan flex items-center justify-between"
                    >
                      <span>
                        <span className="font-mono text-xs">{inv.reconId}</span>
                        {inv.customerName && <span className="text-slate-500"> · {inv.customerName}</span>}
                        {exact && <span className="ml-2 text-emerald-600 text-xs font-semibold">amount match</span>}
                      </span>
                      <span className="font-semibold">{inr(inv.amount)}</span>
                    </button>
                  );
                })}
            </div>
            <button onClick={() => setLinkFor(null)} className="pt-btn-ghost mt-4 w-full">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentTable({ payments, onLink }: { payments: Payment[]; onLink?: (p: Payment) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Amount</th>
            <th className="px-4 py-2">App</th>
            <th className="px-4 py-2">Payer</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Invoice</th>
            {onLink && <th className="px-4 py-2"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(p.paidAt).toLocaleString("en-IN")}</td>
              <td className="px-4 py-2 font-semibold">{inr(p.amount)}</td>
              <td className="px-4 py-2"><AppBadge app={p.sourceApp} /></td>
              <td className="px-4 py-2 text-slate-600">{p.payerVpa ?? <span className="text-slate-400">{p.externalId}</span>}</td>
              <td className="px-4 py-2"><StatusBadge status={p.matchStatus} /></td>
              <td className="px-4 py-2 font-mono text-xs">{p.invoice ? p.invoice.reconId : "—"}</td>
              {onLink && (
                <td className="px-4 py-2 text-right">
                  <button onClick={() => onLink(p)} className="pt-btn-ghost text-xs py-1 px-2">Link</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent: "rose" | "emerald"; children: React.ReactNode }) {
  const bar = accent === "rose" ? "border-l-rose-400" : "border-l-emerald-400";
  return (
    <div className={`pt-card overflow-hidden border-l-4 ${bar}`}>
      <h2 className="font-semibold text-paytm-navy px-4 py-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children, good }: { children: React.ReactNode; good?: boolean }) {
  return <p className={`px-4 pb-4 text-sm ${good ? "text-emerald-600" : "text-slate-400"}`}>{children}</p>;
}

function Pill({ label, value, tone = "default" }: { label: string; value: string | number; tone?: string }) {
  const tones: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    good: "bg-emerald-100 text-emerald-800",
    bad: "bg-rose-100 text-rose-800",
    warn: "bg-amber-100 text-amber-800",
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone]}`}>
      <div className="text-[10px] uppercase font-semibold opacity-70">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
