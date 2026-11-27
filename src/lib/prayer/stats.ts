/**
 * Pure prayer statistics.
 *
 * Everything here is deliberately free of database access so the same numbers
 * feed the home screen, the heatmap and the weekly review — and can be unit
 * tested against a handful of dates.
 *
 * Two rules from the proposal shape the maths:
 * - An excused day extends the streak. It is never a gap and never a miss.
 * - A missed prayer pauses the streak; the copy says "resumed", not "lost".
 */

import { PRAYER_KEYS } from "./constants";

export interface DaySummary {
  dateKey: string;
  state: string;
  /** Prayers that counted toward this day (0 when excused or in review). */
  applicable: number;
  onTime: number;
  late: number;
  missed: number;
  logged: number;
  /** Every applicable prayer has a log (on time or late). */
  complete: boolean;
  /** Excused days are neutral-positive and keep the streak. */
  excused: boolean;
}

export function emptyDay(dateKey: string): DaySummary {
  return {
    dateKey,
    state: "active",
    applicable: PRAYER_KEYS.length,
    onTime: 0,
    late: 0,
    missed: 0,
    logged: 0,
    complete: false,
    excused: false,
  };
}

/** Shift a "YYYY-MM-DD" key by whole days without timezone surprises. */
export function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** 0 = Monday … 6 = Sunday for a date key. */
export function mondayIndexFromKey(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (weekday + 6) % 7;
}

export function dateKeysBetween(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startKey;
  let guard = 0;
  while (cursor <= endKey && guard < 2000) {
    keys.push(cursor);
    cursor = shiftDateKey(cursor, 1);
    guard += 1;
  }
  return keys;
}

/**
 * Current and longest streaks over a chronological list of days.
 *
 * Today is allowed to be unfinished: an incomplete today starts the count
 * from yesterday rather than resetting it. A missed day stops the run.
 */
export function computeStreak(days: DaySummary[]): { current: number; longest: number } {
  const counted = (day: DaySummary) => day.excused || day.complete;

  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (counted(day)) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  let index = days.length - 1;
  if (index >= 0 && !counted(days[index])) {
    // Today still in progress: look back from yesterday.
    const today = days[index];
    if (today.logged === 0 && today.missed === 0) index -= 1;
  }

  let current = 0;
  for (let i = index; i >= 0; i -= 1) {
    if (!counted(days[i])) break;
    current += 1;
  }

  return { current, longest };
}

export function consistency(days: DaySummary[]): { logged: number; applicable: number; percent: number } {
  const applicable = days.reduce((total, day) => total + day.applicable, 0);
  const logged = days.reduce((total, day) => total + Math.min(day.logged, day.applicable), 0);
  return { logged, applicable, percent: applicable === 0 ? 0 : Math.round((logged / applicable) * 100) };
}

export interface PrayerTally {
  prayer: string;
  onTime: number;
  late: number;
  missed: number;
  applicable: number;
}

/**
 * The prayer that slips most: ranked by missed, then late. Returns null until
 * there is enough history for the observation to mean anything.
 */
export function weakestPrayer(
  tallies: PrayerTally[],
  minimumDays = 5,
): { prayer: string; missed: number; late: number; applicable: number } | null {
  const eligible = tallies.filter((tally) => tally.applicable >= minimumDays);
  if (!eligible.length) return null;

  const ranked = [...eligible].sort((a, b) => {
    if (b.missed !== a.missed) return b.missed - a.missed;
    if (b.late !== a.late) return b.late - a.late;
    return b.applicable - a.applicable;
  });

  const top = ranked[0];
  if (top.missed + top.late === 0) return null;
  return { prayer: top.prayer, missed: top.missed, late: top.late, applicable: top.applicable };
}

export interface HeatmapCell {
  dateKey: string;
  summary: DaySummary | null;
}

export interface HeatmapWeek {
  monthLabel: string | null;
  days: HeatmapCell[];
}

export interface Heatmap {
  weeks: HeatmapWeek[];
  startKey: string;
  endKey: string;
}

/**
 * GitHub-style grid: week columns, Monday-first rows. `weeks` decides how far
 * back the picture reaches; the last column is the week containing today.
 */
export function buildHeatmap(
  summaryByKey: Map<string, DaySummary>,
  todayKey: string,
  weeks = 26,
): Heatmap {
  const mondayIndex = mondayIndexFromKey(todayKey);
  const lastMonday = shiftDateKey(todayKey, -mondayIndex);
  const firstMonday = shiftDateKey(lastMonday, -(weeks - 1) * 7);

  const columns: HeatmapWeek[] = [];
  for (let week = 0; week < weeks; week += 1) {
    const days: HeatmapCell[] = [];
    let monthLabel: string | null = null;

    for (let offset = 0; offset < 7; offset += 1) {
      const dateKey = shiftDateKey(firstMonday, week * 7 + offset);
      if (dateKey > todayKey) {
        days.push({ dateKey, summary: null });
        continue;
      }
      const summary = summaryByKey.get(dateKey) ?? emptyDay(dateKey);
      days.push({ dateKey, summary });
      const dayOfMonth = Number(dateKey.slice(8, 10));
      if (!monthLabel && dayOfMonth <= 7) {
        monthLabel = dateKey;
      }
    }

    columns.push({ monthLabel, days });
  }

  return { weeks: columns, startKey: firstMonday, endKey: todayKey };
}

/** Second grid mode: one row per prayer, one column per week. */
export const PRAYER_ROWS = PRAYER_KEYS;
