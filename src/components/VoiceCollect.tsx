"use client";

import { useRef, useState } from "react";
import { WavRecorder } from "@/lib/wavRecorder";
import { inr } from "@/components/ui";

type Found = { payerName: string | null; amount: number };

// Voice capture for offline collections. The merchant taps record and says e.g.
// "Vivek Yadav gave me 500 rupees"; Sarvam transcribes it and we create PENDING
// entries (shown in the review list below). onCaptured refreshes that list.
export function VoiceCollect({ onCaptured }: { onCaptured: () => void }) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [found, setFound] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<WavRecorder | null>(null);

  async function start() {
    setError(null);
    setTranscript(null);
    setFound(null);
    try {
      const rec = new WavRecorder();
      await rec.start();
      recorderRef.current = rec;
      setState("recording");
    } catch {
      setError("Microphone access denied or unavailable.");
    }
  }

  async function stop() {
    if (!recorderRef.current) return;
    setState("processing");
    try {
      const wav = await recorderRef.current.stop();
      recorderRef.current = null;
      const form = new FormData();
      form.append("audio", wav, "voice.wav");
      const res = await fetch("/api/recon/voice", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Transcription failed");
        return;
      }
      setTranscript(data.transcript || "(nothing heard)");
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
            🎙️ Say a payment
            <Badge>Voice</Badge>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            e.g. &ldquo;Vivek gave me 500 rupees&rdquo;
          </p>
        </div>
        {state === "recording" ? (
          <button onClick={stop} className="pt-btn bg-rose-500 hover:bg-rose-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" /> Stop
          </button>
        ) : (
          <button onClick={start} disabled={state === "processing"} className="pt-btn">
            {state === "processing" ? "Please wait…" : "Speak"}
          </button>
        )}
      </div>

      <div className="mt-3 flex-1">
        {state === "recording" && <p className="text-sm text-rose-600">● Listening… tap Stop when done.</p>}
        {error && <p className="text-sm text-rose-700 bg-rose-50 rounded-lg p-2">{error}</p>}
        {transcript && (
          <div className="text-sm bg-slate-50 rounded-lg p-3">
            <span className="text-slate-400 text-xs">Heard:</span>{" "}
            <span className="text-slate-700">&ldquo;{transcript}&rdquo;</span>
            {found && <FoundList found={found} />}
          </div>
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

// Shared list of the name/amount rows Sarvam extracted from this capture.
export function FoundList({ found }: { found: { payerName: string | null; amount: number }[] }) {
  if (found.length === 0) {
    return <div className="mt-1 text-xs font-semibold text-amber-600">No amount detected — try again.</div>;
  }
  return (
    <div className="mt-2">
      <div className="text-[11px] font-semibold text-emerald-700 mb-1">
        Found {found.length} entr{found.length === 1 ? "y" : "ies"} — review &amp; approve below ↓
      </div>
      <ul className="space-y-1">
        {found.map((f, i) => (
          <li key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
            <span className="font-medium text-slate-700">{f.payerName || "Unknown"}</span>
            <span className="font-semibold text-paytm-navy">{inr(f.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
