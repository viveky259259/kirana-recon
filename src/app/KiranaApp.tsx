"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardState, Payment, PaymentStatus } from "@/lib/types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ---------------------------------------------------------------------------
// Customer-side simulator presets — each drives a different engine branch.
// ---------------------------------------------------------------------------
type Preset = {
  label: string;
  hint: string;
  payerName: string;
  payerUpiId: string;
  invoiceId: string;
  amount: string;
};

const PRESETS: Preset[] = [
  {
    label: "Invoice match → recon",
    hint: "Exact invoice id → recon received, pending reduced",
    payerName: "Ramesh Kumar",
    payerUpiId: "ramesh@oksbi",
    invoiceId: "INV-1001",
    amount: "500",
  },
  {
    label: "UPI id match",
    hint: "Unique UPI id → payment attributed to customer",
    payerName: "",
    payerUpiId: "imran.shaikh@okaxis",
    invoiceId: "",
    amount: "1000",
  },
  {
    label: "Name match",
    hint: "Unique name → payment attributed to customer",
    payerName: "Sunita Devi",
    payerUpiId: "",
    invoiceId: "",
    amount: "200",
  },
  {
    label: "Sarvam suggestion",
    hint: "Typo'd name + different UPI handle → AI suggests a payer",
    payerName: "Ramesh Kmar",
    payerUpiId: "ramesh@paytm",
    invoiceId: "",
    amount: "500",
  },
  {
    label: "Unknown payer",
    hint: "Nothing matches → manual review",
    payerName: "Arjun Mehta",
    payerUpiId: "arjun@okhdfc",
    invoiceId: "",
    amount: "99",
  },
];

// ---------------------------------------------------------------------------
// Status presentation
// ---------------------------------------------------------------------------
const STATUS_META: Record<PaymentStatus, { label: string; cls: string }> = {
  recon_received: { label: "Recon received", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  payment_received: { label: "Payment received", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  confirmed: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  suggested: { label: "Needs confirmation", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  unmatched: { label: "Manual review", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

export default function KiranaApp() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [form, setForm] = useState<Preset>(PRESETS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  // Initial load + light polling so the store screen reacts to payments live.
  // setState only runs inside refresh() after the awaited fetch resolves, so
  // there's no synchronous cascading render.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) void refresh();
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refresh]);

  const submitPayment = async () => {
    setSubmitting(true);
    setFlash(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payerName: form.payerName,
          payerUpiId: form.payerUpiId,
          invoiceId: form.invoiceId || undefined,
          amount: Number(form.amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash(data.error ?? "Something went wrong.");
      } else {
        setState(data.state);
        setFlash(`Payment sent → ${data.payment.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetDemo = async () => {
    const res = await fetch("/api/reset", { method: "POST" });
    if (res.ok) {
      setState(await res.json());
      setFlash("Demo reset to seed data.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900">
      <header className="bg-gradient-to-r from-[#012b72] to-[#00a4e4] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-lg font-bold">₹</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Kirana Recon</h1>
              <p className="text-xs text-white/80">Payment reconciliation for {state?.storeName ?? "your store"}</p>
            </div>
          </div>
          <button
            onClick={resetDemo}
            className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
          >
            Reset demo
          </button>
        </div>
      </header>

      {flash && (
        <div className="mx-auto max-w-6xl px-5 pt-4">
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">{flash}</div>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[380px_1fr]">
        <CustomerSimulator
          form={form}
          setForm={setForm}
          submitting={submitting}
          onSubmit={submitPayment}
        />
        <StoreDashboard state={state} onAfterAction={refresh} />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customer side — "paid somewhere else"
// ---------------------------------------------------------------------------
function CustomerSimulator({
  form,
  setForm,
  submitting,
  onSubmit,
}: {
  form: Preset;
  setForm: (p: Preset) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const set = (k: keyof Preset, v: string) => setForm({ ...form, [k]: v });
  const inputCls =
    "w-full rounded-[0.6rem] border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-[#00a4e4]";

  return (
    <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-100 text-violet-700">📱</span>
        <h2 className="text-base font-semibold">Customer pays</h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Simulates a payment made on any UPI app. Sending it POSTs to the store&apos;s ingest API.
      </p>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Scenarios</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            title={p.hint}
            onClick={() => setForm(p)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              form.label === p.label
                ? "border-[#012b72] bg-[#012b72] text-white"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mb-4 min-h-[16px] text-xs italic text-slate-400">{form.hint}</p>

      <div className="space-y-3">
        <Field label="Payer name">
          <input
            value={form.payerName}
            onChange={(e) => set("payerName", e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className={inputCls}
          />
        </Field>
        <Field label="Payer UPI id">
          <input
            value={form.payerUpiId}
            onChange={(e) => set("payerUpiId", e.target.value)}
            placeholder="e.g. ramesh@oksbi"
            className={inputCls}
          />
        </Field>
        <Field label="Invoice id (optional)">
          <input
            value={form.invoiceId}
            onChange={(e) => set("invoiceId", e.target.value)}
            placeholder="e.g. INV-1001"
            className={inputCls}
          />
        </Field>
        <Field label="Amount (₹)">
          <input
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            inputMode="numeric"
            placeholder="500"
            className={inputCls}
          />
        </Field>
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="mt-5 w-full rounded-xl bg-[#00a4e4] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0090c9] disabled:opacity-60"
      >
        {submitting ? "Sending…" : `Pay ${form.amount ? inr(Number(form.amount) || 0) : "₹0"}`}
      </button>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid rgb(226 232 240);
          border-radius: 0.6rem;
          padding: 0.55rem 0.7rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        :global(.input:focus) {
          border-color: #00a4e4;
        }
      `}</style>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Store side — the Kirana owner's screen
// ---------------------------------------------------------------------------
function StoreDashboard({
  state,
  onAfterAction,
}: {
  state: DashboardState | null;
  onAfterAction: () => void;
}) {
  if (!state) {
    return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading…</section>;
  }

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Recon pending" value={inr(state.totals.totalReconPending)} tone="amber" />
        <Stat label="Payments matched" value={String(state.totals.reconReceivedCount)} tone="emerald" />
        <Stat label="Awaiting review" value={String(state.totals.awaitingReviewCount)} tone="rose" />
      </div>

      <Customers state={state} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Incoming payments</h2>
        {state.payments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            No payments yet. Use the simulator on the left to send one.
          </div>
        ) : (
          <div className="space-y-3">
            {state.payments.map((p) => (
              <PaymentCard key={p.id} payment={p} onAfterAction={onAfterAction} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "amber" | "emerald" | "rose" }) {
  const tones = {
    amber: "text-amber-700",
    emerald: "text-emerald-700",
    rose: "text-rose-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Customers({ state }: { state: DashboardState }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Khata customers</h2>
      <div className="divide-y divide-slate-100">
        {state.customers.map((c) => (
          <div key={c.id} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-800">{c.name}</p>
              <p className="text-xs text-slate-400">{c.upiId}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${c.reconPendingAmount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {inr(c.reconPendingAmount)}
              </p>
              <p className="text-[11px] text-slate-400">{c.reconPendingAmount > 0 ? "pending" : "settled"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentCard({ payment, onAfterAction }: { payment: Payment; onAfterAction: () => void }) {
  const [busy, setBusy] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showLog, setShowLog] = useState(false);
  const meta = STATUS_META[payment.status];

  const act = async (action: "confirm" | "dismiss") => {
    setBusy(true);
    try {
      await fetch(`/api/suggestions/${payment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback }),
      });
      await onAfterAction();
    } finally {
      setBusy(false);
      setShowDismiss(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {inr(payment.amount)}
            {payment.payerName ? ` from ${payment.payerName}` : ""}
          </p>
          <p className="text-xs text-slate-400">
            {payment.payerUpiId || "no UPI"}
            {payment.invoiceId ? ` · ${payment.invoiceId}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}>
          {meta.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-700">{payment.message}</p>

      {payment.suggestion && payment.status === "suggested" && (
        <div className="mt-3 rounded-xl bg-violet-50 p-3 text-xs text-violet-900">
          <p className="font-semibold">
            🤖 Sarvam suggestion · {Math.round(payment.suggestion.confidence * 100)}% confidence
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-violet-800">
            {payment.suggestion.signals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {payment.status === "suggested" && (
        <div className="mt-3">
          {!showDismiss ? (
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => act("confirm")}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                ✓ Correct
              </button>
              <button
                disabled={busy}
                onClick={() => setShowDismiss(true)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
                placeholder="Why is this wrong? (helps the future AI model)"
                className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-[#00a4e4]"
              />
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => act("dismiss")}
                  className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  Submit feedback
                </button>
                <button
                  disabled={busy}
                  onClick={() => setShowDismiss(false)}
                  className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {payment.feedback && (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          Feedback: “{payment.feedback}”
        </p>
      )}

      <button
        onClick={() => setShowLog((v) => !v)}
        className="mt-3 text-[11px] font-medium text-slate-400 hover:text-slate-600"
      >
        {showLog ? "Hide" : "Show"} engine trace
      </button>
      {showLog && (
        <ol className="mt-1 space-y-0.5 rounded-lg bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
          {payment.engineLog.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
