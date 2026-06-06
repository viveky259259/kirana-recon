// Backend orchestration for the recon journey.
//
// processPayment() is what the payment-ingest API calls: run the deterministic
// engine, update the recon ledger on a confident match, or fall back to a
// Sarvam suggestion. confirmSuggestion()/dismissSuggestion() handle the store
// owner's follow-up decision on a probabilistic suggestion.

import { runDeterministicEngine } from "./deterministic-engine";
import { suggestWithSarvam } from "./sarvam";
import { findCustomer, getStore, nextId } from "./store";
import type { DashboardState, IncomingPayment, Payment } from "./types";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Reduce a customer's pending balance (never below zero); returns amount applied. */
function applyRecon(customerId: string, amount: number): number {
  const customer = findCustomer(customerId);
  if (!customer) return 0;
  const applied = Math.min(amount, customer.reconPendingAmount);
  customer.reconPendingAmount -= applied;
  return applied;
}

export async function processPayment(incoming: IncomingPayment): Promise<Payment> {
  const store = getStore();
  const decision = runDeterministicEngine(incoming, store.customers, store.invoices);

  const payment: Payment = {
    ...incoming,
    id: nextId("pay"),
    receivedAt: new Date().toISOString(),
    status: "unmatched",
    matchType: decision.matchType,
    message: "",
    engineLog: decision.log,
  };

  if (decision.status === "recon_received" && decision.customerId) {
    // Invoice id matched uniquely → settle the invoice and reduce pending.
    const customer = findCustomer(decision.customerId)!;
    const applied = applyRecon(customer.id, incoming.amount);
    const invoice = store.invoices.find((i) => i.invoiceId === decision.invoiceId);
    if (invoice) invoice.status = "paid";

    payment.status = "recon_received";
    payment.matchedCustomerId = customer.id;
    payment.matchedCustomerName = customer.name;
    payment.appliedReconAmount = applied;
    payment.message =
      `Recon received from ${customer.name} against ${decision.invoiceId}. ` +
      `Pending updated to ${rupees(customer.reconPendingAmount)}.`;
  } else if (decision.status === "payment_received" && decision.customerId) {
    // Unique UPI / name match → attribute the payment to the customer.
    const customer = findCustomer(decision.customerId)!;
    const applied = applyRecon(customer.id, incoming.amount);
    payment.status = "payment_received";
    payment.matchedCustomerId = customer.id;
    payment.matchedCustomerName = customer.name;
    payment.appliedReconAmount = applied;
    const via = decision.matchType === "upi" ? "UPI id" : "name";
    payment.message =
      `Payment of ${rupees(incoming.amount)} received from ${customer.name} (matched on ${via}). ` +
      `Pending now ${rupees(customer.reconPendingAmount)}.`;
  } else {
    // Deterministic engine found nothing → ask Sarvam.
    const suggestion = await suggestWithSarvam(incoming, store.customers, store.invoices);
    if (suggestion) {
      payment.status = "suggested";
      payment.matchType = "sarvam";
      payment.suggestion = suggestion;
      payment.engineLog.push(
        `Sarvam suggests ${suggestion.suggestedCustomerName} ` +
          `(${Math.round(suggestion.confidence * 100)}% confidence).`,
      );
      payment.message =
        `Recon might be received from ${suggestion.suggestedCustomerName}. ` +
        `Please confirm.`;
    } else {
      payment.status = "unmatched";
      payment.engineLog.push("Sarvam had no confident suggestion.");
      payment.message =
        `Couldn't identify the payer for ${rupees(incoming.amount)}. Needs manual review.`;
    }
  }

  store.payments.unshift(payment);
  return payment;
}

export function confirmSuggestion(paymentId: string): Payment | null {
  const store = getStore();
  const payment = store.payments.find((p) => p.id === paymentId);
  if (!payment || payment.status !== "suggested" || !payment.suggestion) return null;

  const customer = findCustomer(payment.suggestion.suggestedCustomerId);
  if (!customer) return null;

  const applied = applyRecon(customer.id, payment.amount);
  payment.status = "confirmed";
  payment.matchType = "sarvam";
  payment.matchedCustomerId = customer.id;
  payment.matchedCustomerName = customer.name;
  payment.appliedReconAmount = applied;
  payment.message =
    `Confirmed recon from ${customer.name}. Pending updated to ${rupees(customer.reconPendingAmount)}.`;
  payment.engineLog.push(`Store owner confirmed Sarvam's suggestion of ${customer.name}.`);

  store.feedback.unshift({
    id: nextId("fb"),
    paymentId: payment.id,
    at: new Date().toISOString(),
    kind: "confirmed",
    suggestedCustomerId: customer.id,
  });
  return payment;
}

export function dismissSuggestion(paymentId: string, note: string): Payment | null {
  const store = getStore();
  const payment = store.payments.find((p) => p.id === paymentId);
  if (!payment || payment.status !== "suggested") return null;

  payment.status = "unmatched";
  payment.feedback = note;
  payment.message = `Suggestion dismissed. Sent for manual review. Feedback recorded for the model.`;
  payment.engineLog.push(`Store owner dismissed the suggestion. Note: "${note || "(none)"}".`);

  store.feedback.unshift({
    id: nextId("fb"),
    paymentId: payment.id,
    at: new Date().toISOString(),
    kind: "dismissed",
    suggestedCustomerId: payment.suggestion?.suggestedCustomerId,
    note,
  });
  return payment;
}

export function getDashboardState(): DashboardState {
  const store = getStore();
  return {
    storeName: store.storeName,
    customers: store.customers,
    payments: store.payments,
    feedback: store.feedback,
    totals: {
      totalReconPending: store.customers.reduce((sum, c) => sum + c.reconPendingAmount, 0),
      reconReceivedCount: store.payments.filter(
        (p) => p.status === "recon_received" || p.status === "confirmed" || p.status === "payment_received",
      ).length,
      awaitingReviewCount: store.payments.filter(
        (p) => p.status === "suggested" || p.status === "unmatched",
      ).length,
    },
  };
}
