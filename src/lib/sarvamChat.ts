// Sarvam Chat Completions (conversational AI) client.
// Docs: https://docs.sarvam.ai  ·  OpenAI-compatible /v1/chat/completions
// Model: sarvam-30b (sarvam-m is deprecated).

const URL = "https://api.sarvam.ai/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY not configured");

  const body = {
    model: opts.model ?? "sarvam-30b",
    messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 600,
  };

  const res = await fetch(URL, {
    method: "POST",
    headers: { "api-subscription-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sarvam chat failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}
