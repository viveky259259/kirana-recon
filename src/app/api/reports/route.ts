import { NextResponse } from "next/server";
import { buildReport, rangeFor, type RangeKind } from "@/lib/report";

// GET /api/reports?range=day|week — on-demand reconciliation summary.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get("range") as RangeKind) || "day";
  const { from, to, label } = rangeFor(kind === "week" ? "week" : "day");
  const report = await buildReport(from, to, label);
  return NextResponse.json({ report });
}
