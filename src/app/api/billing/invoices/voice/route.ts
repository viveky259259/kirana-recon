import QRCode from "qrcode";
import { getBilling, nextBillingId } from "@/lib/billing";
import { generateReconId, buildUpiDeeplink } from "@/lib/upi";
import { transcribeAudio } from "@/lib/sarvamStt";
import { parseInvoiceSpeech } from "@/lib/parseInvoiceSpeech";

// POST /api/billing/invoices/voice — multipart `audio`. Transcribe via Sarvam,
// parse an invoice from the speech, and (if an amount was understood) create it.
export async function POST(req: Request) {
  let audio: File | null = null;
  try {
    const form = await req.formData();
    audio = form.get("audio") as File | null;
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  if (!audio) return Response.json({ error: "Missing audio" }, { status: 400 });

  let transcript = "";
  try {
    transcript = (await transcribeAudio(audio, "voice.wav")).transcript;
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }

  const parsed = parseInvoiceSpeech(transcript);
  if (!parsed.amount || parsed.amount <= 0) {
    return Response.json({ transcript, parsed, invoice: null }, { status: 200 });
  }

  const store = getBilling();
  const reconId = generateReconId();
  const invoice = {
    id: nextBillingId("inv"),
    reconId,
    amount: parsed.amount,
    customerName: parsed.customerName,
    note: parsed.note,
    isCredit: parsed.isCredit,
    status: "PENDING" as const,
    createdAt: new Date().toISOString(),
  };
  store.invoices.push(invoice);

  const deeplink = buildUpiDeeplink({ vpa: store.upiVpa, payeeName: store.storeName, amount: parsed.amount, reconId });
  const qrDataUrl = await QRCode.toDataURL(deeplink, { width: 320, margin: 1 });
  return Response.json({ transcript, parsed, invoice, deeplink, qrDataUrl }, { status: 201 });
}
