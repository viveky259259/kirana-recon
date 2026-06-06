import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/store";
import { generateReconId, buildUpiDeeplink } from "@/lib/upi";

// GET /api/invoices — list invoices (newest first) with payment summary.
export async function GET() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { payments: true },
  });
  return NextResponse.json({ invoices });
}

// POST /api/invoices — create an invoice, mint a reconId, return deeplink + QR.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  const store = await getStore();
  const reconId = generateReconId();

  const invoice = await prisma.invoice.create({
    data: {
      reconId,
      amount,
      customerName: body.customerName?.trim() || null,
      note: body.note?.trim() || null,
      isCredit: Boolean(body.isCredit),
      status: body.isCredit ? "PENDING" : "PENDING",
      storeId: store.id,
    },
  });

  const deeplink = buildUpiDeeplink({
    vpa: store.upiVpa,
    payeeName: store.name,
    amount,
    reconId,
  });
  const qrDataUrl = await QRCode.toDataURL(deeplink, { width: 320, margin: 1 });

  return NextResponse.json({ invoice, deeplink, qrDataUrl }, { status: 201 });
}
