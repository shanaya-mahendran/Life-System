"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, LayoutGrid, Loader2, Moon, Plus, Shield, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MindResetLimitCard } from "@/lib/mindreset/service";
import {
  LIMIT_TYPE_LABEL,
  PRESETS,
  WEEKDAY_LABEL,
  minutesLabel,
  minutesToTimeLabel,
  type LimitType,
} from "@/lib/mindreset/constants";
import { Modal } from "@/components/ui/Modal";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { Toggle } from "./Toggle";
import { PauseOverlay } from "./PauseOverlay";

let toastId = 0;

const TYPE_OPTIONS: { value: LimitType; label: string; hint: string }[] = [
  { value: "cap", label: "Daily cap", hint: "A fixed number of minutes a day" },
  { value: "schedule", label: "Schedule block", hint: "Blocked between two times" },
  { value: "budget", label: "Shared budget", hint: "One budget across several apps" },
];

const PRESET_ICONS = { Bedtime: Moon, "Work Focus": Briefcase, "Brick Mode": LayoutGrid } as const;

function describeLimit(limit: MindResetLimitCard): string {
  if (limit.type === "cap" || limit.type === "budget") {
    return `${minutesLabel(limit.minutes ?? 0)} ${limit.type === "budget" ? "shared" : "daily"}`;
  }
  if (limit.type === "schedule") {
    const days = limit.days.length === 7 ? "Every day" : limit.days.map((day) => WEEKDAY_LABEL[day]).join(", ");
    return `${days} · ${minutesToTimeLabel(limit.startMinute)} – ${minutesToTimeLabel(limit.endMinute)}`;
  }
  return LIMIT_TYPE_LABEL[limit.type as LimitType] ?? limit.type;
}

function minutesFromTime(value: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function LimitsBoard({ limits, blockingOn }: { limits: MindResetLimitCard[]; blockingOn: boolean }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();

  const [type, setType] = useState<LimitType>("cap");
  const [target, setTarget] = useState("");
  const [minutes, setMinutes] = useState("45");
  const [start, setStart] = useState("23:00");
  const [end, setEnd] = useState("06:00");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [strict, setStrict] = useState(false);

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  const presetLimits = new Map(
    limits.filter((limit) => limit.type === "preset").map((limit) => [limit.preset ?? limit.label, limit]),
  );
  const activeLimits = limits.filter((limit) => limit.type !== "preset");

  async function patchSettings(body: Record<string, unknown>) {
    const response = await fetch("/api/mindreset/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Could not update the setting.");
    }
  }

  async function turnBlocking(next: boolean) {
    setBusy("blocking");
    try {
      await patchSettings({ blockingOn: next });
      toast(next ? "Blocking is on. Limits are enforced." : "Blocking paused. Your limits are saved.");
      startTransition(() => router.refresh());
    } catch (error) {
      toast(error instanceof Error ? error.message : "Network error.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function addLimit() {
    if (type !== "preset" && !target.trim()) {
      toast("Name the app or group this limit applies to.", "error");
      return;
    }
    setBusy("create");
    try {
      const response = await fetch("/api/mindreset/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: target.trim(),
          target: target.trim(),
          type,
          minutes: type === "cap" || type === "budget" ? Number(minutes) || null : null,
          startMinute: type === "schedule" ? minutesFromTime(start) : null,
          endMinute: type === "schedule" ? minutesFromTime(end) : null,
          days,
          strict,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not add the limit.", "error");
        return;
      }
      toast("Limit added.");
      setAddOpen(false);
      setTarget("");
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function toggleLimit(limit: MindResetLimitCard) {
    setBusy(limit.id);
    try {
      const response = await fetch("/api/mindreset/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: limit.id, enabled: !limit.enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not update the limit.", "error");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  async function removeLimit(limit: MindResetLimitCard) {
    setBusy(limit.id);
    try {
      const response = await fetch(`/api/mindreset/limits?id=${encodeURIComponent(limit.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not remove the limit.", "error");
        return;
      }
      toast("Limit removed.");
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  async function togglePreset(name: string) {
    setBusy(name);
    try {
      const response = await fetch("/api/mindreset/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not update the preset.", "error");
        return;
      }
      toast(`${name} ${data.enabled ? "is on" : "is off"}.`);
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border px-3.5 py-3"
        style={{
          borderColor: blockingOn ? "rgba(52,211,153,0.25)" : "rgba(242,153,90,0.25)",
          backgroundColor: blockingOn ? "rgba(52,211,153,0.07)" : "rgba(242,153,90,0.08)",
        }}
      >
        <Shield className={cn("h-4 w-4 shrink-0", blockingOn ? "text-emerald-300" : "text-[#f5b183]")} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-[0.8rem] font-semibold", blockingOn ? "text-emerald-200" : "text-[#f8c69f]")}>
            {blockingOn ? "Blocking is on" : "Blocking is off"}
          </p>
          <p className="text-[0.65rem] leading-relaxed text-white/40">
            {blockingOn
              ? "Limits, schedules and focus blocks are being enforced by the Android bridge."
              : "Anything you set up here is saved, but nothing is being blocked yet."}
          </p>
        </div>
        <Toggle
          on={blockingOn}
          onChange={(next) => void turnBlocking(next)}
          label="Blocking"
          disabled={busy === "blocking"}
        />
      </div>

      <section className="surface p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Your limits</h2>
            <p className="text-[0.66rem] text-white/35">Caps, schedule blocks and shared budgets.</p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary text-[0.72rem]">
            <Plus className="h-3.5 w-3.5" /> Add a limit
          </button>
        </div>

        {activeLimits.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
            <Shield className="mx-auto h-6 w-6 text-white/20" />
            <p className="mt-2 text-[0.82rem] font-medium text-white/55">Set up blocking</p>
            <p className="mx-auto mt-1 max-w-sm text-[0.7rem] leading-relaxed text-white/30">
              Cap an app to a daily limit, block distractions on a schedule, or share one budget across apps.
            </p>
            <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary mt-3 text-[0.72rem]">
              <Plus className="h-3.5 w-3.5" /> Add your first limit
            </button>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {activeLimits.map((limit) => (
              <li key={limit.id} className="flex items-center gap-2.5 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[0.7rem] font-bold text-white/70">
                  {(limit.target || limit.label).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8rem] font-semibold text-white/85">{limit.target || limit.label}</p>
                  <p className="text-[0.62rem] text-white/35">
                    {describeLimit(limit)}
                    {limit.strict ? " · strict" : ""}
                  </p>
                </div>
                <Toggle
                  on={limit.enabled}
                  onChange={() => void toggleLimit(limit)}
                  label={`Enable ${limit.target || limit.label}`}
                  disabled={busy === limit.id}
                />
                <button
                  type="button"
                  onClick={() => void removeLimit(limit)}
                  disabled={busy === limit.id}
                  aria-label={`Remove ${limit.target || limit.label}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-white/25 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  {busy === limit.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => setPauseOpen(true)}
          className="mt-2 w-full rounded-xl border border-dashed border-[#b9a3f0]/40 py-2.5 text-[0.72rem] font-semibold text-[#cbbcfa] transition hover:bg-[#b9a3f0]/[0.06]"
        >
          Preview the reflective pause
        </button>
      </section>

      <section>
        <h2 className="mb-2 px-1 font-display text-[0.98rem] font-semibold text-white">Presets</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.name];
            const record = presetLimits.get(preset.name);
            const active = Boolean(record?.enabled);
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => void togglePreset(preset.name)}
                disabled={busy === preset.name}
                aria-pressed={active}
                className={cn(
                  "flex min-h-[118px] flex-col items-start rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-[#f2995a]/45 bg-[#f2995a]/[0.08]"
                    : "border-white/[0.07] bg-white/[0.025] hover:border-white/15",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl border",
                    active
                      ? "border-[#f2995a]/35 bg-[#f2995a]/15 text-[#f8c69f]"
                      : "border-white/10 bg-white/[0.04] text-white/45",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-3 text-[0.82rem] font-semibold text-white/90">{preset.name}</span>
                <span className="mt-0.5 text-[0.62rem] leading-relaxed text-white/35">
                  {active ? "Active" : preset.summary}
                </span>
                {busy === preset.name && <Loader2 className="mt-1 h-3 w-3 animate-spin text-white/40" />}
              </button>
            );
          })}
        </div>
      </section>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a limit"
        subtitle="The bridge enforces it; you can change or pause it at any time."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn btn-quiet text-[0.75rem]">
              Cancel
            </button>
            <button type="button" onClick={() => void addLimit()} disabled={busy === "create"} className="btn btn-primary text-[0.75rem]">
              {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add limit
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid gap-1.5 sm:grid-cols-3">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                aria-pressed={type === option.value}
                className={cn(
                  "rounded-xl border px-2.5 py-2 text-left transition",
                  type === option.value
                    ? "border-[#f2995a]/40 bg-[#f2995a]/12"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/15",
                )}
              >
                <span className="block text-[0.72rem] font-semibold text-white/85">{option.label}</span>
                <span className="mt-0.5 block text-[0.58rem] leading-snug text-white/30">{option.hint}</span>
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="label">{type === "budget" ? "Apps in this budget" : "App or group"}</span>
            <input
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="Character.AI, Idle Miner"
              className="field"
              autoFocus
            />
          </label>

          {(type === "cap" || type === "budget") && (
            <label className="block space-y-1">
              <span className="label">Minutes a day</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="field"
              />
            </label>
          )}

          {type === "schedule" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="label">From</span>
                <input type="time" value={start} onChange={(event) => setStart(event.target.value)} className="field" />
              </label>
              <label className="block space-y-1">
                <span className="label">To</span>
                <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} className="field" />
              </label>
            </div>
          )}

          <div>
            <span className="label">Days</span>
            <div className="mt-1 flex gap-1">
              {WEEKDAY_LABEL.map((label, index) => {
                const active = days.includes(index);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setDays((current) =>
                        current.includes(index) ? current.filter((day) => day !== index) : [...current, index].sort(),
                      )
                    }
                    className={cn(
                      "h-8 flex-1 rounded-lg border text-[0.6rem] font-semibold transition",
                      active
                        ? "border-[#1e2a6e] bg-[#1e2a6e] text-white"
                        : "border-white/[0.07] bg-white/[0.02] text-white/40",
                    )}
                    aria-pressed={active}
                  >
                    {label.slice(0, 2)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
            <div>
              <p className="text-[0.75rem] font-semibold text-white/80">Strict</p>
              <p className="text-[0.6rem] text-white/30">No five-minute override while this limit is active.</p>
            </div>
            <Toggle on={strict} onChange={setStrict} label="Strict limit" />
          </div>
        </div>
      </Modal>

      <PauseOverlay
        open={pauseOpen}
        app={activeLimits[0]?.target || "Character.AI"}
        onClose={() => setPauseOpen(false)}
        onSaved={(savedToDiary) => {
          toast(savedToDiary ? "Pause saved — and copied to today's Diary." : "Pause saved.");
          startTransition(() => router.refresh());
        }}
      />

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}
