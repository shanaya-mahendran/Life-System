"use client";

import { useState } from "react";
import { cn, withAlpha } from "@/lib/utils";
import { minutesLabel } from "@/lib/mindreset/constants";

export interface WeekBar {
  dateKey: string;
  label: string;
  minutes: number;
  logged: boolean;
}

/**
 * The 7-day screen-time chart with the dashed average line. Today's bar keeps
 * the burnt-orange gradient; the rest use the violet gradient from the
 * MindReset palette. Selecting a bar shows its exact total.
 */
export function WeekBars({
  data,
  avg,
  activeKey,
  max,
}: {
  data: WeekBar[];
  avg: number;
  activeKey?: string;
  max?: number;
}) {
  const [selected, setSelected] = useState<string | null>(activeKey ?? data[data.length - 1]?.dateKey ?? null);
  const peak = Math.max(max ?? 0, ...data.map((day) => day.minutes), 60);
  const scale = Math.max(peak, Math.ceil((peak * 1.15) / 60) * 60);
  const lastKey = data[data.length - 1]?.dateKey;

  return (
    <div>
      <div className="relative flex h-[150px] items-end gap-1.5 pl-7">
        {[0, 0.5, 1].map((fraction) => (
          <div
            key={fraction}
            className="pointer-events-none absolute inset-x-0 flex items-center gap-1"
            style={{ bottom: 22 + fraction * 100 }}
          >
            <span className="w-6 text-right text-[0.55rem] tabular-nums text-white/30">
              {Math.round((scale * fraction) / 60)}h
            </span>
            <span className="h-px flex-1 border-t border-white/[0.07]" />
          </div>
        ))}

        {avg > 0 && (
          <div
            className="pointer-events-none absolute left-7 right-0 border-t border-dashed"
            style={{ bottom: 22 + (avg / scale) * 100, borderColor: "rgba(240,138,104,0.7)" }}
          />
        )}

        {data.map((day) => {
          const isToday = day.dateKey === lastKey;
          const isSelected = selected === day.dateKey;
          const height = Math.max(day.minutes > 0 ? 5 : 2, (day.minutes / scale) * 100);
          return (
            <button
              key={day.dateKey}
              type="button"
              onClick={() => setSelected(day.dateKey)}
              className="group relative z-10 flex flex-1 flex-col items-center justify-end"
              aria-label={`${day.dateKey}: ${day.logged ? minutesLabel(day.minutes) : "no data"}`}
            >
              {isSelected && (
                <span
                  className="absolute rounded-lg bg-[#1e2a6e] px-1.5 py-0.5 text-[0.55rem] font-bold text-white shadow-lg"
                  style={{ bottom: height + 26 }}
                >
                  {day.logged ? minutesLabel(day.minutes) : "no data"}
                </span>
              )}
              <span
                className={cn("w-full rounded-md transition-all", !day.logged && "opacity-40")}
                style={{
                  height: `${height}px`,
                  background: isToday
                    ? "linear-gradient(180deg,#F6A56B,#C2622A)"
                    : `linear-gradient(180deg,${withAlpha("#9B8BF0", 0.95)},${withAlpha("#4B3BBF", 0.95)})`,
                  boxShadow: isSelected ? "0 0 12px rgba(240,150,95,0.45)" : undefined,
                }}
              />
              <span
                className={cn(
                  "mt-1.5 text-[0.6rem] font-semibold",
                  isToday ? "text-[#f5b183]" : "text-white/35",
                )}
              >
                {day.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center justify-between text-[0.6rem] text-white/30">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-4 border-t border-dashed border-[#f08a68]" /> Average {avg > 0 ? minutesLabel(avg) : "—"}
        </span>
        <span>{data.filter((day) => day.logged).length} logged of 7 days</span>
      </p>
    </div>
  );
}
