/**
 * Thriving score engine.
 *
 * Weights follow the proposal: screen time 40, pickups 15, late-night use 15,
 * focus bonus 20, limit adherence 10. Everything is computed against the
 * user's own baseline, never an absolute target. Pure functions only so the
 * numbers can be tested without a database.
 */

import { clamp } from "@/lib/utils";
import { type ThrivingBand, thrivingBand } from "./constants";

export interface ThrivingDay {
  screenMinutes: number;
  pickups: number;
  nightMinutes: number;
  focusMinutes: number;
}

export interface ThrivingInput {
  day: ThrivingDay;
  /** Daily screen-time goal in minutes. */
  goalMinutes: number;
  /** Daily focus goal in minutes. */
  focusGoalMinutes: number;
  /** 14-day median pickup count, or null when there is not enough history. */
  medianPickups: number | null;
  /** Share of reflective pauses that ended in "Go back", 0–1, or null. */
  goBackRate: number | null;
}

export interface ThrivingComponent {
  key: "screen" | "pickups" | "night" | "focus" | "adherence";
  label: string;
  weight: number;
  /** 0–1 quality for this component. */
  quality: number;
  points: number;
  detail: string;
}

export interface ThrivingResult {
  score: number;
  components: ThrivingComponent[];
  band: ThrivingBand;
  /** Short factual explanation built from the components. */
  summary: string;
}

const WEIGHTS = {
  screen: 40,
  pickups: 15,
  night: 15,
  focus: 20,
  adherence: 10,
} as const;

export function computeThriving(input: ThrivingInput): ThrivingResult {
  const goal = Math.max(30, input.goalMinutes || 240);
  const focusGoal = Math.max(5, input.focusGoalMinutes || 30);
  const { screenMinutes, pickups, nightMinutes, focusMinutes } = input.day;

  // 100% at or under the goal, falling linearly to 0 at twice the goal.
  const screenRatio = screenMinutes / goal;
  const screenQuality = clamp(1 - Math.max(0, screenRatio - 1), 0, 1);

  // 100% at the median, 0 at twice the median.
  const pickupQuality =
    input.medianPickups && input.medianPickups > 0
      ? clamp(2 - pickups / input.medianPickups, 0, 1)
      : 1;

  // Share of screen time spent between bedtime and wake time.
  const nightRatio = screenMinutes > 0 ? clamp(nightMinutes / screenMinutes, 0, 1) : 0;
  const nightQuality = 1 - nightRatio;

  const focusQuality = clamp(focusMinutes / focusGoal, 0, 1);
  const adherenceQuality = input.goBackRate === null ? 1 : clamp(input.goBackRate, 0, 1);

  const components: ThrivingComponent[] = [
    {
      key: "screen",
      label: "Screen time vs goal",
      weight: WEIGHTS.screen,
      quality: screenQuality,
      points: WEIGHTS.screen * screenQuality,
      detail: `${Math.round(screenMinutes)}m against a ${goal}m goal`,
    },
    {
      key: "pickups",
      label: "Pickups",
      weight: WEIGHTS.pickups,
      quality: pickupQuality,
      points: WEIGHTS.pickups * pickupQuality,
      detail: input.medianPickups
        ? `${pickups} today · ${input.medianPickups} usual`
        : `${pickups} today · baseline still forming`,
    },
    {
      key: "night",
      label: "Late-night use",
      weight: WEIGHTS.night,
      quality: nightQuality,
      points: WEIGHTS.night * nightQuality,
      detail: nightMinutes > 0 ? `${Math.round(nightMinutes)}m after bedtime` : "No late-night use",
    },
    {
      key: "focus",
      label: "Focus bonus",
      weight: WEIGHTS.focus,
      quality: focusQuality,
      points: WEIGHTS.focus * focusQuality,
      detail: `${Math.round(focusMinutes)}m of ${focusGoal}m focus`,
    },
    {
      key: "adherence",
      label: "Limit adherence",
      weight: WEIGHTS.adherence,
      quality: adherenceQuality,
      points: WEIGHTS.adherence * adherenceQuality,
      detail:
        input.goBackRate === null
          ? "No pauses logged yet"
          : `${Math.round(input.goBackRate * 100)}% of pauses ended in Go back`,
    },
  ];

  const score = clamp(Math.round(components.reduce((sum, component) => sum + component.points, 0)), 0, 100);
  const band = thrivingBand(score);

  return {
    score,
    components,
    band,
    summary: `${band.label} · ${Math.round(screenMinutes)}m on screen, ${Math.round(focusMinutes)}m focused.`,
  };
}

/** Median of a list of numbers; null for an empty list. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

/** Mean of a list; null for an empty list. */
export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Normalise an unknown Json column into exactly 24 hour buckets. */
export function normalizeHours(value: unknown): number[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: 24 }, (_, hour) => {
    const raw = Number(source[hour]);
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  });
}

/** Cumulative minutes at the end of each hour, for the "today vs usual" curve. */
export function cumulativeHours(hours: number[]): number[] {
  let running = 0;
  return hours.map((value) => {
    running += value;
    return running;
  });
}

/** Mean cumulative curve across the supplied days' hour buckets. */
export function usualCurve(daysHours: number[][]): number[] {
  if (!daysHours.length) return Array.from({ length: 24 }, () => 0);
  const normalised = daysHours.map(cumulativeHours);
  return Array.from({ length: 24 }, (_, hour) =>
    Math.round(normalised.reduce((sum, curve) => sum + curve[hour], 0) / normalised.length),
  );
}

export type UsageStatus = "heavier" | "on-track" | "unknown";

/** Compares today's cumulative use at this hour with the usual curve. */
export function usageStatus(
  todayHours: number[],
  usual: number[],
  hour: number,
): { status: UsageStatus; todayMinutes: number; usualMinutes: number } {
  const safeHour = clamp(hour, 0, 23);
  const todayMinutes = cumulativeHours(todayHours)[safeHour] ?? 0;
  const usualMinutes = usual[safeHour] ?? 0;
  if (usualMinutes < 15) return { status: "unknown", todayMinutes, usualMinutes };
  return {
    status: todayMinutes > usualMinutes * 1.1 ? "heavier" : "on-track",
    todayMinutes,
    usualMinutes,
  };
}

/**
 * Minutes "ahead of" or "behind" the usual curve at this hour, for the
 * Home and Insights status lines.
 */
export function usageDelta(todayMinutes: number, usualMinutes: number): number {
  return Math.round(todayMinutes - usualMinutes);
}
