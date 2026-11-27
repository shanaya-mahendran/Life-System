"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import {
  PRAYER_ACCENT,
  QADA_PLANS,
  prayerLabel,
  type PrayerKey,
} from "@/lib/prayer/constants";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

let toastId = 0;

export interface QadaRow {
  prayer: string;
  owed: number;
  completed: number;
}

interface QadaBoardProps {
  rows: QadaRow[];
  plan: string;
}

function planSummary(plan: string): string {
  return QADA_PLANS.find((entry) => entry.key === plan)?.summary ?? QADA_PLANS[0].summary;
}

/**
 * A calm ledger: owed, completed, a thin progress line, and the plan in plain
 * words. No red numbers — a backlog is not an emergency.
 */
export function QadaBoard({ rows, plan }: QadaBoardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function save(prayer: string, body: { owed?: number; completed?: number }, key: string) {
    setBusy(key);
    try {
      const response = await fetch("/api/prayer/qada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prayer, ...body }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save that.", "error");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function changePlan(next: string) {
    setBusy("plan");
    try {
      const response = await fetch("/api/prayer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qadaPlan: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast(data.error ?? "Could not change the plan.", "error");
        return;
      }
      toast("Plan updated.");
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  const totalOwed = rows.reduce((total, row) => total + row.owed, 0);
  const totalDone = rows.reduce((total, row) => total + row.completed, 0);

  return (
    <div className="space-y-3">
      <section className="surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-[0.98rem] font-semibold text-white">Your ledger</h2>
            <p className="text-xs text-white/35">
              {totalOwed === 0 && totalDone === 0
                ? "Nothing owed right now."
                : `${totalDone} completed · ${Math.max(0, totalOwed - totalDone)} still owed`}
            </p>
          </div>
          <span className="chip border border-[#3db596]/25 bg-[#3db596]/10 text-[#9fe0c9]">
            {totalOwed > 0 ? `${Math.round((totalDone / Math.max(1, totalOwed)) * 100)}% made up` : "Clear"}
          </span>
        </div>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${totalOwed > 0 ? Math.min(100, (totalDone / totalOwed) * 100) : 0}%`,
              background: `linear-gradient(90deg, ${PRAYER_ACCENT}, ${withAlpha(PRAYER_ACCENT, 0.5)})`,
            }}
          />
        </div>

        <ul className="mt-3 divide-y divide-white/[0.06]">
          {rows.map((row) => {
            const percent = row.owed > 0 ? Math.min(100, (row.completed / row.owed) * 100) : 0;
            const remaining = Math.max(0, row.owed - row.completed);
            return (
              <li key={row.prayer} className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white/85">{prayerLabel(row.prayer)}</p>
                    <p className="text-[0.66rem] tabular-nums text-white/35">
                      {row.owed === 0
                        ? "Nothing owed"
                        : `${row.completed} of ${row.owed} made up${remaining > 0 ? ` · ${remaining} to go` : " · complete"}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label={`Log one ${prayerLabel(row.prayer)} qada`}
                    disabled={busy !== null || remaining === 0}
                    onClick={() => void save(row.prayer, { completed: Math.min(row.owed, row.completed + 1) }, `${row.prayer}:done`)}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 rounded-lg border px-2 text-[0.66rem] font-semibold transition",
                      remaining === 0
                        ? "border-white/[0.06] bg-white/[0.02] text-white/25"
                        : "border-[#3db596]/30 bg-[#3db596]/12 text-[#9fe0c9] hover:bg-[#3db596]/20",
                    )}
                  >
                    {busy === `${row.prayer}:done` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Prayed one
                  </button>

                  <div className="flex items-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
                    <button
                      type="button"
                      aria-label={`Remove one owed ${prayerLabel(row.prayer)}`}
                      disabled={busy !== null || row.owed === 0}
                      onClick={() => void save(row.prayer, { owed: Math.max(0, row.owed - 1) }, `${row.prayer}:minus`)}
                      className="grid h-8 w-7 place-items-center text-white/40 transition hover:text-white disabled:opacity-30"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs tabular-nums text-white/70">{row.owed}</span>
                    <button
                      type="button"
                      aria-label={`Add one owed ${prayerLabel(row.prayer)}`}
                      disabled={busy !== null}
                      onClick={() => void save(row.prayer, { owed: row.owed + 1 }, `${row.prayer}:plus`)}
                      className="grid h-8 w-7 place-items-center text-white/40 transition hover:text-white disabled:opacity-30"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {row.owed > 0 && (
                  <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-[#3db596]/70" style={{ width: `${percent}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="surface p-4">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Your plan</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-white/40">{planSummary(plan)}</p>
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3">
          {QADA_PLANS.map((option) => {
            const active = option.key === plan;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                disabled={busy === "plan"}
                onClick={() => void changePlan(option.key)}
                className={cn(
                  "rounded-xl border px-2.5 py-2 text-left transition",
                  active ? "border-[#3db596]/40 bg-[#3db596]/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                )}
              >
                <span className="block text-[0.72rem] font-semibold text-white/85">{option.label}</span>
                <span className="mt-0.5 block text-[0.6rem] leading-snug text-white/30">{option.summary}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[0.62rem] leading-relaxed text-white/30">
          Guidance, not a ruling. Which prayers are owed, and how they are made up, depends on your own situation — ask
          someone you trust if you are unsure.
        </p>
      </section>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
