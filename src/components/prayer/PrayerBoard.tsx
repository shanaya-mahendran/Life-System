"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, CircleDot, Loader2 } from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import {
  PRAYERS,
  STATUS_META,
  STATUS_ORDER,
  windowLabel,
  type LogStatus,
  type PrayerKey,
} from "@/lib/prayer/constants";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

let toastId = 0;

export interface PrayerBoardProps {
  dateKey: string;
  windows: { key: PrayerKey; start: number; end: number }[];
  statuses: Record<string, LogStatus | undefined>;
  currentKey: string | null;
  adapted: boolean;
  extras: { key: string; label: string; note: string }[];
  extrasStatuses: Record<string, LogStatus | undefined>;
}

const MARK = {
  check: Check,
  half: CircleDot,
  open: Circle,
} as const;

/**
 * The five prayer cards. Every action is one tap and reversible: tapping the
 * status you already chose clears it. Missed is a normal weight and clay —
 * never a destructive red button.
 */
export function PrayerBoard({
  dateKey,
  windows,
  statuses,
  currentKey,
  adapted,
  extras,
  extrasStatuses,
}: PrayerBoardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function write(prayer: string, status: LogStatus, label: string) {
    const key = `${prayer}:${status}`;
    setBusy(key);
    try {
      const response = await fetch("/api/prayer/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey, prayer, status, method: adapted ? "seated" : "normal" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save that.", "error");
        return;
      }
      toast(`${label} · ${STATUS_META[status].label.toLowerCase()}`);
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function clear(prayer: string, label: string) {
    setBusy(`${prayer}:clear`);
    try {
      const response = await fetch(
        `/api/prayer/log?dateKey=${encodeURIComponent(dateKey)}&prayer=${encodeURIComponent(prayer)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast(data.error ?? "Could not clear that.", "error");
        return;
      }
      toast(`${label} cleared.`);
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  const windowByKey = new Map(windows.map((window) => [window.key, window]));

  return (
    <div className="space-y-2.5">
      {PRAYERS.map((prayer) => {
        const window = windowByKey.get(prayer.key);
        const status = statuses[prayer.key];
        const isCurrent = currentKey === prayer.key;
        const meta = status ? STATUS_META[status] : null;
        const StatusMark = meta ? (MARK[meta.mark as keyof typeof MARK] ?? Circle) : Circle;

        return (
          <article
            key={prayer.key}
            className={cn(
              "relative overflow-hidden border px-3.5 pb-3.5 pt-3 transition",
              isCurrent ? "rounded-t-[1.75rem] rounded-b-xl" : "rounded-xl",
            )}
            style={{
              borderColor: meta ? withAlpha(meta.color, 0.28) : isCurrent ? withAlpha(prayer.hue, 0.5) : "rgba(255,255,255,0.07)",
              background: meta
                ? `linear-gradient(135deg, ${withAlpha(meta.color, 0.1)}, rgba(19,17,28,0.9) 65%)`
                : `linear-gradient(135deg, ${withAlpha(prayer.hue, 0.12)}, rgba(19,17,28,0.9) 60%)`,
            }}
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${withAlpha(prayer.hue, 0.6)}, transparent)` }}
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display text-[1.02rem] font-semibold leading-tight text-white">{prayer.label}</h3>
                  <span dir="rtl" className="text-[0.95rem] leading-none text-white/45">
                    {prayer.arabic}
                  </span>
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-white/40">
                  {window ? windowLabel(window.start, window.end) : "—"}
                  <span className="text-white/25"> · {prayer.blurb}</span>
                </p>
              </div>
              {meta ? (
                <span
                  className="chip shrink-0 border"
                  style={{ borderColor: withAlpha(meta.color, 0.3), backgroundColor: withAlpha(meta.color, 0.1), color: meta.color }}
                >
                  <StatusMark className="h-3 w-3" />
                  {meta.label}
                </span>
              ) : isCurrent ? (
                <span className="chip shrink-0 border border-white/10 bg-white/[0.05] text-white/55">Now</span>
              ) : null}
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {STATUS_ORDER.map((option) => {
                const optionMeta = STATUS_META[option];
                const Icon = MARK[optionMeta.mark as keyof typeof MARK] ?? Circle;
                const selected = status === option;
                const loading = busy === `${prayer.key}:${option}`;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => (selected ? void clear(prayer.key, prayer.label) : void write(prayer.key, option, prayer.label))}
                    disabled={busy !== null}
                    className={cn(
                      "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition",
                      selected ? "text-white" : "border-white/[0.06] bg-white/[0.03] text-white/50 hover:text-white/85",
                    )}
                    style={
                      selected
                        ? {
                            borderColor: withAlpha(optionMeta.color, 0.5),
                            backgroundColor: withAlpha(optionMeta.color, 0.2),
                            color: optionMeta.color,
                          }
                        : undefined
                    }
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                    {optionMeta.label}
                  </button>
                );
              })}
            </div>

            {adapted && status && status !== "missed" && (
              <p className="mt-1.5 text-[0.66rem] text-[#6bb9c9]">Prayed as you are able.</p>
            )}
            {meta && <p className="mt-1.5 text-[0.66rem] text-white/30">Tap the same answer again to clear it.</p>}
          </article>
        );
      })}

      {extras.length > 0 && (
        <section className="surface p-3.5">
          <h3 className="font-display text-sm font-semibold text-white">Optional today</h3>
          <p className="mt-0.5 text-[0.68rem] text-white/35">
            Kept separate from the five — these never change your progress.
          </p>
          <ul className="mt-2 divide-y divide-white/[0.06]">
            {extras.map((extra) => {
              const status = extrasStatuses[extra.key];
              const meta = status ? STATUS_META[status] : null;
              return (
                <li key={extra.key} className="flex items-center gap-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white/80">{extra.label}</p>
                    <p className="text-[0.64rem] text-white/30">{extra.note}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      status
                        ? void clear(extra.key, extra.label)
                        : void write(extra.key, "on_time", extra.label)
                    }
                    disabled={busy !== null}
                    aria-pressed={Boolean(status)}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[0.68rem] font-semibold transition",
                      status ? "text-white" : "border-white/[0.07] bg-white/[0.03] text-white/45",
                    )}
                    style={
                      meta
                        ? {
                            borderColor: withAlpha(meta.color, 0.4),
                            backgroundColor: withAlpha(meta.color, 0.16),
                            color: meta.color,
                          }
                        : undefined
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    {status ? "Done" : "Mark done"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
