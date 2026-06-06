// Sarvam Vision — Document Intelligence (OCR) client.
// Docs: https://docs.sarvam.ai  ·  model: sarvam-vision
//
// The flow is an async job (verified live against the API):
//   1. POST  /doc-digitization/job/v1                      -> { job_id }
//   2. POST  /doc-digitization/job/v1/upload-files         -> { upload_urls: { name: { file_url } } }
//   3. PUT   <file_url>  (Azure blob, x-ms-blob-type: BlockBlob)  the PDF bytes
//   4. POST  /doc-digitization/job/v1/{job_id}/start
//   5. GET   /doc-digitization/job/v1/{job_id}/status       poll job_state
//   6. POST  /doc-digitization/job/v1/{job_id}/download-files -> { download_urls: { "document.zip": { file_url } } }
//      The ZIP contains document.md (the extracted text) + per-page metadata.
//
// Input must be a single PDF (or ZIP). Callers pass a PDF — see imageToPdf.ts
// to wrap a phone photo into one.

import { inflateRawSync } from "node:zlib";

const BASE = "https://api.sarvam.ai/doc-digitization/job/v1";

function key(): string {
  const k = process.env.SARVAM_API_KEY;
  if (!k) throw new Error("SARVAM_API_KEY not configured");
  return k;
}

async function sarvam(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "api-subscription-key": key(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sarvam Vision ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return res;
}

// Extract files from a ZIP buffer via its central directory (handles both
// stored and deflated entries). Returns a map of filename -> contents.
function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // Locate End Of Central Directory record (signature PK\x05\x06).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Invalid ZIP (no EOCD)");
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16); // offset of central directory

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break; // central dir header
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);

    // Jump to the local header to find where the data actually starts.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw));

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const TERMINAL = new Set(["Completed", "PartiallyCompleted", "Failed"]);

/**
 * OCR a PDF with Sarvam Vision and return the extracted markdown text.
 * @param pdf      PDF bytes (one PDF only).
 * @param language Expected primary language, BCP-47 (default en-IN).
 */
export async function extractTextFromPdf(pdf: Buffer, language = "en-IN"): Promise<string> {
  // 1. create job. prompt_type=default_ocr keeps the output plain text (other
  // modes wrap it in heavy HTML); md is the lightest output format.
  const created = await (
    await sarvam("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_parameters: { language, output_format: "md", prompt_type: "default_ocr" },
      }),
    })
  ).json();
  const jobId: string = created.job_id;

  // 2. presigned upload URL
  const fileName = "note.pdf";
  const up = await (
    await sarvam("/upload-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, files: [fileName] }),
    })
  ).json();
  const uploadUrl: string = up.upload_urls?.[fileName]?.file_url;
  if (!uploadUrl) throw new Error("Sarvam Vision: no upload URL returned");

  // 3. PUT the PDF to Azure blob storage
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": "application/pdf" },
    body: pdf as unknown as BodyInit,
  });
  if (!put.ok) throw new Error(`Sarvam Vision: file upload failed (${put.status})`);

  // 4. start processing
  await sarvam(`/${jobId}/start`, { method: "POST" });

  // 5. poll status (jobs typically finish in a few seconds)
  let state = "Pending";
  for (let i = 0; i < 40; i++) {
    const status = await (await sarvam(`/${jobId}/status`)).json();
    state = status.job_state;
    if (TERMINAL.has(state)) {
      if (state === "Failed") {
        throw new Error(`Sarvam Vision job failed: ${status.error_message || "unknown error"}`);
      }
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!TERMINAL.has(state)) throw new Error("Sarvam Vision job timed out");

  // 6. download + unzip the output, return document.md
  const dl = await (
    await sarvam(`/${jobId}/download-files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
  ).json();
  const urls = dl.download_urls ?? {};
  const zipUrl: string | undefined = (Object.values(urls)[0] as { file_url?: string })?.file_url;
  if (!zipUrl) throw new Error("Sarvam Vision: no output to download");

  const zipBytes = Buffer.from(await (await fetch(zipUrl)).arrayBuffer());
  const files = unzip(zipBytes);
  // Prefer the markdown output; fall back to any .md, then concatenate.
  const md =
    files.get("document.md") ??
    [...files.entries()].find(([n]) => n.endsWith(".md"))?.[1];
  const text = md ? md.toString("utf8") : "";

  // When Sarvam can't confidently read a region it may embed the page as a
  // base64 markdown image and/or add an italic "image is blurry" note — strip
  // those so only real transcribed lines reach the parser.
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("![") && !line.includes("data:image"))
    .join("\n")
    .trim();
}

// Default language hint for OCR. Indian Kirana notes are commonly Devanagari or
// mixed Hindi/English; hi-IN reads both scripts well. Override via env.
export const DEFAULT_OCR_LANGUAGE = process.env.SARVAM_VISION_LANGUAGE || "hi-IN";
