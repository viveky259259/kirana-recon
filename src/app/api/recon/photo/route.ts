import { randomUUID } from "node:crypto";
import { extractText, DEFAULT_OCR_LANGUAGE } from "@/lib/sarvamVision";
import { parseLedger } from "@/lib/parseLedger";
import { addReconEntries } from "@/lib/billing";

// Sarvam document-intelligence is an async job; allow up to ~60s.
export const maxDuration = 60;

// POST /api/recon/photo — multipart with an `image` (JPG/PNG) or `pdf`.
// The merchant photographs a paper note of names + amounts; Sarvam Vision reads
// it, we split it into rows, and create one PENDING entry per row (grouped by
// batchId) for review. The file is uploaded to Sarvam as-is (full resolution,
// no conversion) — the API accepts JPG/PNG/PDF directly.
function fileName(file: File, bytes: Buffer): string {
  if (file.type === "application/pdf" || bytes.subarray(0, 4).toString("latin1") === "%PDF") return "note.pdf";
  if (file.type === "image/png" || bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "note.png";
  return "note.jpg";
}

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

  let rawText = "";
  try {
    rawText = await extractText(bytes, fileName(file, bytes), DEFAULT_OCR_LANGUAGE);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }

  const parsed = parseLedger(rawText);
  if (parsed.length === 0) return Response.json({ rawText, entries: [] }, { status: 200 });

  const batchId = randomUUID();
  const entries = addReconEntries(parsed, "OCR", batchId);
  return Response.json({ rawText, batchId, entries }, { status: 201 });
}
