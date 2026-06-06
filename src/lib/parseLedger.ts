// Turn free text — a Sarvam speech transcript or a Sarvam Vision OCR dump of a
// paper note — into structured collection rows: { name, amount }.
//
// The merchant's paper/spoken phrasings we target (English + romanized Hindi):
//   "Vivek given me 500"        "Prasad gave me 300"
//   "Vivek Yadav have given me 500 rupees"
//   "Ramesh ne diya 200"        "Sunil - 500"      "Prashant 200"
//   "| Vivek | 500 |"  (Sarvam sometimes emits a markdown table)
//
// One line → at most one row. Lines with no detectable amount are dropped
// (headings, totals labels, noise). Heuristic/regex based — fast, dependency
// free, and good enough for the common cases; the merchant approves/declines
// every row anyway, so a wrong guess is a one-tap fix, never a silent error.

export type LedgerEntry = {
  name: string | null;
  amount: number;
  raw: string; // the source line, kept for display + audit
};

// Spoken Indian number units → multiplier.
const UNITS: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  k: 1000,
  lakh: 100000,
  lakhs: 100000,
  crore: 10000000,
};

// Connector / filler words that sit between a name and the amount. Stripped off
// the tail of the name so "Vivek given me" → "Vivek".
const CONNECTORS = [
  "have", "has", "had", "given", "gave", "give", "giving", "me", "to",
  "took", "taken", "take", "borrow", "borrowed", "owe", "owes", "liya", "liye",
  "paid", "pay", "sent", "send", "ne", "diya", "diye", "diyе", "de", "dena",
  "ka", "ki", "ke", "rupees", "rupee", "rs", "inr", "amount", "of", "worth",
  "is", "was", "a", "the", "and",
];

function parseAmount(line: string): number | null {
  const t = line.toLowerCase().replace(/,/g, "");

  // "5 thousand", "2 lakh", "1.5k"
  const unit = t.match(/(\d+(?:\.\d+)?)\s*(thousand|lakhs?|crore|hundred|k)\b/);
  if (unit) return Math.round(parseFloat(unit[1]) * UNITS[unit[2]]);

  // Number next to a currency cue.
  const cued =
    t.match(/(?:₹|rs\.?|inr|rupees?)\s*(\d+(?:\.\d+)?)/) ||
    t.match(/(\d+(?:\.\d+)?)\s*(?:₹|rs\b|inr|rupees?)/);
  if (cued) return Math.round(parseFloat(cued[1]));

  // Otherwise the last standalone number on the line (amounts trail the name).
  const nums = [...t.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
  if (nums.length) return Math.round(parseFloat(nums[nums.length - 1]));

  return null;
}

function cleanName(raw: string): string | null {
  let s = raw
    .replace(/[|*#>•·\-–—:]/g, " ") // markdown / bullet / separator chars
    .replace(/\d+(?:[.,]\d+)?/g, " ") // any digits
    .replace(/[₹]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Drop trailing connector words ("Vivek given me" → "Vivek").
  let tokens = s.split(" ").filter(Boolean);
  while (tokens.length && CONNECTORS.includes(tokens[tokens.length - 1].toLowerCase())) {
    tokens.pop();
  }
  // Also drop leading connectors / fillers ("from Vivek" → "Vivek").
  while (tokens.length && CONNECTORS.includes(tokens[0].toLowerCase())) {
    tokens.shift();
  }
  // Reject empties and sentence-like noise (e.g. Sarvam's "the image is blurry"
  // describer text) — a payer name is at most a few tokens.
  if (tokens.length === 0 || tokens.length > 4) return null;

  // Title-case for tidy display.
  return tokens.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// Take the slice of the line *before* the amount as the name candidate. If the
// amount leads the line (rare), fall back to the slice after it.
function nameFor(line: string, amount: number): string | null {
  const idx = line.toLowerCase().replace(/,/g, "").search(/\d/);
  const head = idx > 0 ? line.slice(0, idx) : "";
  const fromHead = cleanName(head);
  if (fromHead) return fromHead;
  return cleanName(line); // amount-first or odd ordering
}

// Normalize Devanagari digits (०-९) to ASCII. Sarvam usually does this itself,
// but this is cheap insurance for notes written in Devanagari numerals.
function asciiDigits(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
}

export function parseLedger(text: string): LedgerEntry[] {
  const paired: LedgerEntry[] = [];
  const nameOnly: { name: string; raw: string }[] = [];
  const amountOnly: { amount: number; raw: string }[] = [];

  for (const rawLine of asciiDigits(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Skip markdown table separators like |---|---| and the header row Sarvam
    // emits when it reads the note as a table (e.g. "| Name | Value |").
    if (/^[|\s:\-]+$/.test(line)) continue;
    if (/name/i.test(line) && /(value|amount|paid|rupees?|₹)/i.test(line) && !/\d/.test(line)) continue;

    const amount = parseAmount(line);
    const name = amount ? nameFor(line, amount) : cleanName(line);

    if (amount && amount > 0 && name) {
      paired.push({ name, amount, raw: line }); // "Vivek gave me 500" — best case
    } else if (amount && amount > 0) {
      amountOnly.push({ amount, raw: line });
    } else if (name) {
      nameOnly.push({ name, raw: line });
    }
  }

  // Column-layout notes (and some OCR output) put all the names on one set of
  // lines and all the amounts on another. When we have leftover names and
  // amounts and no per-line pairs, zip them positionally so the merchant still
  // gets named rows to review (and can fix any that lined up wrong).
  const zipped: LedgerEntry[] = [];
  const pairs = Math.min(nameOnly.length, amountOnly.length);
  for (let i = 0; i < pairs; i++) {
    zipped.push({
      name: nameOnly[i].name,
      amount: amountOnly[i].amount,
      raw: `${nameOnly[i].raw} ${amountOnly[i].raw}`,
    });
  }

  return [...paired, ...zipped];
}
