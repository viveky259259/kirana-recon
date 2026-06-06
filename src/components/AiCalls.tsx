"use client";

import { useCallback, useEffect, useState } from "react";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

type Customer = { id: string; name: string; reconPendingAmount: number };
type Call = {
  customerId: string;
  name: string;
  amount: number;
  transcript: { speaker: "AI" | "Customer"; text: string }[];
  outcome: string;
  promise: string | null;
};

// Simulated automated AI dunning calls: phones every customer with a pending
// khata balance using Sarvam's conversational AI and shows the (generated)
// reminder conversation + outcome. The "call" is simulated; the conversation is
// genuinely produced by Sarvam.
export function AiCalls() {
  const [pending, setPending] = useState<Customer[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [dialing, setDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPending = useCallback(() => {
    fetch("/api/state")
      .then((r) => r.json())
      .then((d) => setPending((d.customers ?? []).filter((c: Customer) => c.reconPendingAmount > 0)));
  }, []);

  useEffect(() => loadPending(), [loadPending]);

  async function startCalls() {
    setDialing(true);
    setCalls([]);
    setError(null);
    try {
      const res = await fetch("/api/khata/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Could not place calls.");
      else setCalls(data.calls ?? []);
    } catch {
      setError("Could not place calls. Please try again.");
    } finally {
      setDialing(false);
    }
  }

  const totalDue = pending.reduce((n, c) => n + c.reconPendingAmount, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            📞 AI reminder calls
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
              Sarvam AI
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Auto-call every customer who has udhaar pending. The AI talks to them and asks for payment.
            {pending.length > 0 && (
              <> {pending.length} customer{pending.length === 1 ? "" : "s"} owe {inr(totalDue)}.</>
            )}
          </p>
        </div>
        <button
          onClick={startCalls}
          disabled={dialing || pending.length === 0}
          className="rounded-lg bg-[#00a4e4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0090c8] disabled:opacity-50"
        >
          {dialing ? "Calling…" : pending.length === 0 ? "No dues to call" : "Start AI calls"}
        </button>
      </div>

      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {dialing && (
        <div className="mt-4 space-y-2">
          {pending.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-700">Dialing {c.name}…</span>
              <span className="ml-auto text-slate-500">{inr(c.reconPendingAmount)}</span>
            </div>
          ))}
        </div>
      )}

      {calls.length > 0 && (
        <div className="mt-4 space-y-4">
          {calls.map((call) => (
            <div key={call.customerId} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-800">
                  {call.name} <span className="font-normal text-slate-400">· {inr(call.amount)} due</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {call.outcome}
                </span>
              </div>
              <div className="space-y-1.5">
                {call.transcript.map((t, i) => (
                  <div key={i} className={`flex ${t.speaker === "AI" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                        t.speaker === "AI"
                          ? "rounded-bl-sm bg-violet-50 text-violet-900"
                          : "rounded-br-sm bg-sky-100 text-sky-900"
                      }`}
                    >
                      <span className="mr-1 text-[10px] font-bold uppercase opacity-50">
                        {t.speaker === "AI" ? "AI" : call.name}
                      </span>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
              {call.promise && (
                <div className="mt-2 text-xs text-emerald-700">✓ Promised to pay: {call.promise}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
