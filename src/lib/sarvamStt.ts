// Sarvam AI speech-to-text client.
// Docs: https://www.sarvam.ai/apis/speech-to-text
// Endpoint: POST https://api.sarvam.ai/speech-to-text (multipart/form-data)
//   fields: file (audio), model, language_code
//   header: api-subscription-key

const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";

export async function transcribeAudio(
  audio: Blob,
  filename = "audio.wav"
): Promise<{ transcript: string; languageCode?: string }> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY not configured");

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "saarika:v2.5");
  // "unknown" lets Sarvam auto-detect language (handles English + Hindi etc).
  form.append("language_code", "unknown");

  const res = await fetch(SARVAM_STT_URL, {
    method: "POST",
    headers: { "api-subscription-key": key },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sarvam STT failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as { transcript?: string; language_code?: string };
  return { transcript: data.transcript ?? "", languageCode: data.language_code };
}
