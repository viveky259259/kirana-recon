"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge, inr } from "@/components/ui";
import { VoiceInvoice } from "@/components/VoiceInvoice";
import { InvoiceDetail } from "@/components/InvoiceDetail";

type Invoice = {
  id: string;
  reconId: string;
  amount: number;
  customerName: string | null;
  note: string | null;
  isCredit: boolean;
  status: string;
  createdAt: string;
  payments: { id: string }[];
};

type QrData = { invoice: Invoice; deeplink: string; qrDataUrl: string };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [amount, setAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<QrData | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/billing/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices));
  }, []);

  useEffect(() => load(), [load]);

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), customerName, note, isCredit }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed");
        return;
      }
      setQr(data);
      setAmount("");
      setCustomerName("");
      setNote("");
      setIsCredit(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-paytm-navy">Bills</h1>
      <p className="text-sm text-slate-500 -mt-4">Make a bill and get a QR code. When the customer pays, we find this bill on its own.</p>

      <VoiceInvoice onCreated={load} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create form */}
        <form onSubmit={createInvoice} className="pt-card p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-paytm-navy">New bill</h2>
          <div>
            <label className="pt-label">Amount (₹)</label>
            <input className="pt-input" type="number" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 450" />
          </div>
          <div>
            <label className="pt-label">Customer name (optional)</label>
            <input className="pt-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Ramesh" />
          </div>
          <div>
            <label className="pt-label">What did they buy? (optional)</label>
            <input className="pt-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="2kg rice, 1L oil" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} />
            Udhaar (will pay later)
          </label>
          <button className="pt-btn w-full" disabled={busy}>{busy ? "Making…" : "Make bill & QR code"}</button>
        </form>

        {/* QR / deeplink panel */}
        <div className="pt-card p-5 flex flex-col items-center justify-center text-center min-h-[300px]">
          {qr ? (
            <>
              <div className="text-xs font-semibold text-slate-500 mb-1">Bill code</div>
              <div className="font-mono font-bold text-paytm-navy mb-3">{qr.invoice.reconId}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qrDataUrl} alt="UPI QR" className="w-48 h-48 rounded-lg border border-slate-200" />
              <div className="text-lg font-bold text-paytm-navy mt-3">{inr(qr.invoice.amount)}</div>
              <p className="text-xs text-slate-500 mt-2 max-w-xs">
                Show this QR to the customer. They can pay with any UPI app. We will link the payment to this bill on its own.
              </p>
              <a href={qr.deeplink} className="pt-btn mt-3 inline-block">Pay now</a>
            </>
          ) : (
            <p className="text-slate-400 text-sm">Make a bill to get its QR code.</p>
          )}
        </div>
      </div>

      {/* List */}
      <div className="pt-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2">Bill code</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No bills yet.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} onClick={() => setDetailId(inv.id)} className="hover:bg-sky-50 cursor-pointer">
                  <td className="px-4 py-2 font-mono text-xs">
                    {inv.reconId}
                    {inv.isCredit && <span className="ml-1 text-amber-600">· udhaar</span>}
                  </td>
                  <td className="px-4 py-2">{inv.customerName ?? "—"}</td>
                  <td className="px-4 py-2 font-semibold">{inr(inv.amount)}</td>
                  <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-2 text-slate-500">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={(e) => { e.stopPropagation(); setDetailId(inv.id); }} className="text-paytm-cyan-dark font-semibold text-xs">View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailId && <InvoiceDetail invoiceId={detailId} onClose={() => setDetailId(null)} />}
    </main>
  );
}
