import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/payments?status=MATCHED|MISMATCH|UNMATCHED — list payments.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const payments = await prisma.payment.findMany({
    where: status ? { matchStatus: status as never } : undefined,
    orderBy: { paidAt: "desc" },
    include: { invoice: true },
  });
  return NextResponse.json({ payments });
}
