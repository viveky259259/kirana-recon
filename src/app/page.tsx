"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCard, AppBadge, inr } from "@/components/ui";
import type { ReportSummary } from "@/lib/report";

export default function Dashboard() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports?range=day")
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-paytm-navy">Today&apos;s Reconciliation</h1>
          <p className="text-sm text-slate-500">Match UPI payments to invoices before end of day.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices" className="pt-btn-ghost">+ New Invoice</Link>
          <Link href="/recon" className="pt-btn">Upload Payments</Link>
        </div>
      </div>

      {loading ? (
        <div className="pt-card p-8 text-center text-slate-400">Loading…</div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Transactions" value={report.totalCount} sub={inr(report.totalAmount)} />
            <StatCard label="Matched" value={report.matchedCount} sub={inr(report.matchedAmount)} tone="good" />
            <StatCard label="Unmatched" value={report.unmatchedCount} sub={inr(report.unmatchedAmount)} tone="bad" />
            <StatCard
              label="Match Rate"
              value={report.totalCount ? Math.round((report.matchedCount / report.totalCount) * 100) + "%" : "—"}
              tone="default"
            />
          </div>

          <div className="pt-card p-5">
            <h2 className="font-semibold text-paytm-navy mb-3">Breakdown by payment app</h2>
            {report.byApp.length === 0 ? (
              <p className="text-sm text-slate-400">No payments imported yet today.</p>
            ) : (
              <div className="space-y-2">
                {report.byApp.map((a) => (
                  <div key={a.app} className="flex items-center gap-4 text-sm">
                    <div className="w-24"><AppBadge app={a.app} /></div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                        <div
                          className="bg-emerald-400 h-full"
                          style={{ width: `${pct(a.matchedCount, a.matchedCount + a.unmatchedCount)}%` }}
                        />
                        <div
                          className="bg-rose-400 h-full"
                          style={{ width: `${pct(a.unmatchedCount, a.matchedCount + a.unmatchedCount)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-emerald-700 w-28 text-right">{a.matchedCount} matched</div>
                    <div className="text-rose-700 w-28 text-right">{a.unmatchedCount} unmatched</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-paytm-navy">Needs attention ({report.unmatched.length})</h2>
              <Link href="/recon" className="text-sm text-paytm-cyan-dark font-semibold">Resolve →</Link>
            </div>
            {report.unmatched.length === 0 ? (
              <p className="text-sm text-emerald-600">All payments reconciled. 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {report.unmatched.slice(0, 5).map((u) => (
                  <li key={u.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <AppBadge app={u.sourceApp} />
                      <span className="text-slate-600">{u.payerVpa ?? u.externalId}</span>
                    </span>
                    <span className="font-semibold text-paytm-navy">{inr(u.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="pt-card p-8 text-center text-rose-500">Failed to load report.</div>
      )}
    </div>
  );
}

function pct(n: number, total: number) {
  return total ? (n / total) * 100 : 0;
}
