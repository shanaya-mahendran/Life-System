import { cn, withAlpha } from "@/lib/utils";
import {
  PRAYER_ACCENT,
  PRAYERS,
  STATUS_META,
  durationLabel,
  minutesToClock,
  prayerLabel,
  type LogStatus,
} from "@/lib/prayer/constants";
import type { PrayerTimeSet } from "@/lib/prayer/times";

interface DailyRingProps {
  times: PrayerTimeSet;
  next: { key: string; start: number; minutesUntil: number; tomorrow: boolean };
  currentKey: string | null;
  /** prayer key → logged status */
  statuses: Partial<Record<string, LogStatus>>;
  size?: number;
  className?: string;
}

/**
 * Five arcs, one per prayer, clockwise from Fajr. Logged arcs fill with their
 * status colour; the arc for the window you are in breathes softly. The centre
 * always answers "what is next, and how long".
 */
export function DailyRing({ times, next, currentKey, statuses, size = 176, className }: DailyRingProps) {
  const stroke = Math.max(8, Math.round(size * 0.055));
  const radius = (size - stroke) / 2 - 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = 62; // degrees per arc
  const step = 360 / PRAYERS.length;
  const arcLength = (sweep / 360) * circumference;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Today's five prayers">
        <defs>
          <filter id="prayer-arc-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {PRAYERS.map((prayer, index) => {
          const status = statuses[prayer.key];
          const active = currentKey === prayer.key && !status;
          const color = status ? STATUS_META[status].color : active ? prayer.hue : "rgba(255,255,255,0.09)";
          const rotation = -90 + index * step + (step - sweep) / 2;

          return (
            <g key={prayer.key} transform={`rotate(${rotation} ${center} ${center})`}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={status ? stroke : Math.max(4, stroke - 3)}
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${circumference - arcLength}`}
                filter={status ? "url(#prayer-arc-glow)" : undefined}
                opacity={status ? 1 : active ? 0.8 : 0.55}
              >
                {active && (
                  <animate
                    attributeName="opacity"
                    values="0.45;0.95;0.45"
                    dur="3.6s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/40">
          {next.tomorrow ? "Tomorrow" : "Next"}
        </span>
        <span
          className="mt-0.5 font-display text-lg font-semibold leading-none"
          style={{ color: withAlpha(PRAYER_ACCENT, 0.95) }}
        >
          {prayerLabel(next.key)}
        </span>
        <span className="mt-1 text-xs tabular-nums text-white/55">{minutesToClock(next.start)}</span>
        <span className="text-[0.68rem] tabular-nums text-white/35">
          in {durationLabel(next.minutesUntil)}
        </span>
      </div>
    </div>
  );
}
