import { getBilling } from "@/lib/billing";
import { buildReport, rangeFor, reportToHtml } from "@/lib/billingReport";
import { sendReportEmail } from "@/lib/email";

// POST /api/billing/reports/eod — generate today's report, email the owner.
export async function POST() {
  const store = getBilling();
  const { from, to, label } = rangeFor("day");
  const report = buildReport(from, to, label);
  const html = reportToHtml(report, store.storeName);
  const subject = `Kirana Recon — EOD Report (${new Date().toLocaleDateString("en-IN")})`;
  const result = await sendReportEmail(store.ownerEmail, subject, html);
  return Response.json({ report, emailed: result.sent });
}
