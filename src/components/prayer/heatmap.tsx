import Link from "next/link";
import { cn, withAlpha } from "@/lib/utils";
import {
  DAY_STATES,
  HEATMAP_RAMP,
  dateKeyLabel,
  dayStateMeta,
  heatmapColor,
  monthShort,
  prayerLabel,
  STATUS_META,
} from "@/lib/prayer/constants";
import type { Heatmap } from "@/lib/prayer/stats";

const WEEKDAY_ROWS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function cellTitle(dateKey: string, summary: { state: string; applicable: number; onTime: number; late: number; missed: number } | null) {
  if (!summary) return `${dateKey} · in the future`;
  const meta = dayStateMeta(summary.state);
  const label = dateKeyLabel(dateKey);
  if (meta.key === "excused") return `${label} · excused · streak preserved`;
  if (meta.key === "review") return `${label} · in review · counts held`;
  if (summary.applicable === 0) return `${label} · ${meta.label.toLowerCase()}`;
  return `${label} · ${summary.onTime} on time, ${summary.late} late, ${summary.missed} missed of ${summary.applicable}`;
}

interface HeatmapProps {
  heatmap: Heatmap;
  selectedKey?: string;
  className?: string;
}

/**
 * GitHub-style grid: week columns, day rows. Excused days are lavender and
 * hatched (they count positively), adapted days are teal with a dot, missed
 * prayers leave a clay ring. Tapping a cell opens that day's five prayers,
 * with the same detail as a screen reader announcement.
 */
export function PrayerHeatmap({ heatmap, selectedKey, className }: HeatmapProps) {
  const { weeks } = heatmap;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex min-w-full flex-col gap-1">
          <div className="flex gap-[3px] pl-8">
            {weeks.map((week, index) => {
              const label = week.monthLabel;
              const show = label && (index === 0 || label.slice(0, 7) !== weeks[index - 1]?.monthLabel?.slice(0, 7));
              return (
                <div key={week.days[0]?.dateKey ?? index} className="w-[14px] shrink-0 text-[0.55rem] text-white/35">
                  {show && label ? monthShort(Number(label.slice(5, 7))) : ""}
                </div>
              );
            })}
          </div>

          <div className="flex gap-[3px]">
            <div className="flex w-8 shrink-0 flex-col justify-between pr-1 text-[0.55rem] text-white/30">
              {WEEKDAY_ROWS.map((label, index) => (
                <span key={index} className="leading-[14px]">
                  {label}
                </span>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div key={week.days[0]?.dateKey ?? weekIndex} className="flex flex-col gap-[3px]">
                {week.days.map((cell, dayIndex) => {
                  if (!cell.summary) {
                    return (
                      <span
                        key={cell.dateKey}
                        className="h-[14px] w-[14px] rounded-[3px] border border-dashed border-white/[0.06]"
                        aria-hidden
                      />
                    );
                  }

                  const summary = cell.summary;
                  const meta = dayStateMeta(summary.state);
                  const isExcused = meta.key === "excused";
                  const isAdapted = meta.key === "adapted";
                  const isReview = meta.key === "review";
                  const hasMissed = summary.missed > 0;
                  const selected = selectedKey === cell.dateKey;

                  const background = isReview
                    ? "transparent"
                    : isExcused
                      ? withAlpha("#b3a9d0", 0.25)
                      : isAdapted
                        ? withAlpha("#3c8fa3", 0.55)
                        : heatmapColor(summary.onTime, summary.applicable);

                  return (
                    <Link
                      key={cell.dateKey}
                      href={`/prayer/progress?day=${cell.dateKey}`}
                      title={cellTitle(cell.dateKey, summary)}
                      aria-label={cellTitle(cell.dateKey, summary)}
                      aria-current={selected ? "date" : undefined}
                      className={cn(
                        "relative block h-[14px] w-[14px] rounded-[3px] transition hover:scale-125",
                        isReview && "border border-dashed border-white/25",
                        selected && "ring-1 ring-white/60",
                      )}
                      style={{
                        backgroundColor: background,
                        backgroundImage: isExcused
                          ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 4px)"
                          : undefined,
                        boxShadow: hasMissed && !isExcused ? `inset 0 0 0 1px ${withAlpha(STATUS_META.missed.color, 0.75)}` : undefined,
                      }}
                    >
                      {isAdapted && (
                        <span className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.6rem] text-white/35">
        <span className="inline-flex items-center gap-1">
          Less
          {HEATMAP_RAMP.map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
          ))}
          More
        </span>
        {DAY_STATES.filter((state) => ["excused", "adapted", "review"].includes(state.key)).map((state) => (
          <span key={state.key} className="inline-flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-[2px] border border-white/15"
              style={{
                backgroundColor: state.key === "excused" ? withAlpha(state.color, 0.25) : state.key === "adapted" ? withAlpha("#3c8fa3", 0.55) : "transparent",
                backgroundImage:
                  state.key === "excused"
                    ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 1px, transparent 1px 4px)"
                    : undefined,
              }}
            />
            {state.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span
            className="h-2.5 w-2.5 rounded-[2px] bg-[#1a2521]"
            style={{ boxShadow: `inset 0 0 0 1px ${withAlpha(STATUS_META.missed.color, 0.75)}` }}
          />
          Missed present
        </span>
      </div>
    </div>
  );
}

/** Five rows, one per prayer — reveals the prayer that slips at a glance. */
export function PrayerRows({
  heatmap,
  logsByKey,
}: {
  heatmap: Heatmap;
  logsByKey: Record<string, Record<string, string>>;
}) {
  const rows = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-[3px]">
        {rows.map((prayer) => (
          <div key={prayer} className="flex items-center gap-[3px]">
            <span className="w-14 shrink-0 text-[0.6rem] text-white/40">{prayerLabel(prayer)}</span>
            {heatmap.weeks.map((week) => {
              const key = week.days[0]?.dateKey;
              return (
                <div key={key ?? prayer} className="flex gap-[3px]">
                  {week.days.map((cell) => {
                    const status = cell.summary ? logsByKey[cell.dateKey]?.[prayer] : undefined;
                    const meta = status ? STATUS_META[status as keyof typeof STATUS_META] : null;
                    return (
                      <span
                        key={cell.dateKey}
                        title={`${prayerLabel(prayer)} · ${dateKeyLabel(cell.dateKey)} · ${meta ? meta.label : "no record"}`}
                        className="h-[10px] w-[10px] rounded-[2px]"
                        style={{
                          backgroundColor: meta
                            ? withAlpha(meta.color, status === "missed" ? 0.28 : 0.75)
                            : "rgba(255,255,255,0.045)",
                          border: status === "missed" ? `1px solid ${withAlpha(meta?.color ?? "#fff", 0.6)}` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
