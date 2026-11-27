import Link from "next/link";
import { ArrowRight, Flame, ListChecks, Sparkles, Target } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getPrayerOverview } from "@/lib/prayer/service";
import {
  EXTRAS,
  PRAYER_ACCENT,
  dateKeyLabel,
  dayStateMeta,
  durationLabel,
  minutesToClock,
  prayerLabel,
  windowLabel,
  type LogStatus,
} from "@/lib/prayer/constants";
import { withAlpha } from "@/lib/utils";
import { StatCard } from "@/components/reset/ui";
import { DailyRing } from "@/components/prayer/DailyRing";
import { ProgressStrip } from "@/components/prayer/ProgressStrip";
import { PrayerBoard } from "@/components/prayer/PrayerBoard";
import { StateBanner } from "@/components/prayer/StateBanner";

export const dynamic = "force-dynamic";

export default async function PrayerHomePage() {
  const { user } = await requireProfile();
  const overview = await getPrayerOverview(user);

  const statuses: Record<string, LogStatus | undefined> = {};
  const extrasStatuses: Record<string, LogStatus | undefined> = {};
  for (const log of overview.logs) {
    if (log.category === "fard") statuses[log.prayer] = log.status;
    else extrasStatuses[log.prayer] = log.status;
  }

  const extras = EXTRAS.filter((extra) =>
    extra.key === "sunnah" ? overview.settings.trackSunnah : overview.settings.trackWitr,
  );

  const state = dayStateMeta(overview.todayState.state);
  const dueLater = overview.today.applicable - overview.today.logged;
  const streakLine =
    overview.stats.currentStreak > 0
      ? `${overview.stats.currentStreak} day${overview.stats.currentStreak === 1 ? "" : "s"} steady`
      : "A fresh start counts";

  return (
    <div className="space-y-3">
      <StateBanner
        dateKey={overview.todayState.dateKey}
        state={overview.todayState.state}
        source={overview.todayState.source}
        note={overview.todayState.note}
      />

      <section
        className="relative overflow-hidden rounded-2xl border p-4"
        style={{
          borderColor: withAlpha(PRAYER_ACCENT, 0.22),
          background: `linear-gradient(150deg, ${withAlpha("#0f6b57", 0.35)} 0%, rgba(28,33,29,0.75) 45%, rgba(19,17,28,0.97) 100%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#3db596]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[#d9c9a3]/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center gap-4">
          <DailyRing
            times={overview.times}
            next={overview.next}
            currentKey={overview.currentKey}
            statuses={statuses}
            size={168}
          />

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/45">
                {dateKeyLabel(overview.todayKey)} · {overview.settings.locationLabel}
              </p>
              <h2 className="mt-1 font-display text-[1.35rem] font-semibold leading-tight text-white">
                {overview.todayState.state === "excused" ? (
                  <>Nothing is counted today.</>
                ) : overview.today.complete ? (
                  <>
                    All five kept. <span className="text-[#9fe0c9]">Alhamdulillah.</span>
                  </>
                ) : overview.today.logged > 0 ? (
                  <>
                    {overview.today.logged} of {overview.today.applicable} logged
                    {dueLater > 0 ? ` · ${dueLater} still ahead` : ""}
                  </>
                ) : (
                  <>A quiet day to begin.</>
                )}
              </h2>
              <p className="mt-1 max-w-sm text-[0.72rem] leading-relaxed italic text-white/55">
                {state.keepStreak
                  ? "Excused today. Your streak is safe, and no qada is added."
                  : state.countsApplicable
                    ? `Next is ${prayerLabel(overview.next.key)} at ${minutesToClock(overview.next.start)}${
                        overview.next.tomorrow ? " tomorrow" : ""
                      }, in ${durationLabel(overview.next.minutesUntil)}.`
                    : state.summary}
              </p>
            </div>

            <ProgressStrip
              statuses={statuses}
              excused={overview.todayState.state === "excused"}
              weekLogged={overview.stats.weekLogged}
              weekApplicable={overview.stats.weekApplicable}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Steady"
          value={overview.stats.currentStreak > 0 ? `${overview.stats.currentStreak}d` : "—"}
          caption={streakLine}
          icon={<Flame className="h-3.5 w-3.5" />}
          accent={PRAYER_ACCENT}
        />
        <StatCard
          label="30 days"
          value={`${overview.stats.consistency}%`}
          caption={`${overview.stats.monthLogged} of ${overview.stats.monthApplicable} applicable`}
          icon={<Target className="h-3.5 w-3.5" />}
          accent="#d9c9a3"
        />
        <StatCard
          label="Qada"
          value={overview.qadaOwed > 0 ? `${Math.max(0, overview.qadaOwed - overview.qadaCompleted)}` : "0"}
          caption={overview.qadaOwed > 0 ? `${overview.qadaCompleted} of ${overview.qadaOwed} made up` : "Nothing owed"}
          icon={<ListChecks className="h-3.5 w-3.5" />}
          accent="#6bb9c9"
        />
      </div>

      <PrayerBoard
        dateKey={overview.todayKey}
        windows={overview.windows}
        statuses={statuses}
        currentKey={overview.currentKey}
        adapted={overview.todayState.state === "adapted"}
        extras={extras}
        extrasStatuses={extrasStatuses}
      />

      <Link
        href="/prayer/progress"
        className="surface flex items-center gap-2.5 p-3 transition hover:border-[#3db596]/30"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#123a2f] text-[#9fe0c9]">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.78rem] font-semibold text-white/85">
            {overview.weakest
              ? `${prayerLabel(overview.weakest.prayer)} slips most lately`
              : "See the long view"}
          </span>
          <span className="block truncate text-[0.65rem] text-white/35">
            {overview.weakest
              ? `${overview.weakest.missed} missed and ${overview.weakest.late} late in four weeks. Shall we protect it?`
              : "A heatmap of the last year, and the prayer that needs a little care."}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-white/30" />
      </Link>

      <p className="px-1 text-[0.62rem] leading-relaxed text-white/25">
        {overview.settings.method.toUpperCase()} calculation · Asr {overview.settings.asrMethod === "hanafi" ? "Hanafi" : "standard"} ·
        Fajr {minutesToClock(overview.times.fajr)}, Isha {minutesToClock(overview.times.isha)}.{" "}
        {overview.next.tomorrow
          ? `Tomorrow's Fajr is at ${minutesToClock(overview.times.fajr)}.`
          : `${prayerLabel(overview.currentKey ?? overview.next.key)} window: ${
              overview.currentKey
                ? windowLabel(
                    overview.windows.find((window) => window.key === overview.currentKey)?.start ?? 0,
                    overview.windows.find((window) => window.key === overview.currentKey)?.end ?? 0,
                  )
                : "—"
            }.`}{" "}
        Times are guidance; follow your local mosque if it differs.
      </p>
    </div>
  );
}
