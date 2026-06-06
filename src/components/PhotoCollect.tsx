"use client";

import { useRef, useState } from "react";
import { FoundList } from "@/components/VoiceCollect";

type Found = { payerName: string | null; amount: number };

// Normalize a picked image to a full-resolution JPEG with EXIF orientation
// baked in (phone cameras store rotation as a flag Sarvam doesn't honor). We do
// NOT downscale — Sarvam Vision sees the original pixels, since OCR quality on
// small/light handwriting drops fast once a photo is shrunk.
async function toUprightJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/jpeg", 0.95)
  );
}

// Photo capture for offline collections. The merchant photographs a paper note
// listing names + amounts; Sarvam Vision OCRs it into PENDING entries shown in
// the review list. onCaptured refreshes that list.
export function PhotoCollect({ onCaptured }: { onCaptured: () => void }) {
  const [state, setState] = useState<"idle" | "processing">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setRawText(null);
    setFound(null);
    setState("processing");
    try {
      const isPdf = file.type === "application/pdf";
      const blob = isPdf ? file : await toUprightJpeg(file);
      if (!isPdf) setPreview(URL.createObjectURL(blob));
      const form = new FormData();
      form.append(isPdf ? "pdf" : "image", blob, isPdf ? "note.pdf" : "note.jpg");
      const res = await fetch("/api/recon/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "OCR failed");
        return;
      }
      setRawText(data.rawText || "(no text read)");
      setFound(data.entries ?? []);
      if (data.entries?.length) onCaptured();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="pt-card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-paytm-navy flex items-center gap-2">
            📄 Take a photo of your note
            <Badge>Photo</Badge>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">A paper list of names &amp; amounts</p>
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={state === "processing"} className="pt-btn">
          {state === "processing" ? "Reading…" : "Take photo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />
      </div>

      <div className="mt-3 flex-1">
        {state === "processing" && (
          <p className="text-sm text-paytm-cyan-dark">Sarvam Vision is reading the note…</p>
        )}
        {error && <p className="text-sm text-rose-700 bg-rose-50 rounded-lg p-2">{error}</p>}
        <div className="flex gap-3">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="note" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
          )}
          {found && (
            <div className="flex-1 text-sm min-w-0">
              {found.length > 0 ? (
                <FoundList found={found} />
              ) : (
                <div className="text-xs font-semibold text-amber-600">
                  Couldn&apos;t read any rows — try a closer, flatter shot.
                </div>
              )}
              {rawText && (
                <details className="mt-2">
                  <summary className="text-[11px] text-slate-400 cursor-pointer">Raw OCR text</summary>
                  <pre className="mt-1 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap max-h-24 overflow-auto">
                    {rawText}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
        {!rawText && !error && state === "idle" && (
          <p className="text-xs text-slate-400">
            Tip: fill the frame with <b>just the paper</b> (crop out background), hold it flat in
            even light. Each row should read as <i>name … amount</i>.
          </p>
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase bg-paytm-cyan/15 text-paytm-cyan-dark px-2 py-0.5 rounded-full">
      {children}
    </span>
  );
}
