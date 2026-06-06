import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/store";
import { buildReport, rangeFor, reportToHtml } from "@/lib/report";
import { sendReportEmail } from "@/lib/email";

// POST /api/reports/eod — generate today's report, email it to the store owner,
// and record a ReportRun. Triggered by the 11:59 PM cron (or manually for test).
export async function POST() {
  const store = await getStore();
  const { from, to, label } = rangeFor("day");
  const report = await buildReport(from, to, label);
  const html = reportToHtml(report, store.name);
  const subject = `Kirana Recon — EOD Report (${new Date().toLocaleDateString("en-IN")})`;

  const result = await sendReportEmail(store.ownerEmail, subject, html);

  const run = await prisma.reportRun.create({
    data: {
      totalsJson: JSON.stringify(report),
      emailedTo: result.sent ? store.ownerEmail : null,
      sentAt: result.sent ? new Date() : null,
    },
  });

  return NextResponse.json({ report, emailed: result.sent, runId: run.id });
}
