import Link from "next/link";
import { ChevronRight, Clock, Sparkles, Smartphone, Target } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getMindResetOverview } from "@/lib/mindreset/service";
import { minutesLabel } from "@/lib/mindreset/constants";
import { withAlpha } from "@/lib/utils";
import { StatCard } from "@/components/reset/ui";
import { MindResetMascot } from "@/components/mindreset/Mascot";
import { ThrivingRing } from "@/components/mindreset/ThrivingRing";
import { WeekBars } from "@/components/mindreset/WeekBars";
import { AppList, CompareRow, CumulativeCurve } from "@/components/mindreset/charts";
import { LogUsageForm } from "@/components/mindreset/LogUsageForm";

export const dynamic = "force-dynamic";

export default async function MindResetHomePage() {
  const { user } = await requireProfile();
  const overview = await getMindResetOverview(user);

  const { score, today, topApps, status } = overview;
  const band = score.band;
  const todayMinutes = today?.screenMinutes ?? 0;
  const todayAtHour = overview.todayCumulative[overview.currentHour] ?? 0;
  const delta = Math.round(todayAtHour - overview.usualNow);
  const weekMax = Math.max(todayMinutes, overview.weekAvg);

  const statusChip =
    status === "heavier"
      ? {
          text: `Heavier than usual by ${minutesLabel(Math.max(0, delta))}`,
          color: "#fb7185",
        }
      : status === "on-track"
        ? {
            text:
              delta > 0
                ? `${minutesLabel(delta)} ahead of your usual pace`
                : `${minutesLabel(Math.abs(delta))} under your usual pace`,
            color: "#34d399",
          }
        : {
            text: "Baseline building — 14 days makes this personal",
            color: "#a78bfa",
          };

  return (
    <div className="space-y-3">
      <section
        className="relative overflow-hidden rounded-3xl border p-4 sm:p-5"
        style={{
          borderColor: withAlpha("#b9a3f0", 0.24),
          background:
            "linear-gradient(150deg, rgba(122,96,200,0.32) 0%, rgba(120,62,102,0.28) 45%, rgba(19,17,28,0.96) 100%)",
        }}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#f4b6c2]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-[#b9a3f0]/25 blur-3xl" />

        <div className="relative flex flex-wrap items-center gap-3">
          <MindResetMascot mood={today ? band.mood : "cheer"} size={104} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-white/45">
              {today ? "Today's Thriving" : "No usage logged yet"}
            </p>
            <h2 className="mt-1 font-display text-[1.5rem] font-semibold leading-tight text-white">
              {today ? (
                <>
                  You&apos;re <span className="text-[#f8b98c]">{band.label}!</span>
                </>
              ) : (
                "Let's see your first day"
              )}
            </h2>
            <p className="mt-1 max-w-sm text-[0.72rem] leading-relaxed italic text-white/60">
              {today ? `“${band.line}”` : "Add today's totals below and the score, charts and insights all come alive."}
            </p>
          </div>
          <ThrivingRing value={today ? score.score : 0} label={today ? band.label : "No data"} size={112} stroke={10} />
        </div>

        <dl className="relative mt-4 grid grid-cols-3 gap-2">
          {score.components.map((component) => (
            <div key={component.key} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5">
              <dt className="truncate text-[0.52rem] uppercase tracking-[0.1em] text-white/35">{component.label}</dt>
              <dd className="mt-0.5 text-[0.72rem] font-semibold tabular-nums text-white/85">
                {Math.round(component.points)}
                <span className="text-[0.55rem] font-normal text-white/30"> / {component.weight}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Link
        href="/chat"
        className="surface flex items-center gap-2.5 p-3 transition hover:border-[#f2995a]/30"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1e2a6e] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.78rem] font-semibold text-white/85">
            {topApps[0]
              ? `${topApps[0].name} took ${topApps[0].share}% of today`
              : "Ask Mochi about your digital habits"}
          </span>
          <span className="block truncate text-[0.65rem] text-white/35">
            {overview.limits.length
              ? `${overview.limits.filter((limit) => limit.enabled).length} limits active · ask for a change`
              : "Ask the LifeOS agent to set a cap"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
      </Link>

      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Screen time"
          value={minutesLabel(todayMinutes)}
          caption={`Goal ${minutesLabel(overview.settings.goalMinutes)}`}
          icon={<Clock className="h-3.5 w-3.5" />}
          accent="#f2995a"
        />
        <StatCard
          label="Pickups"
          value={today?.pickups ?? 0}
          caption={overview.weekAvg ? `7-day avg ${minutesLabel(overview.weekAvg)}` : "No baseline yet"}
          icon={<Smartphone className="h-3.5 w-3.5" />}
          accent="#b9a3f0"
        />
        <StatCard
          label="Focus time"
          value={minutesLabel(overview.focus.today)}
          caption={`Goal ${minutesLabel(overview.settings.focusGoalMinutes)}`}
          icon={<Target className="h-3.5 w-3.5" />}
          accent="#34d399"
        />
      </div>

      <section className="surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-[0.95rem] font-semibold text-white">Top apps</h2>
          <span className="text-[0.6rem] text-white/30">Today · share of screen time</span>
        </div>
        <div className="mt-1">
          <AppList apps={topApps} />
        </div>
      </section>

      <section className="surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-[0.95rem] font-semibold text-white">Last 7 days</h2>
          <span className="text-[0.62rem]" style={{ color: withAlpha("#f2995a", 0.9) }}>
            Average {overview.weekAvg ? minutesLabel(overview.weekAvg) : "—"}
          </span>
        </div>
        <div className="mt-3">
          <WeekBars data={overview.week} avg={overview.weekAvg} activeKey={overview.todayKey} />
        </div>
      </section>

      <section className="surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[0.95rem] font-semibold text-white">Today vs your usual</h2>
        </div>
        <span
          className="mt-2 inline-block rounded-full px-2.5 py-1 text-[0.63rem] font-semibold"
          style={{ backgroundColor: withAlpha(statusChip.color, 0.14), color: withAlpha(statusChip.color, 0.95) }}
        >
          {statusChip.text}
        </span>
        <CumulativeCurve today={overview.todayCumulative} usual={overview.usual} currentHour={overview.currentHour} className="mt-3" />
        <div className="mt-2 flex flex-wrap gap-3 text-[0.65rem] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f2995a]" /> Today{" "}
            <b className="font-semibold text-white/70">{minutesLabel(todayAtHour)}</b>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#9b8bf0]" /> Usual{" "}
            <b className="font-semibold text-white/70">{overview.usualNow ? minutesLabel(overview.usualNow) : "—"}</b>
          </span>
        </div>
      </section>

      <section className="surface p-4">
        <h2 className="font-display text-[0.95rem] font-semibold text-white">Today vs your 7-day average</h2>
        <div className="mt-3 space-y-3">
          <CompareRow
            label="Today"
            minutes={todayMinutes}
            maximum={Math.max(weekMax, overview.settings.goalMinutes)}
            accent="#f2995a"
          />
          <CompareRow
            label="7-day average"
            minutes={overview.weekAvg}
            maximum={Math.max(weekMax, overview.settings.goalMinutes)}
            accent="#9b8bf0"
          />
        </div>
        {overview.weekAvg > 0 && today && (
          <p className="mt-2.5 text-[0.66rem] text-white/40">
            {todayMinutes <= overview.weekAvg
              ? `${Math.round(((overview.weekAvg - todayMinutes) / overview.weekAvg) * 100)}% less screen time than your week.`
              : `${Math.round(((todayMinutes - overview.weekAvg) / overview.weekAvg) * 100)}% more screen time than your week.`}
          </p>
        )}
      </section>

      <details className="surface p-4">
        <summary className="cursor-pointer list-none text-[0.85rem] font-semibold text-white marker:hidden">
          How today&apos;s score was built
        </summary>
        <ul className="mt-3 space-y-2">
          {score.components.map((component) => (
            <li key={component.key}>
              <div className="flex items-baseline justify-between gap-2 text-[0.7rem]">
                <span className="text-white/70">{component.label}</span>
                <span className="tabular-nums text-white/45">
                  {Math.round(component.points)} / {component.weight}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[#f2995a]"
                  style={{ width: `${Math.round(component.quality * 100)}%` }}
                />
              </div>
              <p className="mt-0.5 text-[0.58rem] text-white/25">{component.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[0.6rem] leading-relaxed text-white/30">{score.summary}</p>
      </details>

      <LogUsageForm todayKey={overview.todayKey} initial={overview.today} defaultOpen={!today} />
    </div>
  );
}
