"use client";

import { useEffect, useState } from "react";
import { StatusBadge, AppBadge, inr } from "@/components/ui";

type Payment = {
  id: string;
  amount: number;
  paidAt: string;
  payerVpa: string | null;
  sourceApp: string;
  matchStatus: string;
};

type Detail = {
  invoice: {
    id: string;
    reconId: string;
    amount: number;
    customerName: string | null;
    note: string | null;
    isCredit: boolean;
    status: string;
    createdAt: string;
    payments: Payment[];
  };
  deeplink: string;
  qrDataUrl: string;
  paidTotal: number;
};

// Detail modal shown when an invoice row is clicked.
export function InvoiceDetail({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/billing/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [invoiceId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40" onClick={onClose}>
      <div className="pt-card w-full max-w-2xl max-h-[88vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="bg-paytm-navy text-white px-5 py-4 rounded-t-[14px] flex items-start justify-between">
          <div>
            <div className="text-xs opacity-70">Bill</div>
            <div className="font-mono font-bold text-lg">{data?.invoice.reconId ?? "…"}</div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>

        {!data ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : (
          <div className="p-5 grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Row label="Amount" value={<span className="text-xl font-bold text-paytm-navy">{inr(data.invoice.amount)}</span>} />
              <Row label="Status" value={<StatusBadge status={data.invoice.status} />} />
              <Row label="Customer" value={data.invoice.customerName ?? "—"} />
              <Row label="What they bought" value={data.invoice.note ?? "—"} />
              <Row label="Type" value={data.invoice.isCredit ? "Udhaar (pay later)" : "Normal sale"} />
              <Row label="Date" value={new Date(data.invoice.createdAt).toLocaleString("en-IN")} />
              <Row
                label="Paid so far"
                value={
                  <span className={data.paidTotal >= data.invoice.amount ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
                    {inr(data.paidTotal)} / {inr(data.invoice.amount)}
                  </span>
                }
              />
            </div>

            <div className="flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.qrDataUrl} alt="UPI QR" className="w-44 h-44 rounded-lg border border-slate-200" />
              <a href={data.deeplink} className="pt-btn mt-3 inline-block">Pay now</a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(data.deeplink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="text-xs text-slate-400 mt-2"
              >
                {copied ? "Copied!" : "Copy pay link"}
              </button>
            </div>

            <div className="md:col-span-2">
              <h3 className="font-semibold text-paytm-navy mb-2">Payments for this bill ({data.invoice.payments.length})</h3>
              {data.invoice.payments.length === 0 ? (
                <p className="text-sm text-slate-400">No payment yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-slate-500 text-left">
                    <tr>
                      <th className="py-1">Date</th><th className="py-1">Amount</th><th className="py-1">App</th><th className="py-1">Payer</th><th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.invoice.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 text-slate-500">{new Date(p.paidAt).toLocaleString("en-IN")}</td>
                        <td className="py-1.5 font-semibold">{inr(p.amount)}</td>
                        <td className="py-1.5"><AppBadge app={p.sourceApp} /></td>
                        <td className="py-1.5 text-slate-600">{p.payerVpa ?? "—"}</td>
                        <td className="py-1.5"><StatusBadge status={p.matchStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}
