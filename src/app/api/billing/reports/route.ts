import { buildReport, rangeFor, type RangeKind } from "@/lib/billingReport";

// GET /api/billing/reports?range=day|week — on-demand reconciliation summary.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get("range") as RangeKind) === "week" ? "week" : "day";
  const { from, to, label } = rangeFor(kind);
  return Response.json({ report: buildReport(from, to, label) });
}
