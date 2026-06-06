// In-memory store for the invoicing + reconciliation-by-invoice features
// (separate from the khata recon store in store.ts). Mirrors the project's
// existing in-memory + globalThis pattern so data survives dev hot-reloads but
// resets on a full restart — consistent with the rest of this demo.

export type BillingInvoice = {
  id: string;
  reconId: string; // embedded in UPI deeplink + QR; the auto-match key
  amount: number;
  customerName: string | null;
  note: string | null;
  isCredit: boolean;
  status: "PENDING" | "PARTIAL" | "PAID";
  createdAt: string;
};

export type BillingPayment = {
  id: string;
  externalId: string; // UTR/RRN — dedupe key
  txnRef: string | null;
  amount: number;
  paidAt: string;
  payerVpa: string | null;
  sourceApp: "PAYTM" | "GPAY" | "PHONEPE" | "OTHER";
  matchStatus: "MATCHED" | "MISMATCH" | "UNMATCHED";
  invoiceId: string | null;
};

// An offline payment the merchant logs by voice or photo and then reviews.
export type ReconEntry = {
  id: string;
  payerName: string | null;
  amount: number;
  source: "VOICE" | "OCR" | "MANUAL";
  status: "PENDING" | "APPROVED" | "DECLINED";
  rawText: string | null;
  batchId: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type BillingStore = {
  storeName: string;
  upiVpa: string;
  ownerEmail: string;
  invoices: BillingInvoice[];
  payments: BillingPayment[];
  reconEntries: ReconEntry[];
  seq: number;
};

function seed(): BillingStore {
  const createdAt = "2026-06-06T04:00:00.000Z";
  const demo: Array<Partial<BillingInvoice> & { reconId: string; amount: number }> = [
    { reconId: "KR-DEMO0001", amount: 450, customerName: "Ramesh" },
    { reconId: "KR-DEMO0002", amount: 1200, customerName: "Sunita" },
    { reconId: "KR-DEMO0003", amount: 85, customerName: "Walk-in" },
    { reconId: "KR-DEMO0004", amount: 640, customerName: "Imran" },
    { reconId: "KR-DEMO0005", amount: 300, customerName: "Lakshmi", isCredit: true },
  ];
  return {
    storeName: process.env.STORE_NAME ?? "Sharma Kirana Store",
    upiVpa: process.env.STORE_UPI_VPA ?? "sharmakirana@paytm",
    ownerEmail: process.env.STORE_OWNER_EMAIL ?? "viveky259259@gmail.com",
    invoices: demo.map((d, i) => ({
      id: `inv-seed-${i + 1}`,
      reconId: d.reconId,
      amount: d.amount,
      customerName: d.customerName ?? null,
      note: d.note ?? null,
      isCredit: d.isCredit ?? false,
      status: "PENDING",
      createdAt,
    })),
    payments: [],
    reconEntries: [],
    seq: 1,
  };
}

const g = globalThis as unknown as { __billingStore?: BillingStore };

export function getBilling(): BillingStore {
  if (!g.__billingStore) g.__billingStore = seed();
  return g.__billingStore;
}

export function resetBilling(): BillingStore {
  g.__billingStore = seed();
  return g.__billingStore;
}

export function nextBillingId(prefix: string): string {
  const s = getBilling();
  return `${prefix}-${s.seq++}`;
}

// ---- matching ----

export function amountsEqual(a: number, b: number) {
  return Math.abs(a - b) < 0.01;
}

export function extractReconId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/KR-[A-Z0-9]{6,}/);
  return m ? m[0] : null;
}

// Resolve a payment's match outcome against current billing invoices.
export function resolveMatch(
  txnRef: string | null,
  amount: number
): { matchStatus: BillingPayment["matchStatus"]; invoiceId: string | null } {
  const reconId = extractReconId(txnRef);
  if (!reconId) return { matchStatus: "UNMATCHED", invoiceId: null };
  const inv = getBilling().invoices.find((i) => i.reconId === reconId);
  if (!inv) return { matchStatus: "UNMATCHED", invoiceId: null };
  return amountsEqual(inv.amount, amount)
    ? { matchStatus: "MATCHED", invoiceId: inv.id }
    : { matchStatus: "MISMATCH", invoiceId: inv.id };
}

export function recomputeInvoiceStatus(invoiceId: string) {
  const store = getBilling();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return;
  const paid = store.payments.filter((p) => p.invoiceId === invoiceId).reduce((s, p) => s + p.amount, 0);
  inv.status = paid <= 0 ? "PENDING" : paid >= inv.amount - 0.01 ? "PAID" : "PARTIAL";
}

// ---- offline collection entries (voice / photo) ----

export function addReconEntries(
  rows: { name: string | null; amount: number; raw?: string }[],
  source: ReconEntry["source"],
  batchId: string | null
): ReconEntry[] {
  const store = getBilling();
  const created = rows.map((r) => ({
    id: nextBillingId("rec"),
    payerName: r.name,
    amount: r.amount,
    source,
    status: "PENDING" as const,
    rawText: r.raw ?? null,
    batchId,
    createdAt: new Date().toISOString(),
    decidedAt: null as string | null,
  }));
  store.reconEntries.push(...created);
  return created;
}

export function listReconEntries(status?: string): ReconEntry[] {
  const list = getBilling().reconEntries;
  return [...list]
    .filter((e) => (status ? e.status === status : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateReconEntry(
  id: string,
  patch: { status?: ReconEntry["status"]; payerName?: string | null; amount?: number }
): ReconEntry | null {
  const e = getBilling().reconEntries.find((x) => x.id === id);
  if (!e) return null;
  if (patch.status) {
    e.status = patch.status;
    e.decidedAt = patch.status === "PENDING" ? null : new Date().toISOString();
  }
  if (patch.payerName !== undefined) e.payerName = patch.payerName;
  if (patch.amount !== undefined) e.amount = patch.amount;
  return e;
}

export function removeReconEntry(id: string): boolean {
  const store = getBilling();
  const i = store.reconEntries.findIndex((x) => x.id === id);
  if (i < 0) return false;
  store.reconEntries.splice(i, 1);
  return true;
}

// Manually link a payment to an invoice (owner override).
export function linkPaymentToInvoice(paymentId: string, invoiceId: string) {
  const store = getBilling();
  const payment = store.payments.find((p) => p.id === paymentId);
  const invoice = store.invoices.find((i) => i.id === invoiceId);
  if (!payment || !invoice) throw new Error("Payment or invoice not found");
  const prev = payment.invoiceId;
  payment.invoiceId = invoiceId;
  payment.matchStatus = amountsEqual(invoice.amount, payment.amount) ? "MATCHED" : "MISMATCH";
  recomputeInvoiceStatus(invoiceId);
  if (prev && prev !== invoiceId) recomputeInvoiceStatus(prev);
  return payment;
}
