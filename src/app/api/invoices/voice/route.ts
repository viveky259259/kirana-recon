import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/store";
import { generateReconId, buildUpiDeeplink } from "@/lib/upi";
import { transcribeAudio } from "@/lib/sarvam";
import { parseInvoiceSpeech } from "@/lib/parseInvoiceSpeech";

// POST /api/invoices/voice — multipart/form-data with an `audio` file.
// Transcribes via Sarvam, parses an invoice out of the speech, and (if an
// amount was understood) creates the invoice + QR. Always returns the
// transcript + parsed fields so the UI can confirm or let the owner edit.
export async function POST(req: Request) {
  let audio: File | null = null;
  try {
    const form = await req.formData();
    audio = form.get("audio") as File | null;
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  if (!audio) return NextResponse.json({ error: "Missing audio" }, { status: 400 });

  let transcript = "";
  try {
    const result = await transcribeAudio(audio, "voice.wav");
    transcript = result.transcript;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const parsed = parseInvoiceSpeech(transcript);

  // Without an amount we can't safely create an invoice — bounce the parse back
  // so the owner can fill it in manually.
  if (!parsed.amount || parsed.amount <= 0) {
    return NextResponse.json({ transcript, parsed, invoice: null }, { status: 200 });
  }

  const store = await getStore();
  const reconId = generateReconId();
  const invoice = await prisma.invoice.create({
    data: {
      reconId,
      amount: parsed.amount,
      customerName: parsed.customerName,
      note: parsed.note,
      isCredit: parsed.isCredit,
      storeId: store.id,
    },
  });

  const deeplink = buildUpiDeeplink({
    vpa: store.upiVpa,
    payeeName: store.name,
    amount: parsed.amount,
    reconId,
  });
  const qrDataUrl = await QRCode.toDataURL(deeplink, { width: 320, margin: 1 });

  return NextResponse.json({ transcript, parsed, invoice, deeplink, qrDataUrl }, { status: 201 });
}
