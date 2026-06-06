import { updateReconEntry, removeReconEntry } from "@/lib/billing";

// PATCH /api/recon/entries/:id — approve/decline or correct an entry.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: { status?: "PENDING" | "APPROVED" | "DECLINED"; payerName?: string | null; amount?: number } = {};
  if (body.status === "APPROVED" || body.status === "DECLINED" || body.status === "PENDING") {
    patch.status = body.status;
  }
  if (typeof body.payerName === "string") patch.payerName = body.payerName.trim() || null;
  if (body.amount != null) {
    const amt = Number(body.amount);
    if (!amt || amt <= 0) return Response.json({ error: "Invalid amount" }, { status: 400 });
    patch.amount = amt;
  }

  const entry = updateReconEntry(id, patch);
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ entry });
}

// DELETE /api/recon/entries/:id — drop an entry (e.g. an OCR phantom row).
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return removeReconEntry(id)
    ? Response.json({ ok: true })
    : Response.json({ error: "Not found" }, { status: 404 });
}
