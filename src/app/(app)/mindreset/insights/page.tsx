import Link from "next/link";
import { BarChart3, Clock, Moon, Target, Timer } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getMindResetOverview } from "@/lib/mindreset/service";
import { hourLabel, minutesLabel } from "@/lib/mindreset/constants";
import { cn, withAlpha } from "@/lib/utils";
import { StatCard } from "@/components/reset/ui";
import { WeekBars } from "@/components/mindreset/WeekBars";
import { AppList, HourlyBars } from "@/components/mindreset/charts";

export const dynamic = "force-dynamic";

export default async function MindResetInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const { user } = await requireProfile();
  const overview = await getMindResetOverview(user);

  const tab = params.tab === "focus" ? "focus" : "screen";
  const selected =
    overview.recentDays.find((day) => day.dateKey === params.day) ??
    overview.today ??
    overview.recentDays[overview.recentDays.length - 1] ??
    null;

  const peakIndex = selected
    ? selected.hours.reduce((best, value, index) => (value > selected.hours[best] ? index : best), 0)
    : 0;
  const peakHour = selected && selected.hours[peakIndex] > 0 ? peakIndex : null;
  const appTotal = selected?.apps.reduce((sum, app) => sum + app.minutes, 0) ?? 0;
  const appsWithShare =
    selected?.apps
      .slice()
      .sort((a, b) => b.minutes - a.minutes)
      .map((app) => ({
        ...app,
        share: appTotal > 0 ? Math.round((app.minutes / appTotal) * 1000) / 10 : 0,
      })) ?? [];

  const tabHref = (next: "screen" | "focus") =>
    `/mindreset/insights?tab=${next}${selected ? `&day=${selected.dateKey}` : ""}`;

  return (
    <div className="space-y-3">
      <div className="flex rounded-full border border-white/[0.07] bg-white/[0.025] p-1">
        {(
          [
            ["screen", "Screen time", BarChart3],
            ["focus", "Focus time", Timer],
          ] as const
        ).map(([key, label, Icon]) => (
          <Link
            key={key}
            href={tabHref(key)}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full text-[0.76rem] font-semibold transition",
              tab === key ? "bg-[#1e2a6e] text-white" : "text-white/45 hover:text-white/75",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </div>

      {tab === "screen" ? (
        <>
          <section className="surface p-4">
            <div className="flex items-center justify-between gap-2 overflow-x-auto">
              {overview.week.map((day) => {
                const active = selected?.dateKey === day.dateKey;
                return (
                  <Link
                    key={day.dateKey}
                    href={`/mindreset/insights?tab=screen&day=${day.dateKey}`}
                    className="flex min-w-[2.2rem] flex-col items-center gap-1"
                  >
                    <span className="text-[0.55rem] text-white/30">{day.label}</span>
                    <span
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full text-[0.7rem] font-semibold transition",
                        active ? "bg-[#1e2a6e] text-white" : "bg-white/[0.04] text-white/55 hover:bg-white/[0.08]",
                        !day.logged && "opacity-45",
                      )}
                    >
                      {day.dateKey.slice(8, 10)}
                    </span>
                  </Link>
                );
              })}
            </div>

            <p className="mt-3 text-[0.62rem] uppercase tracking-[0.14em] text-white/30">
              {selected
                ? new Date(`${selected.dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })
                : "No day selected"}
            </p>
            <p className="font-display text-[2.6rem] font-bold leading-none text-white">
              {selected ? Math.floor(selected.screenMinutes / 60) : 0}
              <span className="text-[1.1rem] font-semibold text-white/40">h </span>
              {selected ? selected.screenMinutes % 60 : 0}
              <span className="text-[1.1rem] font-semibold text-white/40">m</span>
            </p>
            {selected && (
              <p className="mt-1 text-[0.65rem] text-white/35">
                Thriving {selected.score}% · {selected.band.label} · {selected.pickups} pickups
              </p>
            )}

            <div className="mt-3">
              <WeekBars data={overview.week} avg={overview.weekAvg} activeKey={selected?.dateKey} />
            </div>
          </section>

          <section className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[0.95rem] font-semibold text-white">Hourly breakdown</h2>
              {peakHour !== null && (
                <span
                  className="rounded-full px-2.5 py-1 text-[0.62rem] font-semibold"
                  style={{ backgroundColor: "rgba(242,153,90,0.14)", color: "#f8c69f" }}
                >
                  Most active {hourLabel(peakHour)} – {hourLabel(peakHour + 1)}
                </span>
              )}
            </div>
            {selected && peakHour !== null ? (
              <>
                <HourlyBars hours={selected.hours} peakHour={peakHour} />
                <p className="mt-2 text-[0.62rem] leading-relaxed text-white/30">
                  Average {minutesLabel(Math.round(selected.screenMinutes / 24))} an hour across the day.
                </p>
              </>
            ) : (
              <p className="py-6 text-center text-[0.72rem] text-white/30">
                No hourly split for this day. Add it from the Home screen&apos;s usage form, or let the Android bridge
                sync it.
              </p>
            )}
          </section>

          <section className="surface p-4">
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Top apps</h2>
            <div className="mt-1">
              <AppList apps={appsWithShare} emptyLabel="No per-app usage for this day." />
            </div>
          </section>

          {selected && selected.nightMinutes > 0 && (
            <section
              className="flex items-start gap-2.5 rounded-2xl border p-3.5"
              style={{ borderColor: withAlpha("#fb7185", 0.22), backgroundColor: withAlpha("#fb7185", 0.07) }}
            >
              <Moon className="mt-0.5 h-4 w-4 shrink-0 text-rose-200/80" />
              <p className="text-[0.7rem] leading-relaxed text-white/55">
                {minutesLabel(selected.nightMinutes)} of use after your bedtime lowered the late-night part of the
                score.{" "}
                <Link href="/mindreset/limits" className="font-semibold text-rose-200/90 underline-offset-2 hover:underline">
                  Add a Bedtime limit?
                </Link>
              </p>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatCard
              label="Today"
              value={minutesLabel(overview.focus.today)}
              caption={`Goal ${minutesLabel(overview.settings.focusGoalMinutes)}`}
              icon={<Clock className="h-3.5 w-3.5" />}
              accent="#34d399"
            />
            <StatCard
              label="Longest"
              value={minutesLabel(overview.focus.longest)}
              caption="Single uninterrupted block"
              icon={<Timer className="h-3.5 w-3.5" />}
              accent="#38bdf8"
            />
            <StatCard
              label="Lifetime"
              value={minutesLabel(overview.focus.lifetime)}
              caption={`${overview.focus.sessions} session${overview.focus.sessions === 1 ? "" : "s"}`}
              icon={<Target className="h-3.5 w-3.5" />}
              accent="#a78bfa"
            />
          </div>

          <section className="surface p-4">
            <h2 className="font-display text-[0.95rem] font-semibold text-white">Reflective pauses</h2>
            <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/35">
              Every blocked open asks one question. How often you choose to go back is the limit-adherence part of
              your score.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                <p className="font-display text-[1.05rem] font-bold text-white">{overview.pauses.today}</p>
                <p className="text-[0.58rem] text-white/30">Today</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                <p className="font-display text-[1.05rem] font-bold text-white">
                  {overview.pauses.goBackRate === null ? "—" : `${Math.round(overview.pauses.goBackRate * 100)}%`}
                </p>
                <p className="text-[0.58rem] text-white/30">Went back · 14 days</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
                <p className="font-display text-[1.05rem] font-bold text-white">{overview.pauses.total}</p>
                <p className="text-[0.58rem] text-white/30">Pauses · 14 days</p>
              </div>
            </div>
          </section>

          {overview.focus.today === 0 ? (
            <section className="rounded-2xl border border-dashed border-white/10 px-4 py-9 text-center">
              <Timer className="mx-auto h-6 w-6 text-white/20" />
              <p className="mt-2 text-[0.86rem] font-semibold text-white/65">Let&apos;s heal your brain</p>
              <p className="mx-auto mt-1 max-w-sm text-[0.72rem] leading-relaxed text-white/30">
                Your first focus session is a few taps away. Even five minutes counts.
              </p>
              <Link href="/mindreset/focus" className="btn btn-primary mt-3 text-[0.74rem]">
                Start a focus session
              </Link>
            </section>
          ) : (
            <section className="surface flex flex-wrap items-center gap-3 p-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/12 text-emerald-200">
                <Timer className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.8rem] font-semibold text-white/85">
                  {minutesLabel(overview.focus.today)} focused today
                </p>
                <p className="text-[0.63rem] text-white/35">
                  {overview.focus.today >= overview.settings.focusGoalMinutes
                    ? "Focus goal met — the proud mascot is earned."
                    : `${minutesLabel(overview.settings.focusGoalMinutes - overview.focus.today)} to today's goal.`}
                </p>
              </div>
              <Link href="/mindreset/focus" className="btn btn-ghost text-[0.72rem]">
                One more session
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
