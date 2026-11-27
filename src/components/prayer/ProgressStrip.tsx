import { cn, withAlpha } from "@/lib/utils";
import { PRAYERS, STATUS_META, type LogStatus } from "@/lib/prayer/constants";

interface ProgressStripProps {
  statuses: Partial<Record<string, LogStatus>>;
  excused?: boolean;
  weekLogged: number;
  weekApplicable: number;
  className?: string;
}

/** Five thin segments for today, plus the week's applicable count. */
export function ProgressStrip({
  statuses,
  excused,
  weekLogged,
  weekApplicable,
  className,
}: ProgressStripProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5" role="img" aria-label={`${weekLogged} of ${weekApplicable} prayers this week`}>
        {PRAYERS.map((prayer) => {
          const status = statuses[prayer.key];
          return (
            <span
              key={prayer.key}
              className="h-1.5 flex-1 rounded-full"
              title={`${prayer.label}${status ? ` · ${STATUS_META[status].label}` : " · not logged"}`}
              style={{
                backgroundColor: excused
                  ? withAlpha("#b3a9d0", 0.35)
                  : status
                    ? STATUS_META[status].color
                    : "rgba(255,255,255,0.09)",
              }}
            />
          );
        })}
      </div>
      <p className="text-xs text-white/40">
        {excused
          ? "Excused today · nothing counted as missed"
          : weekApplicable > 0
            ? `This week ${weekLogged} of ${weekApplicable} applicable`
            : "This week has no applicable prayers yet"}
      </p>
    </div>
  );
}
