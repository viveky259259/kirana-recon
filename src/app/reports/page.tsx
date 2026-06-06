"use client";

import { useEffect, useState, useCallback } from "react";
import { StatCard, AppBadge, inr } from "@/components/ui";
import type { ReportSummary } from "@/lib/billingReport";

export default function ReportsPage() {
  const [range, setRange] = useState<"day" | "week">("day");
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [eodHtml, setEodHtml] = useState<string | null>(null);
  const [demoing, setDemoing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/billing/reports?range=${range}`)
      .then((r) => r.json())
      .then((d) => setReport(d.report))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => load(), [load]);

  async function loadDemo() {
    setDemoing(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/billing/demo", { method: "POST" });
      const data = await res.json();
      setSendMsg(`Added ${data.seeded} sample payments from Paytm, Google Pay and PhonePe.`);
      setRange("day");
      load();
      // also refresh any open EOD preview
      if (eodHtml) generateEod();
    } finally {
      setDemoing(false);
    }
  }

  async function generateEod() {
    setGenerating(true);
    try {
      const res = await fetch("/api/billing/reports/eod/preview");
      const data = await res.json();
      setEodHtml(data.html ?? null);
    } finally {
      setGenerating(false);
    }
  }

  async function sendEod() {
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/billing/reports/eod", { method: "POST" });
      const data = await res.json();
      setSendMsg(data.emailed ? "Report sent to your email." : "Report ready (email not set up yet).");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-paytm-navy">Reports</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="bg-white rounded-lg border border-slate-200 p-0.5 flex">
            {(["day", "week"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`px-3 py-1 rounded-md text-sm font-semibold ${range === r ? "bg-paytm-cyan text-white" : "text-slate-500"}`}>
                {r === "day" ? "Today" : "Last 7 days"}
              </button>
            ))}
          </div>
          <button onClick={loadDemo} disabled={demoing} className="pt-btn-ghost">
            {demoing ? "Loading…" : "Load sample payments"}
          </button>
          <button onClick={generateEod} disabled={generating} className="pt-btn-ghost">
            {generating ? "Please wait…" : "See day's report"}
          </button>
          <button onClick={sendEod} disabled={sending} className="pt-btn">
            {sending ? "Sending…" : "Email me this report"}
          </button>
        </div>
      </div>

      {sendMsg && <div className="pt-card p-3 text-sm text-paytm-navy bg-sky-50">{sendMsg}</div>}

      {eodHtml && (
        <div className="pt-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-paytm-navy">Day&apos;s report</h2>
            <button onClick={() => setEodHtml(null)} className="text-sm text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <p className="text-xs text-slate-500 mb-3">This is the report we email you every night.</p>
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: eodHtml }} />
          </div>
        </div>
      )}

      {loading || !report ? (
        <div className="pt-card p-8 text-center text-slate-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total payments" value={report.totalCount} sub={inr(report.totalAmount)} />
            <StatCard label="Bill found" value={report.matchedCount} sub={inr(report.matchedAmount)} tone="good" />
            <StatCard label="To check" value={report.unmatchedCount} sub={inr(report.unmatchedAmount)} tone="bad" />
            <StatCard label="Bill found %" value={report.totalCount ? Math.round((report.matchedCount / report.totalCount) * 100) + "%" : "—"} />
          </div>

          <div className="pt-card p-5">
            <h2 className="font-semibold text-paytm-navy mb-3">By app</h2>
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left">
                <tr><th className="py-2">App</th><th className="py-2">Bill found</th><th className="py-2">To check</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.byApp.length === 0 ? (
                  <tr><td colSpan={3} className="py-4 text-slate-400">No payments yet. Add some on Match Payments.</td></tr>
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
            <h2 className="font-semibold text-paytm-navy mb-3">Please check these ({report.unmatched.length})</h2>
            {report.unmatched.length === 0 ? (
              <p className="text-sm text-emerald-600">All clear. 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-slate-500 text-left">
                  <tr><th className="py-2">Date</th><th className="py-2">Amount</th><th className="py-2">App</th><th className="py-2">Payer</th></tr>
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
    </main>
  );
}
