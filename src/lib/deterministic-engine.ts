// The deterministic validation engine.
//
// Given a raw incoming payment, it tries to attribute the money to exactly one
// known customer using *exact, unique* matches on three signals, in priority
// order:
//
//   1. payment invoice id   → strongest: this settles a specific invoice (recon)
//   2. customer UPI id       → unique id: identifies the payer
//   3. customer name         → unique id: identifies the payer
//
// "Unique" is load-bearing: a signal only counts if it maps to *exactly one*
// customer/invoice. An ambiguous signal (two customers share a name) is treated
// as no match, deferring to the probabilistic Sarvam layer.

import type { Customer, IncomingPayment, Invoice, MatchType } from "./types";

export type EngineDecision = {
  status: "recon_received" | "payment_received" | "no_match";
  matchType: MatchType;
  customerId?: string;
  /** Matched invoice, present only for invoice-id matches. */
  invoiceId?: string;
  log: string[];
};

const norm = (s: string | undefined): string =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function uniqueBy<T>(items: T[], predicate: (item: T) => boolean): T | "none" | "ambiguous" {
  const hits = items.filter(predicate);
  if (hits.length === 0) return "none";
  if (hits.length > 1) return "ambiguous";
  return hits[0];
}

export function runDeterministicEngine(
  payment: IncomingPayment,
  customers: Customer[],
  invoices: Invoice[],
): EngineDecision {
  const log: string[] = [];

  // --- 1. Invoice id (strongest signal → reconciliation) ---
  if (payment.invoiceId && norm(payment.invoiceId)) {
    log.push(`Checking invoice id "${payment.invoiceId}" against open invoices…`);
    const inv = uniqueBy(invoices, (i) => norm(i.invoiceId) === norm(payment.invoiceId));
    if (inv === "ambiguous") {
      log.push("✗ Invoice id maps to multiple invoices — ambiguous, skipping.");
    } else if (inv === "none") {
      log.push("✗ No open invoice with that id.");
    } else {
      const customer = customers.find((c) => c.id === inv.customerId);
      log.push(`✓ Unique invoice match → ${inv.invoiceId} (${customer?.name ?? "unknown"}).`);
      return {
        status: "recon_received",
        matchType: "invoice",
        customerId: inv.customerId,
        invoiceId: inv.invoiceId,
        log,
      };
    }
  } else {
    log.push("No invoice id on the payment — skipping invoice match.");
  }

  // --- 2. UPI id (unique id → identify payer) ---
  if (payment.payerUpiId && norm(payment.payerUpiId)) {
    log.push(`Checking UPI id "${payment.payerUpiId}" against customers…`);
    const byUpi = uniqueBy(customers, (c) => norm(c.upiId) === norm(payment.payerUpiId));
    if (byUpi === "ambiguous") {
      log.push("✗ UPI id maps to multiple customers — ambiguous, skipping.");
    } else if (byUpi === "none") {
      log.push("✗ No customer with that UPI id.");
    } else {
      log.push(`✓ Unique UPI match → ${byUpi.name}.`);
      return { status: "payment_received", matchType: "upi", customerId: byUpi.id, log };
    }
  } else {
    log.push("No UPI id on the payment — skipping UPI match.");
  }

  // --- 3. Name (unique id → identify payer) ---
  if (payment.payerName && norm(payment.payerName)) {
    log.push(`Checking name "${payment.payerName}" against customers…`);
    const byName = uniqueBy(customers, (c) => norm(c.name) === norm(payment.payerName));
    if (byName === "ambiguous") {
      log.push("✗ Name maps to multiple customers — ambiguous, skipping.");
    } else if (byName === "none") {
      log.push("✗ No exact name match.");
    } else {
      log.push(`✓ Unique name match → ${byName.name}.`);
      return { status: "payment_received", matchType: "name", customerId: byName.id, log };
    }
  } else {
    log.push("No payer name on the payment — skipping name match.");
  }

  log.push("→ No deterministic match. Handing off to Sarvam for a suggestion.");
  return { status: "no_match", matchType: "none", log };
}
