"use client";

import { useCallback, useEffect, useState } from "react";
import { VoiceCollect } from "@/components/VoiceCollect";
import { PhotoCollect } from "@/components/PhotoCollect";
import { inr } from "@/components/ui";

type Entry = {
  id: string;
  payerName: string | null;
  amount: number;
  source: "VOICE" | "OCR" | "MANUAL";
  status: "PENDING" | "APPROVED" | "DECLINED";
  rawText: string | null;
  batchId: string | null;
  createdAt: string;
};

const SOURCE_LABEL: Record<Entry["source"], string> = {
  VOICE: "🎙️ Voice",
  OCR: "📄 Photo",
  MANUAL: "✍️ Manual",
};

export default function CollectPage() {
  const [entries, setEntries] = useState<Entry[]>([]);

  const load = useCallback(() => {
    fetch("/api/recon/entries")
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []));
  }, []);

  useEffect(() => load(), [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    // Optimistic update so the merchant sees the result instantly.
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...body } : e)));
    await fetch(`/api/recon/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/recon/entries/${id}`, { method: "DELETE" });
  }

  const pending = entries.filter((e) => e.status === "PENDING");
  const approved = entries.filter((e) => e.status === "APPROVED");
  const declined = entries.filter((e) => e.status === "DECLINED");
  const sum = (list: Entry[]) => list.reduce((n, e) => n + e.amount, 0);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-paytm-navy">Money received offline</h1>
        <p className="text-sm text-slate-500">
          Got cash or a payment outside the app? Say it or take a photo of your note. Then say yes or no to each one.
        </p>
      </div>

      {/* Capture */}
      <div className="grid md:grid-cols-2 gap-4">
        <VoiceCollect onCaptured={load} />
        <PhotoCollect onCaptured={load} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="To review" value={pending.length} sub={inr(sum(pending))} tone="warn" />
        <Stat label="Approved" value={approved.length} sub={inr(sum(approved))} tone="good" />
        <Stat label="Declined" value={declined.length} sub={inr(sum(declined))} tone="bad" />
      </div>

      {/* To review */}
      <section className="pt-card overflow-hidden border-l-4 border-l-amber-400">
        <h2 className="font-semibold text-paytm-navy px-4 py-3">To review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-emerald-600">All caught up — nothing pending.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.map((e) => (
              <PendingRow key={e.id} entry={e} onPatch={patch} onRemove={remove} />
            ))}
          </ul>
        )}
      </section>

      {/* Decided */}
      {approved.length > 0 && (
        <DecidedSection title={`Approved (${approved.length})`} accent="emerald" entries={approved} onPatch={patch} />
      )}
      {declined.length > 0 && (
        <DecidedSection title={`Declined (${declined.length})`} accent="rose" entries={declined} onPatch={patch} />
      )}
    </main>
  );
}

function PendingRow({
  entry,
  onPatch,
  onRemove,
}: {
  entry: Entry;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState(entry.payerName ?? "");
  const [amount, setAmount] = useState(String(entry.amount));

  function saveName() {
    if ((entry.payerName ?? "") !== name) onPatch(entry.id, { payerName: name });
  }
  function saveAmount() {
    const a = Number(amount);
    if (a > 0 && a !== entry.amount) onPatch(entry.id, { amount: a });
  }

  return (
    <li className="px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-xs text-slate-400 w-16 shrink-0">{SOURCE_LABEL[entry.source]}</span>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        placeholder="Name"
        className="pt-input flex-1 min-w-[120px] py-1.5"
      />
      <div className="flex items-center gap-1">
        <span className="text-slate-400">₹</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={saveAmount}
          inputMode="decimal"
          className="pt-input w-24 py-1.5 font-semibold"
        />
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => onPatch(entry.id, { status: "APPROVED" })}
          className="pt-btn bg-emerald-500 hover:bg-emerald-600 py-1.5 px-3 text-sm"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => onPatch(entry.id, { status: "DECLINED" })}
          className="pt-btn bg-rose-500 hover:bg-rose-600 py-1.5 px-3 text-sm"
        >
          ✗ Decline
        </button>
        <button onClick={() => onRemove(entry.id)} title="Delete" className="text-slate-300 hover:text-slate-500 px-1">
          🗑
        </button>
      </div>
      {entry.rawText && entry.rawText !== `${name} ${amount}` && (
        <div className="w-full text-[11px] text-slate-400 pl-16">read: &ldquo;{entry.rawText}&rdquo;</div>
      )}
    </li>
  );
}

function DecidedSection({
  title,
  accent,
  entries,
  onPatch,
}: {
  title: string;
  accent: "emerald" | "rose";
  entries: Entry[];
  onPatch: (id: string, body: Record<string, unknown>) => void;
}) {
  const bar = accent === "emerald" ? "border-l-emerald-400" : "border-l-rose-400";
  return (
    <section className={`pt-card overflow-hidden border-l-4 ${bar}`}>
      <h2 className="font-semibold text-paytm-navy px-4 py-3">{title}</h2>
      <ul className="divide-y divide-slate-100">
        {entries.map((e) => (
          <li key={e.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
            <span className="text-xs text-slate-400 w-16 shrink-0">{SOURCE_LABEL[e.source]}</span>
            <span className="font-medium text-slate-700">{e.payerName ?? "Unknown"}</span>
            <span className="font-semibold ml-auto">{inr(e.amount)}</span>
            <button
              onClick={() => onPatch(e.id, { status: "PENDING" })}
              className="text-xs text-paytm-cyan-dark hover:underline ml-2"
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "good" | "bad" | "warn";
}) {
  const tones = {
    good: "bg-emerald-50 text-emerald-700",
    bad: "bg-rose-50 text-rose-700",
    warn: "bg-amber-50 text-amber-700",
  };
  return (
    <div className={`pt-card p-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
      <div className="text-xs opacity-70">{sub}</div>
    </div>
  );
}
