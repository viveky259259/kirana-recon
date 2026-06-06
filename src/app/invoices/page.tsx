"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge, inr } from "@/components/ui";
import { VoiceInvoice } from "@/components/VoiceInvoice";

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

  const load = useCallback(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices));
  }, []);

  useEffect(() => load(), [load]);

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
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

  async function showQr(id: string) {
    const res = await fetch(`/api/invoices/${id}/qr`);
    if (res.ok) setQr(await res.json());
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-paytm-navy">Invoices</h1>

      <VoiceInvoice onCreated={load} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create form */}
        <form onSubmit={createInvoice} className="pt-card p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-paytm-navy">Create invoice</h2>
          <div>
            <label className="pt-label">Amount (₹)</label>
            <input
              className="pt-input"
              type="number"
              min="1"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 450"
            />
          </div>
          <div>
            <label className="pt-label">Customer name (optional)</label>
            <input
              className="pt-input"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ramesh"
            />
          </div>
          <div>
            <label className="pt-label">Note (optional)</label>
            <input className="pt-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="2kg rice, 1L oil" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} />
            Udhaar (credit — goods given, payment expected later)
          </label>
          <button className="pt-btn w-full" disabled={busy}>
            {busy ? "Creating…" : "Create & generate QR"}
          </button>
        </form>

        {/* QR / deeplink panel */}
        <div className="pt-card p-5 flex flex-col items-center justify-center text-center min-h-[300px]">
          {qr ? (
            <>
              <div className="text-xs font-semibold text-slate-500 mb-1">Recon ID</div>
              <div className="font-mono font-bold text-paytm-navy mb-3">{qr.invoice.reconId}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qrDataUrl} alt="UPI QR" className="w-48 h-48 rounded-lg border border-slate-200" />
              <div className="text-lg font-bold text-paytm-navy mt-3">{inr(qr.invoice.amount)}</div>
              <p className="text-xs text-slate-500 mt-2 max-w-xs">
                Customer scans this QR (or taps the link). The Recon ID rides into the UPI payment so it auto-matches
                here.
              </p>
              <a href={qr.deeplink} className="pt-btn mt-3 inline-block">Open in UPI app</a>
              <button onClick={() => navigator.clipboard.writeText(qr.deeplink)} className="text-xs text-slate-400 mt-2">
                Copy deeplink
              </button>
            </>
          ) : (
            <p className="text-slate-400 text-sm">Create an invoice to generate its dynamic UPI QR &amp; deeplink.</p>
          )}
        </div>
      </div>

      {/* List */}
      <div className="pt-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2">Recon ID</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No invoices yet.</td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs">
                    {inv.reconId}
                    {inv.isCredit && <span className="ml-1 text-amber-600">· udhaar</span>}
                  </td>
                  <td className="px-4 py-2">{inv.customerName ?? "—"}</td>
                  <td className="px-4 py-2 font-semibold">{inr(inv.amount)}</td>
                  <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                  <td className="px-4 py-2 text-slate-500">{new Date(inv.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => showQr(inv.id)} className="text-paytm-cyan-dark font-semibold text-xs">
                      Show QR
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
