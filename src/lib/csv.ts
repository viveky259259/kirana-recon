import Papa from "papaparse";

// Normalized payment row produced by every per-app parser.
export type NormalizedRow = {
  externalId: string; // UTR / RRN / bank txn id — dedupe key
  txnRef: string | null; // reference / note (should carry reconId)
  amount: number;
  paidAt: Date;
  payerVpa: string | null;
  sourceApp: "PAYTM" | "GPAY" | "PHONEPE" | "OTHER";
};

export type ParseResult = {
  rows: NormalizedRow[];
  errors: string[];
  detectedApp: NormalizedRow["sourceApp"];
};

// Lowercased, trimmed header lookup so column-name casing/spacing doesn't matter.
function pick(row: Record<string, string>, ...names: string[]): string | undefined {
  const map: Record<string, string> = {};
  for (const k of Object.keys(row)) map[k.trim().toLowerCase()] = row[k];
  for (const n of names) {
    const v = map[n.trim().toLowerCase()];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return NaN;
  // strip ₹, commas, spaces, and any leading +/-
  const cleaned = raw.replace(/[₹,\s]/g, "").replace(/[^0-9.\-]/g, "");
  return Math.abs(parseFloat(cleaned));
}

function parseDate(raw: string | undefined): Date {
  if (!raw) return new Date(NaN);
  const t = raw.trim();
  // Try native first (handles ISO and many locale forms)
  const native = new Date(t);
  if (!isNaN(native.getTime())) return native;
  // Try dd/mm/yyyy [hh:mm[:ss]]
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yy, hh = "0", mi = "0", ss = "0"] = m;
    const year = yy.length === 2 ? 2000 + parseInt(yy) : parseInt(yy);
    return new Date(year, parseInt(mm) - 1, parseInt(dd), +hh, +mi, +ss);
  }
  return new Date(NaN);
}

// Heuristically detect which app a CSV came from by its header columns.
function detectApp(headers: string[]): NormalizedRow["sourceApp"] {
  const h = headers.map((x) => x.toLowerCase()).join("|");
  if (h.includes("upi ref") || h.includes("paytm") || h.includes("order id")) return "PAYTM";
  if (h.includes("rrn") || h.includes("phonepe")) return "PHONEPE";
  if (h.includes("google") || h.includes("gpay") || (h.includes("amount (inr)") && h.includes("upi id")))
    return "GPAY";
  if (h.includes("utr")) return "PHONEPE";
  return "OTHER";
}

// Map a single raw row to the normalized shape. Column names below cover the
// common export formats; pick() makes lookups order/case-insensitive.
function normalizeRow(
  row: Record<string, string>,
  app: NormalizedRow["sourceApp"]
): NormalizedRow | null {
  const externalId =
    pick(row, "utr", "rrn", "upi ref no", "upi ref", "bank reference no", "transaction id", "txn id");
  const amount = parseAmount(pick(row, "amount", "amount (inr)", "txn amount", "credit amount", "amount(inr)"));
  const paidAtRaw = pick(row, "date", "transaction date", "txn date", "date & time", "timestamp", "created on");
  const txnRef = pick(row, "remark", "remarks", "note", "narration", "description", "merchant order id", "order id", "transaction note") ?? null;
  const payerVpa = pick(row, "payer vpa", "from vpa", "vpa", "sender upi id", "payer upi") ?? null;

  if (!externalId) return null; // no dedupe key -> cannot import safely
  if (isNaN(amount)) return null;

  return {
    externalId: externalId.trim(),
    txnRef: txnRef ? txnRef.trim() : null,
    amount,
    paidAt: parseDate(paidAtRaw),
    payerVpa: payerVpa ? payerVpa.trim() : null,
    sourceApp: app,
  };
}

// Parse a settlement CSV string into normalized rows. `forceApp` lets the UI
// override auto-detection when the owner knows the source.
export function parseSettlementCsv(
  csv: string,
  forceApp?: NormalizedRow["sourceApp"]
): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const app = forceApp && forceApp !== "OTHER" ? forceApp : detectApp(headers);
  const rows: NormalizedRow[] = [];
  const errors: string[] = [];

  parsed.data.forEach((raw, i) => {
    const norm = normalizeRow(raw, app);
    if (!norm) {
      errors.push(`Row ${i + 2}: missing transaction id or amount — skipped.`);
      return;
    }
    if (isNaN(norm.paidAt.getTime())) {
      norm.paidAt = new Date();
      errors.push(`Row ${i + 2}: unreadable date — defaulted to now.`);
    }
    rows.push(norm);
  });

  return { rows, errors, detectedApp: app };
}
