"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard, AppBadge, inr } from "@/components/ui";
import type { ReportSummary } from "@/lib/report";

export default function ReportsPage() {
  const [range, setRange] = useState<"day" | "week">("day");
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/reports?range=${range}`)
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => load(), [load]);

  async function sendEod() {
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/reports/eod", { method: "POST" });
      const data = await res.json();
      setSendMsg(data.emailed ? "EOD report emailed to store owner." : "Report generated (SMTP not configured — logged to server console).");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-paytm-navy">Reports</h1>
        <div className="flex gap-2 items-center">
          <div className="bg-white rounded-lg border border-slate-200 p-0.5 flex">
            {(["day", "week"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-md text-sm font-semibold ${range === r ? "bg-paytm-cyan text-white" : "text-slate-500"}`}
              >
                {r === "day" ? "Today" : "Last 7 days"}
              </button>
            ))}
          </div>
          <button onClick={sendEod} disabled={sending} className="pt-btn">
            {sending ? "Sending…" : "Send EOD email now"}
          </button>
        </div>
      </div>

      {sendMsg && <div className="pt-card p-3 text-sm text-paytm-navy bg-sky-50">{sendMsg}</div>}

      {loading || !report ? (
        <div className="pt-card p-8 text-center text-slate-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Transactions" value={report.totalCount} sub={inr(report.totalAmount)} />
            <StatCard label="Matched" value={report.matchedCount} sub={inr(report.matchedAmount)} tone="good" />
            <StatCard label="Unmatched" value={report.unmatchedCount} sub={inr(report.unmatchedAmount)} tone="bad" />
            <StatCard
              label="Match Rate"
              value={report.totalCount ? Math.round((report.matchedCount / report.totalCount) * 100) + "%" : "—"}
            />
          </div>

          <div className="pt-card p-5">
            <h2 className="font-semibold text-paytm-navy mb-3">Matched vs unmatched by app</h2>
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th className="py-2">App</th>
                  <th className="py-2">Matched</th>
                  <th className="py-2">Unmatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.byApp.length === 0 ? (
                  <tr><td colSpan={3} className="py-4 text-slate-400">No transactions in range.</td></tr>
                ) : (
                  report.byApp.map((a) => (
                    <tr key={a.app}>
                      <td className="py-2"><AppBadge app={a.app} /></td>
                      <td className="py-2 text-emerald-700">{a.matchedCount} · {inr(a.matchedAmount)}</td>
                      <td className="py-2 text-rose-700">{a.unmatchedCount} · {inr(a.unmatchedAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-card p-5">
            <h2 className="font-semibold text-paytm-navy mb-3">Unmatched — needs manual resolution ({report.unmatched.length})</h2>
            {report.unmatched.length === 0 ? (
              <p className="text-sm text-emerald-600">All clear. 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-slate-500 text-left">
                  <tr>
                    <th className="py-2">Date</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">App</th>
                    <th className="py-2">Payer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.unmatched.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2 text-slate-500">{new Date(u.paidAt).toLocaleString("en-IN")}</td>
                      <td className="py-2 font-semibold">{inr(u.amount)}</td>
                      <td className="py-2"><AppBadge app={u.sourceApp} /></td>
                      <td className="py-2 text-slate-600">{u.payerVpa ?? u.externalId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
