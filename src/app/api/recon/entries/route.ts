import { addReconEntries, listReconEntries } from "@/lib/billing";

// GET /api/recon/entries?status=PENDING — list recon entries, newest first.
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  return Response.json({ entries: listReconEntries(status) });
}

// POST /api/recon/entries — create a manual entry (typed fallback).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!amount || amount <= 0) return Response.json({ error: "Amount must be greater than 0" }, { status: 400 });
  const name = typeof body.payerName === "string" ? body.payerName.trim() || null : null;
  const [entry] = addReconEntries([{ name, amount }], "MANUAL", null);
  return Response.json({ entry }, { status: 201 });
}
