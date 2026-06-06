import { randomUUID } from "node:crypto";
import { jpegToPdf } from "@/lib/imageToPdf";
import { extractTextFromPdf, DEFAULT_OCR_LANGUAGE } from "@/lib/sarvamVision";
import { parseLedger } from "@/lib/parseLedger";
import { addReconEntries } from "@/lib/billing";

// Sarvam document-intelligence is an async job; allow up to ~60s.
export const maxDuration = 60;

// POST /api/recon/photo — multipart with an `image` (baseline JPEG) or `pdf`.
// The merchant photographs a paper note of names + amounts; Sarvam Vision OCRs
// it, we split it into rows, and create one PENDING entry per row (grouped by
// batchId) for review.
export async function POST(req: Request) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    file = (form.get("image") ?? form.get("pdf") ?? form.get("file")) as File | null;
  } catch {
    return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  if (!file) return Response.json({ error: "Missing image" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = file.type === "application/pdf" || bytes.subarray(0, 4).toString("latin1") === "%PDF";

  let rawText = "";
  try {
    const pdf = isPdf ? bytes : jpegToPdf(bytes);
    rawText = await extractTextFromPdf(pdf, DEFAULT_OCR_LANGUAGE);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }

  const parsed = parseLedger(rawText);
  if (parsed.length === 0) return Response.json({ rawText, entries: [] }, { status: 200 });

  const batchId = randomUUID();
  const entries = addReconEntries(parsed, "OCR", batchId);
  return Response.json({ rawText, batchId, entries }, { status: 201 });
}
