import { randomUUID } from "node:crypto";
import { transcribeAudio } from "@/lib/sarvamStt";
import { parseLedger } from "@/lib/parseLedger";
import { addReconEntries } from "@/lib/billing";

// POST /api/recon/voice — multipart `audio`. The merchant speaks an offline
// payment ("Vivek gave me 500"); Sarvam transcribes it, we pull out
// who-paid-how-much, and create PENDING entries for the merchant to review.
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

  const parsed = parseLedger(transcript);
  if (parsed.length === 0) return Response.json({ transcript, entries: [] }, { status: 200 });

  const batchId = randomUUID();
  const entries = addReconEntries(parsed, "VOICE", batchId);
  return Response.json({ transcript, batchId, entries }, { status: 201 });
}
