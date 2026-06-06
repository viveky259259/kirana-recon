// UPI deeplink + reconId helpers.
//
// The reconId is the linchpin of reconciliation: it is embedded in the UPI
// deeplink (`tr` = transaction reference, `tn` = transaction note) and the
// dynamic QR. When the customer pays through that link/QR, the reconId is
// carried into the settlement CSV, which lets us auto-match the payment back to
// this exact invoice.

export type UpiParams = {
  vpa: string; // payee address (store VPA)
  payeeName: string;
  amount: number;
  reconId: string;
};

// Short, human-shareable, collision-resistant recon id, e.g. KR-7F3K9Q2A.
export function generateReconId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `KR-${s}`;
}

// Build the canonical UPI deeplink. Most UPI apps (Paytm/GPay/PhonePe) honor
// this `upi://pay` intent; the reconId rides in both `tr` and `tn` so it
// survives whichever field a given PSP echoes into its settlement export.
export function buildUpiDeeplink({ vpa, payeeName, amount, reconId }: UpiParams): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tr: reconId,
    tn: `Invoice ${reconId}`,
  });
  return `upi://pay?${params.toString()}`;
}
