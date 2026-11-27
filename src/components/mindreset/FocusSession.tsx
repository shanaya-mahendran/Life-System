"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Shield, Square } from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import { FOCUS_PRESETS, minutesLabel } from "@/lib/mindreset/constants";
import { ToastStack, type ToastMessage } from "@/components/ui/Toast";
import { PauseOverlay } from "./PauseOverlay";

let toastId = 0;

interface FocusSessionProps {
  focus: { today: number; longest: number; lifetime: number; sessions: number };
  blockingOn: boolean;
  blockedApps: string[];
  focusGoalMinutes: number;
}

export function FocusSession({ focus, blockingOn, blockedApps, focusGoalMinutes }: FocusSessionProps) {
  const router = useRouter();
  const [planned, setPlanned] = useState(30);
  const [left, setLeft] = useState(30 * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[]>(blockedApps.slice(0, 2));
  const [busy, setBusy] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [, startTransition] = useTransition();
  const finishRef = useRef<(auto: boolean) => void>(() => {});

  function toast(text: string, tone: "success" | "error" = "success") {
    toastId += 1;
    setToasts((current) => [...current, { id: toastId, text, tone }]);
  }

  useEffect(() => {
    if (!running) setLeft(planned * 60);
  }, [planned, running]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (running && left === 0) finishRef.current(true);
  }, [running, left]);

  async function start() {
    setBusy(true);
    try {
      const response = await fetch("/api/mindreset/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", plannedMinutes: planned, blockedApps: blocked }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not start the session.", "error");
        return;
      }
      setSessionId(data.id);
      setLeft(planned * 60);
      setRunning(true);
    } catch {
      toast("Network error — try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function finish(auto: boolean) {
    setRunning(false);
    const id = sessionId;
    setSessionId(null);
    if (!id) return;

    const elapsedSeconds = auto ? planned * 60 : Math.max(1, planned * 60 - left);
    const actualMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setBusy(true);
    try {
      const response = await fetch("/api/mindreset/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finish",
          sessionId: id,
          actualMinutes,
          completed: auto || actualMinutes >= planned,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error ?? "Could not save the session.", "error");
        return;
      }
      toast(
        auto
          ? `${planned} minutes focused. Saved to your focus history.`
          : `Session ended after ${minutesLabel(actualMinutes)}.`,
      );
      startTransition(() => router.refresh());
    } catch {
      toast("Network error — the session was not saved.", "error");
    } finally {
      setBusy(false);
    }
  }
  finishRef.current = (auto: boolean) => void finish(auto);

  async function turnBlockingOn() {
    setBusy(true);
    try {
      const response = await fetch("/api/mindreset/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockingOn: true }),
      });
      if (!response.ok) {
        toast("Could not turn blocking on.", "error");
        return;
      }
      toast("Blocking is on. Limits and focus blocks are active.");
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const progress = running ? 1 - left / Math.max(1, planned * 60) : 0;
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const options = blockedApps.length ? blockedApps : ["No apps tracked yet"];

  return (
    <div className="space-y-3">
      {!blockingOn && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f2995a]/25 bg-[#f2995a]/[0.08] px-3.5 py-3">
          <Shield className="h-4 w-4 shrink-0 text-[#f5b183]" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.8rem] font-semibold text-[#f8c69f]">Blocking is off</p>
            <p className="text-[0.65rem] leading-relaxed text-white/40">
              Everything you set up is saved, but nothing is being blocked yet.
            </p>
          </div>
          <button type="button" onClick={() => void turnBlockingOn()} disabled={busy} className="btn btn-ghost text-[0.7rem]">
            Turn on
          </button>
        </div>
      )}

      <div className="surface p-4">
        <div className="flex flex-col items-center">
          <div className="relative h-[264px] w-[264px] max-w-full">
            <svg width="264" height="264" viewBox="0 0 270 270" className="-rotate-90" aria-hidden focusable="false">
              {Array.from({ length: 60 }).map((_, index) => {
                const angle = (index / 60) * 2 * Math.PI;
                const inner = index % 5 === 0 ? 114 : 119;
                return (
                  <line
                    key={index}
                    x1={135 + 126 * Math.cos(angle)}
                    y1={135 + 126 * Math.sin(angle)}
                    x2={135 + inner * Math.cos(angle)}
                    y2={135 + inner * Math.sin(angle)}
                    stroke="rgba(185,163,240,0.35)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                );
              })}
              <circle cx="135" cy="135" r={radius - 14} fill="rgba(255,255,255,0.03)" />
              <circle
                cx="135"
                cy="135"
                r={radius}
                stroke="#c2622a"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[2.6rem] font-bold leading-none tracking-tight text-white">
                {mm}:{ss}
              </span>
              <span className="mt-1 text-[0.78rem] text-white/45">{running ? "Stay with it" : "Target time"}</span>
            </div>
          </div>

          {!running && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {FOCUS_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlanned(value)}
                  className={cn(
                    "min-h-[36px] rounded-full border px-4 text-[0.75rem] font-semibold transition",
                    planned === value
                      ? "border-[#1e2a6e] bg-[#1e2a6e] text-white"
                      : "border-white/[0.09] bg-white/[0.03] text-white/55 hover:text-white",
                  )}
                >
                  {value}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPlanned((value) => Math.min(120, value + 5))}
                className="min-h-[36px] rounded-full border border-white/[0.09] bg-white/[0.03] px-3 text-[0.75rem] font-semibold text-white/55 hover:text-white"
              >
                +5
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.8rem] font-semibold text-white/85">Apps to block</p>
              <p className="text-[0.63rem] text-white/35">
                {blocked.length ? blocked.join(", ") : "Choose apps from your recent usage"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {options.map((app) => {
                const active = blocked.includes(app);
                return (
                  <button
                    key={app}
                    type="button"
                    onClick={() =>
                      setBlocked((current) =>
                        current.includes(app) ? current.filter((item) => item !== app) : [...current, app],
                      )
                    }
                    className={cn(
                      "h-8 w-8 rounded-lg border text-[0.65rem] font-bold transition",
                      active
                        ? "border-[#f2995a] bg-[#f2995a]/15 text-[#f8c69f]"
                        : "border-white/10 bg-white/[0.04] text-white/45 hover:text-white",
                    )}
                    title={app}
                    aria-pressed={active}
                    aria-label={`Block ${app}`}
                  >
                    {app.slice(0, 1).toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.07] rounded-xl border border-white/[0.07] bg-white/[0.02] py-3">
          {[
            ["Today", focus.today],
            ["Longest", focus.longest],
            ["Lifetime", focus.lifetime],
          ].map(([label, value]) => (
            <div key={String(label)} className="text-center">
              <p className="font-display text-[1.05rem] font-bold text-white">{minutesLabel(Number(value))}</p>
              <p className="text-[0.6rem] text-white/35">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => (running ? void finish(false) : void start())}
            disabled={busy}
            className={cn(
              "flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full text-[0.85rem] font-bold text-white transition",
              running ? "bg-[#b14e2a] hover:bg-[#9c4526]" : "bg-[#1e2a6e] hover:bg-[#27357f]",
            )}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : running ? (
              <Square className="h-3.5 w-3.5 fill-white" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-white" />
            )}
            {running ? "End session" : "Start focus"}
          </button>
          <button type="button" onClick={() => setPauseOpen(true)} className="btn btn-ghost min-h-[46px] px-4 text-[0.75rem]">
            Try the reflective pause
          </button>
        </div>

        <p className="mt-2.5 text-center text-[0.62rem] leading-relaxed text-white/30">
          {focusGoalMinutes} minutes is today&apos;s focus goal · {focus.sessions} session{focus.sessions === 1 ? "" : "s"} on
          record. App blocking itself runs in the MindReset Android bridge; this section records the rules, timers and results.
        </p>
      </div>

      <PauseOverlay
        open={pauseOpen}
        app={blocked[0] ?? "This app"}
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
