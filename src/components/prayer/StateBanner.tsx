"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2, X } from "lucide-react";
import { withAlpha } from "@/lib/utils";
import { dayStateMeta, stateSourceLabel, type DayState } from "@/lib/prayer/constants";

interface StateBannerProps {
  dateKey: string;
  state: DayState;
  source: string;
  note: string;
}

/**
 * The context banner: whenever today is not plain Active, it says so, names
 * where the state came from, and offers one-tap undo. It is dismissible for
 * the session but the state itself is untouched.
 */
export function StateBanner({ dateKey, state, source, note }: StateBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  if (state === "active" || dismissed) return null;

  const meta = dayStateMeta(state);

  async function undo() {
    setBusy(true);
    try {
      const response = await fetch(`/api/prayer/state?dateKey=${encodeURIComponent(dateKey)}`, { method: "DELETE" });
      if (response.ok) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="relative flex items-start gap-2.5 rounded-xl border p-3"
      style={{ borderColor: withAlpha(meta.color, 0.32), backgroundColor: withAlpha(meta.color, 0.09) }}
      role="status"
    >
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold" style={{ color: meta.color }}>
          {meta.label} today
          {state === "excused" ? " — your streak is safe." : " — pray as you are able."}
        </p>
        <p className="mt-0.5 text-[0.7rem] leading-relaxed text-white/45">
          {meta.summary} {source !== "user" ? `This came from ${stateSourceLabel(source)}.` : ""}
          {note ? ` ${note}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void undo()}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[0.64rem] font-semibold text-white/65 transition hover:text-white"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
        Undo
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white/30 transition hover:bg-white/10 hover:text-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
