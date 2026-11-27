"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { MindResetMascot } from "./Mascot";
import { PAUSE_CHIPS } from "@/lib/mindreset/constants";
import { cn } from "@/lib/utils";

/**
 * The reflective pause. A gentle stop instead of a wall: one question, a few
 * one-tap answers, and a five-second wait before any override is offered.
 */
export function PauseOverlay({
  open,
  app,
  onClose,
  onSaved,
}: {
  open: boolean;
  app: string;
  onClose: () => void;
  onSaved?: (savedToDiary: boolean) => void;
}) {
  const [seconds, setSeconds] = useState(5);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSeconds(5);
      setAnswer("");
      setError(null);
      return;
    }
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, seconds]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  async function save(wentBack: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/mindreset/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app, answer, wentBack }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not save the pause.");
        return;
      }
      onSaved?.(Boolean(data.savedToDiary));
      onClose();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reflective pause"
      className="fixed inset-0 z-[120] overflow-y-auto"
      style={{ background: "linear-gradient(170deg,#2b2660 0%,#5d4599 55%,#a86f80 100%)" }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-8 pt-10 text-center text-white">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the pause"
          className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mt-4 flex justify-center">
          <MindResetMascot mood="calm" size={124} />
        </div>
        <h2 className="mt-3 font-display text-[1.6rem] font-semibold tracking-tight">Take a breath</h2>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-white/80">
          <span className="font-semibold text-white">{app}</span> is blocked right now. You reached for it — what for?
        </p>

        <input
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Why do you want to open it?"
          className="mt-5 w-full rounded-2xl border border-white/20 bg-white/[0.12] px-4 py-3 text-[0.9rem] text-white placeholder-white/50 outline-none focus:border-white/50"
        />

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {PAUSE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setAnswer(chip)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.72rem] font-semibold transition",
                answer === chip ? "border-white bg-white text-[#1e2a6e]" : "border-white/40 text-white hover:bg-white/10",
              )}
            >
              {chip}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[0.65rem] leading-relaxed text-white/60">
          Saved to today&apos;s Diary when that switch is on — never shared with anyone else.
        </p>

        {error && <p className="mt-2 text-[0.7rem] font-semibold text-rose-100">{error}</p>}

        <div className="mt-auto pt-6">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(true)}
            className="w-full rounded-full bg-white py-3.5 text-[0.95rem] font-bold text-[#1e2a6e] transition disabled:opacity-60"
          >
            {busy ? "Saving…" : "Go back"}
          </button>
          <button
            type="button"
            disabled={busy || seconds > 0}
            onClick={() => void save(false)}
            className="mt-2.5 w-full rounded-full border border-white/50 py-3 text-[0.85rem] font-semibold text-white transition disabled:opacity-45"
          >
            {seconds > 0 ? `5 more minutes (${seconds})` : "5 more minutes"}
          </button>
        </div>
      </div>
    </div>
  );
}
