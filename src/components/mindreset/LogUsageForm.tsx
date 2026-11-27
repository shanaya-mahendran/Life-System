"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save } from "lucide-react";
import type { MindResetApp, MindResetDayCard } from "@/lib/mindreset/service";
import { hourLabel } from "@/lib/mindreset/constants";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

let toastId = 0;

interface LogUsageFormProps {
  todayKey: string;
  initial?: MindResetDayCard | null;
  defaultOpen?: boolean;
}

function appsToText(apps: MindResetApp[]): string {
  return apps.map((app) => `${app.name}, ${app.minutes}`).join("\n");
}

function parseApps(text: string): MindResetApp[] {
  return text
    .split(/\n+/)
    .map((line) => {
      const parts = line.split(/[,:=]/).map((part) => part.trim());
      if (parts.length < 2) return null;
      const name = parts[0];
      const minutes = Number(parts[1].replace(/[^0-9.]/g, ""));
      if (!name || !Number.isFinite(minutes) || minutes <= 0) return null;
      const category = parts[2] || "Other";
      return { name: name.slice(0, 60), minutes: Math.round(minutes), category };
    })
    .filter((app): app is MindResetApp => app !== null)
    .slice(0, 12);
}

/**
 * Manual entry for people using the web section without the Android bridge.
 * The same endpoint (`/api/mindreset/usage`) accepts a device-synced payload,
 * so switching to automatic tracking needs no UI change.
 */
export function LogUsageForm({ todayKey, initial, defaultOpen = false }: LogUsageFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen || !initial);
  const [showHours, setShowHours] = useState(false);
  const [screen, setScreen] = useState(initial ? String(initial.screenMinutes) : "");
  const [pickups, setPickups] = useState(initial ? String(initial.pickups) : "");
  const [focus, setFocus] = useState(initial ? String(initial.focusMinutes) : "");
  const [night, setNight] = useState(initial ? String(initial.nightMinutes) : "");
  const [apps, setApps] = useState(initial ? appsToText(initial.apps) : "");
  const [hours, setHours] = useState<string[]>(
    Array.from({ length: 24 }, (_, hour) => (initial?.hours[hour] ? String(initial.hours[hour]) : "")),
  );
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  async function submit() {
    const screenMinutes = Number(screen);
    if (!Number.isFinite(screenMinutes) || screenMinutes <= 0) {
      toast("Enter today's screen time first.", "error");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/mindreset/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateKey: todayKey,
          screenMinutes,
          pickups: Number(pickups) || 0,
          focusMinutes: Number(focus) || 0,
          nightMinutes: Number(night) || 0,
          apps: parseApps(apps),
          hours: hours.map((value) => Number(value) || 0),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save today's usage.", "error");
        return;
      }
      toast(`Today saved · Thriving ${data.score?.score ?? "—"}%`);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[0.95rem] font-semibold text-white">
            {initial ? "Today's numbers" : "Log today's numbers"}
          </h2>
          <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/35">
            Aggregated totals only — no message content, no app logs. The Android bridge writes the same row
            automatically once it is connected.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="btn btn-ghost text-[0.72rem]">
          {open ? "Close" : initial ? "Update" : "Add today"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2.5 animate-[rise_0.2s_ease-out]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="block space-y-1">
              <span className="label">Screen time (min)</span>
              <input
                type="number"
                min={0}
                max={1440}
                value={screen}
                onChange={(event) => setScreen(event.target.value)}
                placeholder="246"
                className="field"
              />
            </label>
            <label className="block space-y-1">
              <span className="label">Pickups</span>
              <input
                type="number"
                min={0}
                max={999}
                value={pickups}
                onChange={(event) => setPickups(event.target.value)}
                placeholder="64"
                className="field"
              />
            </label>
            <label className="block space-y-1">
              <span className="label">Focus (min)</span>
              <input
                type="number"
                min={0}
                max={1440}
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="30"
                className="field"
              />
            </label>
            <label className="block space-y-1">
              <span className="label">After bedtime (min)</span>
              <input
                type="number"
                min={0}
                max={1440}
                value={night}
                onChange={(event) => setNight(event.target.value)}
                placeholder="20"
                className="field"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="label">Top apps — one per line, minutes, optional category</span>
            <textarea
              value={apps}
              onChange={(event) => setApps(event.target.value)}
              rows={4}
              placeholder={"Character.AI, 144, Entertainment\nIdle Miner, 54, Entertainment\nChrome, 18, Social"}
              className="field resize-y font-mono text-[0.72rem]"
            />
          </label>

          <div>
            <button
              type="button"
              onClick={() => setShowHours((value) => !value)}
              className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold text-white/45 hover:text-white/75"
            >
              <Plus className="h-3 w-3" /> Hourly split (optional, powers the hourly chart)
            </button>
            {showHours && (
              <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                {hours.map((value, hour) => (
                  <label key={hour} className="block">
                    <span className="mb-0.5 block text-[0.5rem] tabular-nums text-white/25">{hourLabel(hour)}</span>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={value}
                      onChange={(event) =>
                        setHours((current) =>
                          current.map((entry, index) => (index === hour ? event.target.value : entry)),
                        )
                      }
                      className="field min-h-0 px-1.5 py-1 text-center text-[0.65rem]"
                      aria-label={`Minutes in hour ${hourLabel(hour)}`}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => void submit()} disabled={busy} className="btn btn-primary text-[0.74rem]">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save today
            </button>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </section>
  );
}
