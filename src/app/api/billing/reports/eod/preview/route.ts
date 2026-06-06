import { getBilling } from "@/lib/billing";
import { buildReport, rangeFor, reportToHtml } from "@/lib/billingReport";

// GET /api/billing/reports/eod/preview — build the exact EOD single-page report
// as HTML for on-screen preview. Does NOT send email.
export async function GET() {
  const store = getBilling();
  const { from, to, label } = rangeFor("day");
  const report = buildReport(from, to, label);
  const html = reportToHtml(report, store.storeName);
  return Response.json({ html, report });
}
