import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

// Amount equality with a small tolerance for float/rounding noise.
export function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

// Try to recover a reconId from a CSV reference / note string. PSPs sometimes
// wrap or pad the reference, so we scan for our KR-XXXXXXXX token.
export function extractReconId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/KR-[A-Z0-9]{6,}/);
  return m ? m[0] : null;
}

export type MatchOutcome = {
  matchStatus: "MATCHED" | "MISMATCH" | "UNMATCHED";
  invoiceId: string | null;
};

// Resolve a single payment's match outcome against current invoices.
// Rule: reconId resolves to a known invoice AND amounts agree -> MATCHED.
// reconId resolves but amount differs -> MISMATCH (suspicious: over/underpay).
// otherwise -> UNMATCHED (needs manual linking).
export async function resolveMatch(
  txnRef: string | null,
  amount: number,
  tx?: Prisma.TransactionClient
): Promise<MatchOutcome> {
  const db = tx ?? prisma;
  const reconId = extractReconId(txnRef);
  if (!reconId) return { matchStatus: "UNMATCHED", invoiceId: null };

  const invoice = await db.invoice.findUnique({ where: { reconId } });
  if (!invoice) return { matchStatus: "UNMATCHED", invoiceId: null };

  if (amountsEqual(invoice.amount, amount)) {
    return { matchStatus: "MATCHED", invoiceId: invoice.id };
  }
  return { matchStatus: "MISMATCH", invoiceId: invoice.id };
}

// Recompute an invoice's status from the payments currently linked to it.
export async function recomputeInvoiceStatus(
  invoiceId: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const db = tx ?? prisma;
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return;

  const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  let status: "PENDING" | "PAID" | "PARTIAL" = "PENDING";
  if (paid <= 0) status = "PENDING";
  else if (amountsEqual(paid, invoice.amount) || paid > invoice.amount) status = "PAID";
  else status = "PARTIAL";

  await db.invoice.update({ where: { id: invoiceId }, data: { status } });
}

// Manually link a payment to an invoice (store owner override). Records an audit
// Link row, attaches the payment, and recomputes statuses.
export async function linkPaymentToInvoice(paymentId: string, invoiceId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!payment || !invoice) throw new Error("Payment or invoice not found");

    const previousInvoiceId = payment.invoiceId;
    const matchStatus = amountsEqual(invoice.amount, payment.amount)
      ? "MATCHED"
      : "MISMATCH";

    await tx.payment.update({
      where: { id: paymentId },
      data: { invoiceId, matchStatus },
    });

    await tx.link.upsert({
      where: { paymentId_invoiceId: { paymentId, invoiceId } },
      create: { paymentId, invoiceId, linkedManually: true },
      update: { linkedManually: true },
    });

    await recomputeInvoiceStatus(invoiceId, tx);
    if (previousInvoiceId && previousInvoiceId !== invoiceId) {
      await recomputeInvoiceStatus(previousInvoiceId, tx);
    }
    return tx.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
  });
}
