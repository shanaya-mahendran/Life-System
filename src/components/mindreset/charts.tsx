import { cn, withAlpha } from "@/lib/utils";
import { hourLabel, minutesLabel } from "@/lib/mindreset/constants";

/** "Today vs your usual" cumulative curve. Server-rendered SVG. */
export function CumulativeCurve({
  today,
  usual,
  currentHour,
  className,
}: {
  today: number[];
  usual: number[];
  currentHour: number;
  className?: string;
}) {
  const maximum = Math.max(60, ...today, ...usual);
  const point = (values: number[], hour: number) => {
    const x = (hour / 23) * 320;
    const y = 100 - (Math.min(values[hour] ?? 0, maximum) / maximum) * 92;
    return { x, y };
  };

  const path = (values: number[]) =>
    values
      .map((_, hour) => {
        const { x, y } = point(values, hour);
        return `${hour === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const todayPath = path(today);
  const marker = point(today, Math.max(0, Math.min(23, currentHour)));

  return (
    <div className={className}>
      <svg viewBox="0 0 320 112" width="100%" role="img" aria-label="Cumulative screen time today compared with your usual day">
        {[20, 55, 90].map((y) => (
          <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
        ))}
        <path d={`${path(usual)} L320 105 L0 105 Z`} fill="rgba(139,116,230,0.16)" />
        <path d={path(usual)} stroke="#9b8bf0" strokeWidth="2" fill="none" strokeDasharray="4 4" />
        <path d={todayPath} stroke="#f2995a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <circle cx={marker.x} cy={marker.y} r="4.5" fill="#13111c" stroke="#f2995a" strokeWidth="2.5" />
      </svg>
      <div className="mt-1 flex justify-between text-[0.55rem] text-white/30">
        <span>12 AM</span>
        <span>{hourLabel(currentHour)}</span>
        <span>11 PM</span>
      </div>
    </div>
  );
}

/** Hourly breakdown with the peak hour highlighted. */
export function HourlyBars({ hours, peakHour }: { hours: number[]; peakHour: number | null }) {
  const peak = Math.max(...hours, 1);
  return (
    <div>
      <div className="flex h-[80px] items-end gap-[3px]">
        {hours.map((minutes, hour) => (
          <div
            key={hour}
            title={`${hourLabel(hour)} · ${minutesLabel(minutes)}`}
            className="flex-1 rounded-sm"
            style={{
              height: `${Math.max(3, (minutes / peak) * 76)}px`,
              background: hour === peakHour ? "#f2995a" : withAlpha("#9b8bf0", 0.85),
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.55rem] text-white/30">
        <span>12 AM</span>
        <span>12 PM</span>
        <span>11 PM</span>
      </div>
    </div>
  );
}

/** Top apps list with share bars. */
export function AppList({
  apps,
  emptyLabel = "No per-app usage logged for this day.",
}: {
  apps: { name: string; category: string; minutes: number; share: number }[];
  emptyLabel?: string;
}) {
  if (!apps.length) {
    return <p className="py-6 text-center text-[0.72rem] text-white/30">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-white/[0.05]">
      {apps.map((app) => (
        <li key={app.name} className="flex items-center gap-2.5 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[0.7rem] font-bold text-white/70">
            {app.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.78rem] font-semibold text-white/85">{app.name}</p>
            <p className="text-[0.58rem] text-white/30">{app.category}</p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, app.share)}%`, background: "#f2995a" }}
              />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[0.75rem] font-semibold tabular-nums text-white/80">{minutesLabel(app.minutes)}</p>
            <p className="text-[0.55rem] text-white/30">{app.share}%</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Weekly screen-time comparison row used by Home and Insights. */
export function CompareRow({
  label,
  minutes,
  maximum,
  accent,
}: {
  label: string;
  minutes: number;
  maximum: number;
  accent: string;
}) {
  const percent = maximum > 0 ? Math.min(100, Math.round((minutes / maximum) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("font-display text-[1.15rem] font-bold text-white")}>{minutesLabel(minutes)}</span>
        <span className="text-[0.6rem] text-white/35">{label}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, background: `linear-gradient(90deg,${withAlpha(accent, 0.6)},${accent})` }}
        />
      </div>
    </div>
  );
}
