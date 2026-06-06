import { prisma } from "./prisma";

export type AppBreakdown = {
  app: string;
  matchedCount: number;
  matchedAmount: number;
  unmatchedCount: number;
  unmatchedAmount: number;
};

export type ReportSummary = {
  from: string;
  to: string;
  label: string;
  totalCount: number;
  totalAmount: number;
  matchedCount: number;
  matchedAmount: number;
  unmatchedCount: number; // includes MISMATCH
  unmatchedAmount: number;
  byApp: AppBreakdown[];
  unmatched: {
    id: string;
    externalId: string;
    amount: number;
    paidAt: string;
    payerVpa: string | null;
    sourceApp: string;
    txnRef: string | null;
    matchStatus: string;
  }[];
};

export type RangeKind = "day" | "week" | "custom";

export function rangeFor(kind: RangeKind, ref: Date = new Date()): { from: Date; to: Date; label: string } {
  const to = new Date(ref);
  to.setHours(23, 59, 59, 999);
  const from = new Date(ref);
  if (kind === "week") {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to, label: "Last 7 days" };
  }
  from.setHours(0, 0, 0, 0);
  return { from, to, label: "Today" };
}

export async function buildReport(from: Date, to: Date, label: string): Promise<ReportSummary> {
  const payments = await prisma.payment.findMany({
    where: { paidAt: { gte: from, lte: to } },
    orderBy: { paidAt: "desc" },
    include: { invoice: true },
  });

  const apps = ["PAYTM", "GPAY", "PHONEPE", "OTHER"];
  const byApp: Record<string, AppBreakdown> = {};
  for (const a of apps) {
    byApp[a] = { app: a, matchedCount: 0, matchedAmount: 0, unmatchedCount: 0, unmatchedAmount: 0 };
  }

  let totalAmount = 0;
  let matchedCount = 0;
  let matchedAmount = 0;
  let unmatchedCount = 0;
  let unmatchedAmount = 0;
  const unmatched: ReportSummary["unmatched"] = [];

  for (const p of payments) {
    totalAmount += p.amount;
    const bucket = byApp[p.sourceApp] ?? byApp.OTHER;
    if (p.matchStatus === "MATCHED") {
      matchedCount++;
      matchedAmount += p.amount;
      bucket.matchedCount++;
      bucket.matchedAmount += p.amount;
    } else {
      unmatchedCount++;
      unmatchedAmount += p.amount;
      bucket.unmatchedCount++;
      bucket.unmatchedAmount += p.amount;
      unmatched.push({
        id: p.id,
        externalId: p.externalId,
        amount: p.amount,
        paidAt: p.paidAt.toISOString(),
        payerVpa: p.payerVpa,
        sourceApp: p.sourceApp,
        txnRef: p.txnRef,
        matchStatus: p.matchStatus,
      });
    }
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label,
    totalCount: payments.length,
    totalAmount,
    matchedCount,
    matchedAmount,
    unmatchedCount,
    unmatchedAmount,
    byApp: apps.map((a) => byApp[a]).filter((b) => b.matchedCount + b.unmatchedCount > 0),
    unmatched,
  };
}

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Single-page HTML used for the EOD email body.
export function reportToHtml(r: ReportSummary, storeName: string): string {
  const rows = r.unmatched
    .map(
      (u) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${new Date(u.paidAt).toLocaleString("en-IN")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${inr(u.amount)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${u.sourceApp}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${u.payerVpa ?? "—"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${u.matchStatus}</td>
      </tr>`
    )
    .join("");

  const appRows = r.byApp
    .map(
      (a) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${a.app}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#0a7d33">${a.matchedCount} · ${inr(a.matchedAmount)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#b40000">${a.unmatchedCount} · ${inr(a.unmatchedAmount)}</td>
      </tr>`
    )
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;color:#102a43">
    <div style="background:#002970;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <div style="font-size:13px;opacity:.8">${storeName}</div>
      <div style="font-size:20px;font-weight:700">Reconciliation Report — ${r.label}</div>
    </div>
    <div style="border:1px solid #e3e8ef;border-top:0;border-radius:0 0 10px 10px;padding:20px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr>
          <td style="padding:10px;background:#f0f7ff;border-radius:8px;text-align:center">
            <div style="font-size:12px;color:#486581">Total</div>
            <div style="font-size:18px;font-weight:700">${r.totalCount}</div>
            <div style="font-size:13px">${inr(r.totalAmount)}</div>
          </td>
          <td style="width:10px"></td>
          <td style="padding:10px;background:#e9f9ef;border-radius:8px;text-align:center">
            <div style="font-size:12px;color:#0a7d33">Matched</div>
            <div style="font-size:18px;font-weight:700">${r.matchedCount}</div>
            <div style="font-size:13px">${inr(r.matchedAmount)}</div>
          </td>
          <td style="width:10px"></td>
          <td style="padding:10px;background:#fdecec;border-radius:8px;text-align:center">
            <div style="font-size:12px;color:#b40000">Unmatched</div>
            <div style="font-size:18px;font-weight:700">${r.unmatchedCount}</div>
            <div style="font-size:13px">${inr(r.unmatchedAmount)}</div>
          </td>
        </tr>
      </table>

      <h3 style="font-size:14px;margin:18px 0 6px">Breakdown by app</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="text-align:left;color:#627d98">
          <th style="padding:6px 10px">App</th><th style="padding:6px 10px">Matched</th><th style="padding:6px 10px">Unmatched</th>
        </tr>
        ${appRows || `<tr><td colspan="3" style="padding:10px;color:#627d98">No transactions.</td></tr>`}
      </table>

      <h3 style="font-size:14px;margin:18px 0 6px">Unmatched — needs manual resolution (${r.unmatched.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="text-align:left;color:#627d98">
          <th style="padding:6px 10px">Date</th><th style="padding:6px 10px">Amount</th><th style="padding:6px 10px">App</th><th style="padding:6px 10px">Payer</th><th style="padding:6px 10px">Status</th>
        </tr>
        ${rows || `<tr><td colspan="5" style="padding:10px;color:#0a7d33">All clear — nothing to resolve. 🎉</td></tr>`}
      </table>
    </div>
  </div>`;
}
