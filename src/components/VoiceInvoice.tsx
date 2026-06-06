"use client";

import { useRef, useState } from "react";
import { WavRecorder } from "@/lib/wavRecorder";
import { inr } from "@/components/ui";

type Parsed = {
  amount: number | null;
  customerName: string | null;
  note: string | null;
  isCredit: boolean;
  transcript: string;
};

type VoiceResult = {
  transcript: string;
  parsed: Parsed;
  invoice: { id: string; reconId: string; amount: number } | null;
  qrDataUrl?: string;
  deeplink?: string;
};

// Voice-driven invoice entry. The owner taps record, speaks e.g.
// "Vivek has borrowed 5000 worth of rice, wheat", and we transcribe (Sarvam),
// parse, and create the invoice.
export function VoiceInvoice({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<WavRecorder | null>(null);

  async function startRecording() {
    setError(null);
    setResult(null);
    try {
      const rec = new WavRecorder();
      await rec.start();
      recorderRef.current = rec;
      setState("recording");
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }

  async function stopRecording() {
    if (!recorderRef.current) return;
    setState("processing");
    try {
      const wav = await recorderRef.current.stop();
      recorderRef.current = null;

      const form = new FormData();
      form.append("audio", wav, "voice.wav");
      const res = await fetch("/api/invoices/voice", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transcription failed");
        setState("idle");
        return;
      }
      setResult(data);
      if (data.invoice) onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="pt-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-paytm-navy flex items-center gap-2">
            🎙️ Voice entry
            <span className="text-[10px] font-bold uppercase bg-paytm-cyan/15 text-paytm-cyan-dark px-2 py-0.5 rounded-full">
              Sarvam AI
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Say e.g. &ldquo;Vivek has borrowed 5000 worth of rice, wheat&rdquo;
          </p>
        </div>

        {state === "recording" ? (
          <button onClick={stopRecording} className="pt-btn bg-rose-500 hover:bg-rose-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /> Stop
          </button>
        ) : (
          <button onClick={startRecording} disabled={state === "processing"} className="pt-btn">
            {state === "processing" ? "Transcribing…" : "Record"}
          </button>
        )}
      </div>

      {state === "recording" && (
        <p className="text-sm text-rose-600">● Listening… tap Stop when done.</p>
      )}

      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg p-2">{error}</p>}

      {result && (
        <div className="mt-2 space-y-2">
          <div className="text-sm bg-slate-50 rounded-lg p-3">
            <span className="text-slate-400 text-xs">Heard:</span>{" "}
            <span className="text-slate-700">&ldquo;{result.transcript || "(nothing)"}&rdquo;</span>
          </div>

          {result.invoice ? (
            <div className="flex items-center gap-4 bg-emerald-50 rounded-lg p-3">
              {result.qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.qrDataUrl} alt="UPI QR" className="w-20 h-20 rounded border border-emerald-200" />
              )}
              <div className="text-sm">
                <div className="font-semibold text-emerald-800">Invoice created ✓</div>
                <div className="font-mono text-xs">{result.invoice.reconId}</div>
                <div>
                  {result.parsed.customerName ?? "Customer"} · {inr(result.invoice.amount)}
                  {result.parsed.isCredit && <span className="text-amber-600"> · udhaar</span>}
                </div>
                {result.parsed.note && <div className="text-slate-500 text-xs">{result.parsed.note}</div>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
              Couldn&apos;t detect an amount — please use the form below to create the invoice manually.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
