// Simulated "Sarvam" AI suggestion layer.
//
// When the deterministic engine can't attribute a payment, we fall back to a
// probabilistic guess. Today this is a small hand-written fuzzy scorer; the
// intent is to swap this single function for a real Sarvam (or other) AI model
// later — the interface (raw payment + customer book → ranked suggestion) stays
// the same. We add a little latency so the UI shows an honest "thinking" state.

import type { Customer, IncomingPayment, Invoice, Suggestion } from "./types";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const norm = (s: string | undefined): string =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Local part of a UPI handle, e.g. "ramesh@oksbi" → "ramesh". */
const upiLocal = (upi: string | undefined): string => norm(upi).split("@")[0] ?? "";

/** Normalized Levenshtein similarity in [0,1]; 1 === identical. */
function similarity(a: string, b: string): number {
  a = norm(a);
  b = norm(b);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      prev = tmp;
    }
  }
  const dist = dp[n];
  return 1 - dist / Math.max(m, n);
}

type Scored = { customer: Customer; score: number; signals: string[] };

function scoreCustomer(payment: IncomingPayment, customer: Customer, invoices: Invoice[]): Scored {
  const signals: string[] = [];
  let score = 0;

  // Fuzzy name match (typos, partials, initials).
  const nameSim = similarity(payment.payerName, customer.name);
  if (nameSim > 0.5) {
    score += nameSim * 0.5;
    signals.push(`name ~${Math.round(nameSim * 100)}% similar to "${customer.name}"`);
  }

  // Fuzzy UPI local-part match (same person, different bank handle).
  const upiSim = similarity(upiLocal(payment.payerUpiId), upiLocal(customer.upiId));
  if (upiSim > 0.6 && upiLocal(payment.payerUpiId)) {
    score += upiSim * 0.35;
    signals.push(`UPI handle "${upiLocal(payment.payerUpiId)}" ~${Math.round(upiSim * 100)}% similar`);
  }

  // Amount lines up with an open invoice for this customer.
  const matchingInvoice = invoices.find(
    (i) => i.customerId === customer.id && i.status === "pending" && i.amount === payment.amount,
  );
  if (matchingInvoice) {
    score += 0.25;
    signals.push(`₹${payment.amount} exactly matches open invoice ${matchingInvoice.invoiceId}`);
  } else if (payment.amount <= customer.reconPendingAmount && customer.reconPendingAmount > 0) {
    score += 0.08;
    signals.push(`₹${payment.amount} fits within ₹${customer.reconPendingAmount} pending balance`);
  }

  return { customer, score: Math.min(score, 0.99), signals };
}

/**
 * Returns the single best suggestion, or null if nothing is plausible.
 * Async + latency to mimic a remote model call.
 */
export async function suggestWithSarvam(
  payment: IncomingPayment,
  customers: Customer[],
  invoices: Invoice[],
): Promise<Suggestion | null> {
  await sleep(700); // simulate model inference latency

  const ranked = customers
    .map((c) => scoreCustomer(payment, c, invoices))
    .filter((s) => s.signals.length > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const CONFIDENCE_FLOOR = 0.4;
  if (!best || best.score < CONFIDENCE_FLOOR) return null;

  return {
    suggestedCustomerId: best.customer.id,
    suggestedCustomerName: best.customer.name,
    confidence: Number(best.score.toFixed(2)),
    reason: `Likely ${best.customer.name} — ${best.signals.join("; ")}.`,
    signals: best.signals,
  };
}
