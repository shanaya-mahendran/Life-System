"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Save, Trash2 } from "lucide-react";
import type { MindResetSettingsCard } from "@/lib/mindreset/service";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { Toggle } from "./Toggle";

let toastId = 0;

export function MindResetSettingsForm({ initial }: { initial: MindResetSettingsCard }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  function patch(changes: Partial<MindResetSettingsCard>) {
    setSettings((current) => ({ ...current, ...changes }));
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/mindreset/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save your settings.", "error");
        return;
      }
      toast("MindReset settings saved.");
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    setBusy(true);
    try {
      const response = await fetch("/api/mindreset/usage", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast(data.error ?? "Could not delete the data.", "error");
        return;
      }
      setConfirmDelete(false);
      toast("MindReset data deleted.");
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  const rows: { key: keyof MindResetSettingsCard; title: string; body: string }[] = [
    {
      key: "blockingOn",
      title: "Blocking",
      body: "When off, limits and focus blocks are saved but not enforced.",
    },
    {
      key: "strictMode",
      title: "Strict mode",
      body: "Removes the five-minute override on every limit, not just strict ones.",
    },
    {
      key: "securityLock",
      title: "Security lock",
      body: "Ask for your device lock before changing a limit or turning blocking off.",
    },
    {
      key: "savePauseToDiary",
      title: "Save pause answers to Diary",
      body: "Each reflective pause writes one line into today's Diary entry.",
    },
    {
      key: "shareWithSleep",
      title: "Share with Sleep",
      body: "Late-night minutes and the Bedtime preset follow your sleep schedule.",
    },
    {
      key: "shareWithHabits",
      title: "Share with Habit Tracker",
      body: "Daily digital goals become habit rows you can check in on.",
    },
  ];

  return (
    <div className="space-y-3">
      <section className="surface p-4">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Goals</h2>
        <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/35">
          The score is measured against your own numbers, so a realistic goal matters more than a strict one.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="label">Daily screen-time goal</span>
            <select
              value={settings.goalMinutes}
              onChange={(event) => patch({ goalMinutes: Number(event.target.value) })}
              className="field"
            >
              {[120, 180, 240, 300, 360, 420].map((value) => (
                <option key={value} value={value} className="bg-[#150f28]">
                  {value / 60} hours a day
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label">Daily focus goal</span>
            <select
              value={settings.focusGoalMinutes}
              onChange={(event) => patch({ focusGoalMinutes: Number(event.target.value) })}
              className="field"
            >
              {[15, 30, 45, 60, 90].map((value) => (
                <option key={value} value={value} className="bg-[#150f28]">
                  {value} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="label">Pause style</span>
            <select
              value={settings.pauseStyle}
              onChange={(event) => patch({ pauseStyle: event.target.value })}
              className="field"
            >
              <option value="reflective" className="bg-[#150f28]">
                Reflective pause — one question, gentle alternative
              </option>
              <option value="strict" className="bg-[#150f28]">
                Strict — the pause still holds for the full wait
              </option>
            </select>
          </label>
        </div>
      </section>

      <section className="surface p-4">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Blocking behaviour</h2>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[0.8rem] font-semibold text-white/85">{row.title}</p>
                <p className="mt-0.5 text-[0.63rem] leading-relaxed text-white/35">{row.body}</p>
              </div>
              <Toggle
                on={Boolean(settings[row.key])}
                onChange={(next) => patch({ [row.key]: next } as Partial<MindResetSettingsCard>)}
                label={row.title}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void save()} disabled={busy} className="btn btn-primary text-[0.76rem]">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save settings
        </button>
        <a href="/api/mindreset/export" className="btn btn-ghost text-[0.76rem]">
          <Download className="h-3.5 w-3.5" /> Export my MindReset data
        </a>
      </div>

      <section className="surface p-4">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Your data</h2>
        <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/40">
          MindReset stores daily summaries, limits, sessions and pause answers — never raw app events or message
          content. Export keeps a copy; deleting removes the rows above from your account.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn btn-ghost mt-3 border-rose-400/30 text-[0.72rem] text-rose-200"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete all MindReset data
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] px-3 py-2.5">
            <p className="text-[0.68rem] text-rose-100/80">
              Delete every MindReset day, limit, session and pause answer? This cannot be undone.
            </p>
            <div className="ml-auto flex gap-1.5">
              <button type="button" onClick={() => setConfirmDelete(false)} className="btn btn-quiet text-[0.68rem]">
                Keep
              </button>
              <button
                type="button"
                onClick={() => void purge()}
                disabled={busy}
                className="btn border border-rose-400/30 bg-rose-500/15 text-[0.68rem] text-rose-100"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </section>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
