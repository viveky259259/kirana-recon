// Parse a spoken invoice description into structured fields.
// Example: "Vivek has borrowed 5000 worth of rice, wheat etc"
//   -> { customerName: "Vivek", amount: 5000, note: "rice, wheat",
//        isCredit: true }
//
// Heuristic / regex based — good enough for the common Kirana phrasings in
// English + romanized Hindi. Returns nulls when it can't infer a field.

export type ParsedInvoice = {
  amount: number | null;
  customerName: string | null;
  note: string | null;
  isCredit: boolean;
  transcript: string;
};

// Words that signal a credit / udhaar sale (goods given, payment later).
const CREDIT_WORDS = [
  "borrow",
  "borrowed",
  "udhaar",
  "udhar",
  "credit",
  "lent",
  "owe",
  "owes",
  "due",
  "khata",
  "baaki",
  "baki",
];

// Map common spoken number words / Indian units to digits.
const WORD_NUMBERS: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  lakh: 100000,
  lakhs: 100000,
  crore: 10000000,
};

function parseAmount(text: string): number | null {
  const t = text.toLowerCase().replace(/,/g, "");

  // "5 thousand", "2 lakh", "1.5 lakh"
  const unit = t.match(/(\d+(?:\.\d+)?)\s*(thousand|lakhs?|crore|hundred)/);
  if (unit) {
    return Math.round(parseFloat(unit[1]) * WORD_NUMBERS[unit[2]]);
  }

  // Prefer a number adjacent to a currency cue (rupees / rs / ₹ / worth).
  const cued =
    t.match(/(?:₹|rs\.?|rupees?)\s*(\d+(?:\.\d+)?)/) ||
    t.match(/(\d+(?:\.\d+)?)\s*(?:rupees?|rs\b|worth)/);
  if (cued) return Math.round(parseFloat(cued[1]));

  // Fallback: the largest standalone number in the sentence.
  const nums = [...t.matchAll(/\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0]));
  if (nums.length) return Math.round(Math.max(...nums));

  return null;
}

function parseCustomer(text: string): string | null {
  // Name typically precedes an action verb: "Vivek has borrowed ...",
  // "Ramesh ne liya ...", "for Sunita ...".
  const before = text.match(
    /^([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s+(?:has|have|ne|took|bought|borrowed|owes|paid)/
  );
  if (before) return before[1].trim();

  const forName = text.match(/\bfor\s+([A-Z][a-zA-Z]+)/);
  if (forName) return forName[1].trim();

  // First capitalized token that isn't the sentence start filler.
  const firstCap = text.match(/\b([A-Z][a-z]{2,})\b/);
  if (firstCap) return firstCap[1];

  return null;
}

function parseNote(text: string): string | null {
  // Items usually follow "of" or "worth of".
  const m = text.match(/\b(?:worth of|of|for)\s+(.+)$/i);
  if (m) {
    return m[1]
      .replace(/\b(etc\.?|and so on|wagairah)\b/gi, "")
      .replace(/\s+/g, " ")
      .replace(/[.\s,]+$/, "")
      .trim() || null;
  }
  return null;
}

export function parseInvoiceSpeech(transcript: string): ParsedInvoice {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  return {
    amount: parseAmount(text),
    customerName: parseCustomer(text),
    note: parseNote(text),
    isCredit: CREDIT_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(lower)),
    transcript: text,
  };
}
