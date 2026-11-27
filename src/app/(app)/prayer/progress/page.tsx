import Link from "next/link";
import { CalendarCheck, Flame, Moon, ShieldCheck } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getDayDetail, getPrayerLogIndex, getPrayerOverview } from "@/lib/prayer/service";
import { buildHeatmap } from "@/lib/prayer/stats";
import {
  PRAYER_ACCENT,
  STATUS_META,
  dateKeyLabel,
  dayStateMeta,
  durationLabel,
  prayerLabel,
  windowLabel,
  type LogStatus,
} from "@/lib/prayer/constants";
import { withAlpha } from "@/lib/utils";
import { StatCard } from "@/components/reset/ui";
import { PrayerHeatmap, PrayerRows } from "@/components/prayer/heatmap";

export const dynamic = "force-dynamic";

export default async function PrayerProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { user } = await requireProfile();
  const overview = await getPrayerOverview(user);
  const params = await searchParams;

  const requested = params.day;
  const selectedKey =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= overview.todayKey ? requested : undefined;

  const summaryByKey = new Map(overview.summaries.map((summary) => [summary.dateKey, summary]));
  const yearHeatmap = buildHeatmap(summaryByKey, overview.todayKey, 53);
  const rowsHeatmap = buildHeatmap(summaryByKey, overview.todayKey, 26);
  const logIndex = await getPrayerLogIndex(user.id, rowsHeatmap.startKey);
  const detail = selectedKey ? await getDayDetail(user, selectedKey) : null;

  const statusByPrayer = new Map(detail?.logs.map((log) => [log.prayer, log.status as LogStatus]) ?? []);
  const detailState = detail ? dayStateMeta(detail.state) : null;
  const weekRemaining = Math.max(0, overview.stats.weekApplicable - overview.stats.weekLogged);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Last 30 days"
          value={`${overview.stats.consistency}%`}
          caption={`${overview.stats.monthLogged} of ${overview.stats.monthApplicable} applicable prayers`}
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          accent={PRAYER_ACCENT}
        />
        <StatCard
          label="Longest steady"
          value={overview.stats.longestStreak > 0 ? `${overview.stats.longestStreak}d` : "—"}
          caption={`Current run ${overview.stats.currentStreak} day${overview.stats.currentStreak === 1 ? "" : "s"}`}
          icon={<Flame className="h-3.5 w-3.5" />}
          accent="#d9c9a3"
        />
        <StatCard
          label="Excused days"
          value={overview.stats.excusedDays}
          caption="Counted as steady, never as missed"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          accent="#b3a9d0"
        />
      </div>

      <section className="surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-[0.98rem] font-semibold text-white">The long view</h2>
            <p className="text-xs text-white/35">
              {overview.stats.currentStreak > 0
                ? `${overview.stats.currentStreak} day${overview.stats.currentStreak === 1 ? "" : "s"} steady. One gap does not undo the rest.`
                : "Steadiness, not perfection. Every cell is just information."}
            </p>
          </div>
          <span className="text-[0.6rem] text-white/30">Tap a day</span>
        </div>
        <div className="mt-3">
          <PrayerHeatmap heatmap={yearHeatmap} selectedKey={selectedKey} />
        </div>
      </section>

      {detail && detailState && (
        <section
          className="surface p-4"
          style={{ borderColor: withAlpha(detailState.color, 0.25) }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-[0.95rem] font-semibold text-white">{dateKeyLabel(detail.dateKey)}</h2>
              <p className="text-xs text-white/35">
                {detailState.label} day
                {detail.note ? ` · ${detail.note}` : ""}
              </p>
            </div>
            <Link href="/prayer/progress" className="btn btn-quiet text-[0.7rem]">
              Close
            </Link>
          </div>

          <p className="mt-1.5 text-[0.7rem] leading-relaxed text-white/45">{detailState.summary}</p>

          <ul className="mt-2.5 divide-y divide-white/[0.06]">
            {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as const).map((key, index) => {
              const status = statusByPrayer.get(key);
              const meta = status ? STATUS_META[status] : null;
              const start = [detail.times.fajr, detail.times.dhuhr, detail.times.asr, detail.times.maghrib, detail.times.isha][index];
              const end = [detail.times.sunrise, detail.times.asr, detail.times.maghrib, detail.times.isha, 1440][index];
              return (
                <li key={key} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-white/85">{prayerLabel(key)}</span>
                    <span className="block text-[0.64rem] tabular-nums text-white/30">{windowLabel(start, end)}</span>
                  </span>
                  <span
                    className="chip shrink-0 border"
                    style={
                      meta
                        ? { borderColor: withAlpha(meta.color, 0.3), backgroundColor: withAlpha(meta.color, 0.1), color: meta.color }
                        : { borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.4)" }
                    }
                  >
                    {meta ? meta.label : detail.summary.applicable === 0 ? "Not counted" : "No record"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-[0.98rem] font-semibold text-white">Prayer by prayer</h2>
            <p className="text-xs text-white/35">Half a year, one row each — the shape of the week shows up here.</p>
          </div>
        </div>
        <div className="mt-3">
          <PrayerRows heatmap={rowsHeatmap} logsByKey={logIndex} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[0.6rem] text-white/35">
          {(["on_time", "late", "missed"] as const).map((status) => (
            <span key={status} className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: withAlpha(STATUS_META[status].color, 0.75) }} />
              {STATUS_META[status].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-white/[0.045]" />
            No record
          </span>
        </div>
      </section>

      <section className="surface p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#123a2f] text-[#9fe0c9]">
            <Moon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-[0.95rem] font-semibold text-white">This week</h2>
            <p className="text-[0.68rem] text-white/35">A ten-second summary, no score.</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Logged", value: `${overview.stats.weekLogged}` },
            { label: "Applicable", value: `${overview.stats.weekApplicable}` },
            { label: "Still ahead", value: `${weekRemaining}` },
            { label: "Qada owed", value: `${Math.max(0, overview.qadaOwed - overview.qadaCompleted)}` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
              <p className="text-[0.55rem] uppercase tracking-[0.12em] text-white/30">{item.label}</p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div
          className="mt-3 rounded-xl border p-3"
          style={{ borderColor: withAlpha(PRAYER_ACCENT, 0.22), backgroundColor: withAlpha(PRAYER_ACCENT, 0.06) }}
        >
          <p className="text-xs font-semibold text-[#9fe0c9]">
            {overview.weakest
              ? `${prayerLabel(overview.weakest.prayer)} is the one that slips most`
              : "No weak spot stands out yet"}
          </p>
          <p className="mt-1 text-[0.7rem] leading-relaxed text-white/50">
            {overview.weakest
              ? `${overview.weakest.missed} missed and ${overview.weakest.late} late over four weeks, out of ${overview.weakest.applicable} applicable. One idea: a gentle reminder ${durationLabel(15)} before the ${prayerLabel(overview.weakest.prayer)} window closes.`
              : "Keep logging for a week or two and this card will name the prayer that needs a little care — kindly."}
          </p>
        </div>

        <p className="mt-2.5 text-[0.62rem] leading-relaxed text-white/25">
          A missed prayer is data, not a verdict. Nothing here is shared, ranked or compared with anyone.
        </p>
      </section>
    </div>
  );
}
