import nodemailer from "nodemailer";

// Send the EOD report email. If SMTP isn't configured, fall back to logging the
// HTML to the console so the flow is still testable in dev.
export async function sendReportEmail(to: string, subject: string, html: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log("[email] SMTP not configured — skipping real send.");
    console.log(`[email] would send to ${to}: ${subject}`);
    return { sent: false, reason: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to,
    subject,
    html,
  });
  return { sent: true };
}
