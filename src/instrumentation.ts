// Next.js runs register() once when the server process boots. We use it to
// schedule the in-process EOD cron at 11:59 PM (Asia/Kolkata). Enable by setting
// ENABLE_EOD_CRON=true. In serverless/edge deploys (e.g. Vercel) prefer a
// platform cron hitting POST /api/reports/eod instead of this in-process job.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_EOD_CRON !== "true") return;

  // Guard against double-registration across hot reloads.
  const g = globalThis as unknown as { __eodCronStarted?: boolean };
  if (g.__eodCronStarted) return;
  g.__eodCronStarted = true;

  const cron = (await import("node-cron")).default;

  // 23:59 every day, India time.
  cron.schedule(
    "59 23 * * *",
    async () => {
      try {
        const { prisma } = await import("@/lib/prisma");
        const { getStore } = await import("@/lib/store");
        const { buildReport, rangeFor, reportToHtml } = await import("@/lib/report");
        const { sendReportEmail } = await import("@/lib/email");

        const store = await getStore();
        const { from, to, label } = rangeFor("day");
        const report = await buildReport(from, to, label);
        const html = reportToHtml(report, store.name);
        const subject = `Kirana Recon — EOD Report (${new Date().toLocaleDateString("en-IN")})`;
        const result = await sendReportEmail(store.ownerEmail, subject, html);
        await prisma.reportRun.create({
          data: {
            totalsJson: JSON.stringify(report),
            emailedTo: result.sent ? store.ownerEmail : null,
            sentAt: result.sent ? new Date() : null,
          },
        });
        console.log(`[eod-cron] report generated, emailed=${result.sent}`);
      } catch (err) {
        console.error("[eod-cron] failed:", err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  console.log("[eod-cron] scheduled for 23:59 Asia/Kolkata");
}
