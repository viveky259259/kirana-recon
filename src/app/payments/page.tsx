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
  const [simulating, setSimulating] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    fetch("/api/billing/payments").then((r) => r.json()).then((d) => setPayments(d.payments));
    fetch("/api/billing/invoices").then((r) => r.json()).then((d) => setInvoices(d.invoices));
  }, []);

  useEffect(() => load(), [load]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setSummary(null);
    try {
      const csv = await file.text();
      const res = await fetch("/api/billing/payments/import", {
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

  const appName: Record<string, string> = { PAYTM: "Paytm", GPAY: "Google Pay", PHONEPE: "PhonePe", OTHER: "another app" };

  async function simulate() {
    setSimulating(true);
    try {
      const res = await fetch("/api/billing/simulate", { method: "POST" });
      const data = await res.json();
      const p = data.payment;
      const via = appName[p.sourceApp] ?? p.sourceApp;
      if (data.matched && data.bill) {
        const who = data.bill.customerName ? data.bill.customerName : "a customer";
        setToast({ text: `${inr(p.amount)} received from ${who} on ${via} — bill ${data.bill.reconId} marked paid.`, ok: true });
      } else {
        setToast({ text: `${inr(p.amount)} received on ${via} — no bill found, please check it below.`, ok: false });
      }
      load();
      setTimeout(() => setToast(null), 5000);
    } finally {
      setSimulating(false);
    }
  }

  async function link(invoiceId: string) {
    if (!linkFor) return;
    const res = await fetch("/api/billing/link", {
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
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Payment notification */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-40 max-w-sm rounded-xl shadow-lg px-4 py-3 text-sm text-white ${
            toast.ok ? "bg-emerald-600" : "bg-amber-600"
          }`}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">{toast.ok ? "✓" : "!"}</span>
            <div>
              <div className="font-semibold">{toast.ok ? "Payment received" : "Payment received"}</div>
              <div className="opacity-95">{toast.text}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-paytm-navy">Match Payments</h1>
          <p className="text-sm text-slate-500">
            See money you got and which bill it is for. Customer pays — we match it on its own.
          </p>
        </div>
        <button onClick={simulate} disabled={simulating} className="pt-btn">
          {simulating ? "Please wait…" : "▶ Test a payment"}
        </button>
      </div>

      {/* Upload */}
      <div className="pt-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="pt-label">Which app?</label>
            <select className="pt-input" value={forceApp} onChange={(e) => setForceApp(e.target.value)}>
              <option value="AUTO">Find out for me</option>
              <option value="PAYTM">Paytm</option>
              <option value="GPAY">Google Pay</option>
              <option value="PHONEPE">PhonePe</option>
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="pt-label">Payments file from your UPI app (CSV)</label>
            <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} className="pt-input" />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          You can upload the same file again — we will not count the same payment twice.
        </p>

        {summary && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
            <Pill label="App" value={appName[summary.detectedApp] ?? summary.detectedApp} />
            <Pill label="Lines" value={summary.total} />
            <Pill label="Added" value={summary.imported} />
            <Pill label="Bill found" value={summary.matched} tone="good" />
            <Pill label="To check" value={summary.unmatched + summary.mismatch} tone="bad" />
            <Pill label="Repeated" value={summary.duplicates} tone="warn" />
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
      <Section title={`Please check these (${needsAttention.length})`} accent="rose">
        {needsAttention.length === 0 ? (
          <Empty good>All good — every payment has a bill.</Empty>
        ) : (
          <PaymentTable payments={needsAttention} onLink={(p) => setLinkFor(p)} />
        )}
      </Section>

      {/* Matched */}
      <Section title={`Bill found (${matched.length})`} accent="emerald">
        {matched.length === 0 ? <Empty>No payments yet.</Empty> : <PaymentTable payments={matched} />}
      </Section>

      {/* Link modal */}
      {linkFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-30" onClick={() => setLinkFor(null)}>
          <div className="pt-card p-5 w-full max-w-lg max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-paytm-navy">Choose the bill for this payment</h3>
            <p className="text-sm text-slate-500 mb-3">
              {inr(linkFor.amount)} · <AppBadge app={linkFor.sourceApp} /> · {linkFor.payerVpa ?? linkFor.externalId}
            </p>
            <div className="space-y-2">
              {invoices.filter((i) => i.status !== "PAID").length === 0 && (
                <p className="text-sm text-slate-400">No open bills. Make one first.</p>
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
                        {exact && <span className="ml-2 text-emerald-600 text-xs font-semibold">same amount</span>}
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
    </main>
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
            <th className="px-4 py-2">Paid by</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Bill</th>
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
                  <button onClick={() => onLink(p)} className="pt-btn-ghost text-xs py-1 px-2">Pick bill</button>
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
