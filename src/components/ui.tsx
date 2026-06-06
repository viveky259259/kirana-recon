import React from "react";

export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const tones: Record<string, string> = {
    default: "bg-white",
    good: "bg-emerald-50",
    bad: "bg-rose-50",
    warn: "bg-amber-50",
  };
  const valueTones: Record<string, string> = {
    default: "text-paytm-navy",
    good: "text-emerald-700",
    bad: "text-rose-700",
    warn: "text-amber-700",
  };
  return (
    <div className={`pt-card p-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueTones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

const appColors: Record<string, string> = {
  PAYTM: "bg-sky-100 text-sky-800",
  GPAY: "bg-green-100 text-green-800",
  PHONEPE: "bg-violet-100 text-violet-800",
  OTHER: "bg-slate-100 text-slate-700",
};

const appNames: Record<string, string> = {
  PAYTM: "Paytm",
  GPAY: "Google Pay",
  PHONEPE: "PhonePe",
  OTHER: "Other",
};

export function AppBadge({ app }: { app: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${appColors[app] ?? appColors.OTHER}`}>
      {appNames[app] ?? app}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    MATCHED: { cls: "bg-emerald-100 text-emerald-800", label: "✓ Bill found" },
    MISMATCH: { cls: "bg-amber-100 text-amber-800", label: "⚠ Wrong amount" },
    UNMATCHED: { cls: "bg-rose-100 text-rose-800", label: "✗ No bill found" },
    PAID: { cls: "bg-emerald-100 text-emerald-800", label: "Paid" },
    PARTIAL: { cls: "bg-amber-100 text-amber-800", label: "Part paid" },
    PENDING: { cls: "bg-slate-100 text-slate-700", label: "Not paid yet" },
  };
  const s = map[status] ?? { cls: "bg-slate-100 text-slate-700", label: status };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}
