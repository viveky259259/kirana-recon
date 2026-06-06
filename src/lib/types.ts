// Domain model for the Kirana reconciliation ("recon") journey.
//
// A Kirana store extends informal credit ("khata") to regulars. Each customer
// owes a running balance (`reconPendingAmount`). Customers pay "somewhere else"
// (any UPI app), and the store's backend receives that payment event over an
// API. The backend then has to figure out *which* customer paid — that is the
// reconciliation problem this journey models.

export type Customer = {
  id: string;
  name: string;
  /** Customer's UPI handle, e.g. ramesh@oksbi. Treated as a unique id. */
  upiId: string;
  /** Outstanding credit the customer owes the store, in rupees. */
  reconPendingAmount: number;
};

export type Invoice = {
  invoiceId: string;
  customerId: string;
  amount: number;
  status: "pending" | "paid";
  createdAt: string;
};

/** Which signal the engine used to attribute the payment to a customer. */
export type MatchType = "invoice" | "upi" | "name" | "sarvam" | "none";

export type PaymentStatus =
  /** Invoice id matched uniquely → recon settled, pending reduced. */
  | "recon_received"
  /** A unique id (UPI or name) matched → payment attributed to the customer. */
  | "payment_received"
  /** Deterministic engine found nothing; Sarvam proposed a likely payer. */
  | "suggested"
  /** Store owner confirmed the Sarvam suggestion. */
  | "confirmed"
  /** Suggestion dismissed, or nothing matched at all. Needs manual review. */
  | "unmatched";

/** A probabilistic suggestion produced by the (simulated) Sarvam AI layer. */
export type Suggestion = {
  suggestedCustomerId: string;
  suggestedCustomerName: string;
  /** 0..1 model confidence. */
  confidence: number;
  /** Human-readable rationale shown to the store owner. */
  reason: string;
  /** The individual signals that fed the score. */
  signals: string[];
};

/** The raw payment event as it arrives from "somewhere else". */
export type IncomingPayment = {
  payerName: string;
  payerUpiId: string;
  invoiceId?: string;
  amount: number;
};

export type Payment = IncomingPayment & {
  id: string;
  receivedAt: string;

  // ----- engine output -----
  status: PaymentStatus;
  matchType: MatchType;
  matchedCustomerId?: string;
  matchedCustomerName?: string;
  /** Headline message shown on the store's screen. */
  message: string;
  /** Present only while status === "suggested" (or after, for reference). */
  suggestion?: Suggestion;
  /** How much pending balance this payment settled, in rupees. */
  appliedReconAmount?: number;
  /** Owner's note when a suggestion is dismissed. */
  feedback?: string;
  /** Step-by-step trace of the deterministic engine, for transparency. */
  engineLog: string[];
};

/** Captured for the "future AI model" — every confirm/dismiss is training signal. */
export type FeedbackEvent = {
  id: string;
  paymentId: string;
  at: string;
  kind: "confirmed" | "dismissed";
  suggestedCustomerId?: string;
  note?: string;
};

export type DashboardState = {
  storeName: string;
  customers: Customer[];
  payments: Payment[];
  feedback: FeedbackEvent[];
  totals: {
    totalReconPending: number;
    reconReceivedCount: number;
    awaitingReviewCount: number;
  };
};
