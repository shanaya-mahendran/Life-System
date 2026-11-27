"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Save } from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import {
  ASR_METHODS,
  CALC_METHODS,
  DAY_STATES,
  HIGH_LATITUDE_RULES,
  LOCATION_PRESETS,
  MADHHABS,
  PRAYER_ACCENT,
  type DayState,
} from "@/lib/prayer/constants";
import type { PrayerSettingsCard } from "@/lib/prayer/service";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";

let toastId = 0;

interface PrayerSettingsFormProps {
  settings: PrayerSettingsCard;
  todayState: DayState;
  dateKey: string;
  timezone: string;
}

const TOGGLES: { key: keyof PrayerSettingsCard; label: string; summary: string }[] = [
  { key: "remindersOn", label: "Gentle reminders", summary: "One soft reminder per window — no escalation, no flashing." },
  { key: "fajrAlarm", label: "Fajr alarm", summary: "A single alarm for Fajr instead of a notification." },
  { key: "lockDuringPrayer", label: "Quiet during prayer", summary: "Hold distracting apps for the length of the prayer window." },
  { key: "trackSunnah", label: "Track sunnah", summary: "Show the two rak'ah before Fajr as an optional item." },
  { key: "trackWitr", label: "Track Witr", summary: "Show Witr after Isha as an optional item." },
];

export function PrayerSettingsForm({ settings, todayState, dateKey, timezone }: PrayerSettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<PrayerSettingsCard>(settings);
  const [state, setState] = useState<DayState>(todayState);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  function patch(partial: Partial<PrayerSettingsCard>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  async function save() {
    setBusy("save");
    try {
      const response = await fetch("/api/prayer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: form.latitude,
          longitude: form.longitude,
          locationLabel: form.locationLabel,
          method: form.method,
          asrMethod: form.asrMethod,
          highLatitude: form.highLatitude,
          madhhab: form.madhhab,
          adjustMinutes: form.adjustMinutes,
          remindersOn: form.remindersOn,
          fajrAlarm: form.fajrAlarm,
          lockDuringPrayer: form.lockDuringPrayer,
          trackSunnah: form.trackSunnah,
          trackWitr: form.trackWitr,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save your settings.", "error");
        return;
      }
      toast("Saved. Times updated.");
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function setTodayState(next: DayState) {
    setBusy(`state:${next}`);
    try {
      const response = await fetch("/api/prayer/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateKey, state: next, source: "user" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not change today's state.", "error");
        return;
      }
      setState(next);
      toast(next === "active" ? "Back to active practice." : `Today is marked ${next}.`);
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  function chooseLocation(label: string) {
    const preset = LOCATION_PRESETS.find((entry) => entry.label === label);
    if (!preset) return;
    patch({ latitude: preset.latitude, longitude: preset.longitude, locationLabel: preset.label });
  }

  return (
    <div className="space-y-3">
      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: PRAYER_ACCENT }} />
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Location</h2>
            <p className="text-[0.68rem] text-white/35">
              Used only to calculate times. Nothing leaves your account.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="label">City preset</span>
            <select value={form.locationLabel} onChange={(event) => chooseLocation(event.target.value)} className="field">
              {!LOCATION_PRESETS.some((preset) => preset.label === form.locationLabel) && (
                <option value={form.locationLabel}>{form.locationLabel || "Custom"}</option>
              )}
              {LOCATION_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.label}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label">Label</span>
            <input
              value={form.locationLabel}
              onChange={(event) => patch({ locationLabel: event.target.value })}
              className="field"
              maxLength={60}
            />
          </label>
          <label className="block space-y-1">
            <span className="label">Latitude</span>
            <input
              type="number"
              step="0.0001"
              min={-90}
              max={90}
              value={form.latitude}
              onChange={(event) => patch({ latitude: Number(event.target.value) })}
              className="field"
            />
          </label>
          <label className="block space-y-1">
            <span className="label">Longitude</span>
            <input
              type="number"
              step="0.0001"
              min={-180}
              max={180}
              value={form.longitude}
              onChange={(event) => patch({ longitude: Number(event.target.value) })}
              className="field"
            />
          </label>
        </div>
        <p className="mt-2 text-[0.62rem] text-white/30">
          Times use your LifeOS timezone ({timezone}). Change it in Settings if you have moved.
        </p>
      </section>

      <section className="surface p-4 space-y-3">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Calculation</h2>

        <label className="block space-y-1">
          <span className="label">Method</span>
          <select value={form.method} onChange={(event) => patch({ method: event.target.value })} className="field">
            {CALC_METHODS.map((method) => (
              <option key={method.key} value={method.key}>
                {method.label} — {method.region}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="label">Asr</span>
          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
            {ASR_METHODS.map((option) => {
              const active = form.asrMethod === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ asrMethod: option.key })}
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
        </div>

        <label className="block space-y-1">
          <span className="label">High-latitude rule (above roughly 48°)</span>
          <select
            value={form.highLatitude}
            onChange={(event) => patch({ highLatitude: event.target.value })}
            className="field"
          >
            {HIGH_LATITUDE_RULES.map((rule) => (
              <option key={rule.key} value={rule.key}>
                {rule.label} — {rule.summary}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="label">Madhhab preference</span>
            <select value={form.madhhab} onChange={(event) => patch({ madhhab: event.target.value })} className="field">
              {MADHHABS.map((madhhab) => (
                <option key={madhhab.key} value={madhhab.key}>
                  {madhhab.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label">Minute adjustment</span>
            <input
              type="number"
              min={-45}
              max={45}
              value={form.adjustMinutes}
              onChange={(event) => patch({ adjustMinutes: Number(event.target.value) })}
              className="field"
            />
          </label>
        </div>
        <p className="text-[0.62rem] leading-relaxed text-white/30">
          Times are calculated on this device from your coordinates. Above 48° latitude the sun may not reach the
          twilight angle, so the rule above fills the gap. This is guidance, not a fatwa — follow your local timetable if
          you have one.
        </p>
      </section>

      <section className="surface p-4">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Today&apos;s state</h2>
        <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/35">
          Only you can change this. An excused day is never a gap: it keeps your streak and adds nothing to qada.
        </p>
        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
          {DAY_STATES.map((option) => {
            const active = state === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                disabled={busy !== null}
                onClick={() => void setTodayState(option.key)}
                className="rounded-xl border px-2.5 py-2 text-left transition"
                style={{
                  borderColor: active ? withAlpha(option.color, 0.45) : "rgba(255,255,255,0.07)",
                  backgroundColor: active ? withAlpha(option.color, 0.1) : "rgba(255,255,255,0.02)",
                }}
              >
                <span className="flex items-center gap-1.5 text-[0.72rem] font-semibold" style={{ color: active ? option.color : "rgba(255,255,255,0.8)" }}>
                  {busy === `state:${option.key}` && <Loader2 className="h-3 w-3 animate-spin" />}
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[0.6rem] leading-snug text-white/30">{option.summary}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="surface p-4">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Reminders &amp; extras</h2>
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {TOGGLES.map((toggle) => {
            const value = Boolean(form[toggle.key]);
            return (
              <li key={toggle.key} className="flex items-start gap-2.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/85">{toggle.label}</p>
                  <p className="text-[0.64rem] leading-snug text-white/30">{toggle.summary}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={value}
                  aria-label={toggle.label}
                  onClick={() => patch({ [toggle.key]: !value } as Partial<PrayerSettingsCard>)}
                  className={cn(
                    "mt-0.5 h-6 w-10 shrink-0 rounded-full border transition",
                    value ? "border-[#3db596]/40" : "border-white/10 bg-white/[0.06]",
                  )}
                  style={value ? { backgroundColor: withAlpha(PRAYER_ACCENT, 0.35) } : undefined}
                >
                  <span
                    className={cn(
                      "block h-4 w-4 rounded-full bg-white transition-transform",
                      value ? "translate-x-5" : "translate-x-1",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[0.62rem] leading-relaxed text-white/30">
          Preferences are saved here and honoured by the LifeOS apps that can raise notifications. A browser tab has no
          background alarms, so nothing fires while LifeOS is closed.
        </p>
      </section>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => void save()} disabled={busy !== null} className="btn btn-primary text-xs">
          {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save settings
        </button>
      </div>

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
