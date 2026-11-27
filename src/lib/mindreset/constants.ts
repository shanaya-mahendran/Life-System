/**
 * Shared MindReset constants.
 *
 * The MindReset theme is a layer on top of the LifeOS tokens: lavender and
 * coral for the module's own surfaces, burnt orange for the Thriving ring and
 * today's bar, violet for the week chart.
 */

export const MIND_RESET_ACCENT = "#f2995a";
export const MIND_RESET_LAVENDER = "#b9a3f0";
export const MIND_RESET_PINK = "#f4b6c2";
export const MIND_RESET_NAVY = "#1e2a6e";

export type ThrivingMood = "calm" | "cheer" | "tired" | "proud";

export interface ThrivingBand {
  /** Inclusive lower bound of the band. */
  min: number;
  label: string;
  mood: ThrivingMood;
  line: string;
  accent: string;
}

/** Bands run high to low; the first one whose `min` the score meets wins. */
export const THRIVING_BANDS: ThrivingBand[] = [
  {
    min: 80,
    label: "Thriving",
    mood: "calm",
    line: "You're keeping it light today. Keep it up.",
    accent: "#f2995a",
  },
  {
    min: 60,
    label: "Steady",
    mood: "proud",
    line: "Good pace. A short break would help.",
    accent: "#a78bfa",
  },
  {
    min: 40,
    label: "Drifting",
    mood: "cheer",
    line: "Heavier than usual. Want a focus session?",
    accent: "#fbbf24",
  },
  {
    min: 0,
    label: "Overloaded",
    mood: "tired",
    line: "Rough day. Let's reset tonight.",
    accent: "#fb7185",
  },
];

export function thrivingBand(score: number): ThrivingBand {
  return THRIVING_BANDS.find((band) => score >= band.min) ?? THRIVING_BANDS[THRIVING_BANDS.length - 1];
}

export const FOCUS_PRESETS = [15, 30, 60] as const;

export const PAUSE_CHIPS = ["I'm bored", "Habit", "Stressed", "Need a break"] as const;

export const MOOD_TAGS = [
  { value: "bored", label: "Bored" },
  { value: "habit", label: "Habit" },
  { value: "stressed", label: "Stressed" },
  { value: "break", label: "Need a break" },
] as const;

export type LimitType = "cap" | "schedule" | "budget" | "preset";

export const LIMIT_TYPE_LABEL: Record<LimitType, string> = {
  cap: "Daily cap",
  schedule: "Schedule block",
  budget: "Shared budget",
  preset: "Preset",
};

export interface PresetConfig {
  name: "Bedtime" | "Work Focus" | "Brick Mode";
  summary: string;
  minutes: number | null;
  startMinute: number | null;
  endMinute: number | null;
  days: number[];
  strict: boolean;
}

/** Starter presets offered on the Limits screen. */
export const PRESETS: PresetConfig[] = [
  {
    name: "Bedtime",
    summary: "Blocks from 11 PM, linked to Sleep",
    minutes: null,
    startMinute: 23 * 60,
    endMinute: 6 * 60,
    days: [0, 1, 2, 3, 4, 5, 6],
    strict: false,
  },
  {
    name: "Work Focus",
    summary: "Weekdays 9 AM – 5 PM",
    minutes: null,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
    days: [1, 2, 3, 4, 5],
    strict: false,
  },
  {
    name: "Brick Mode",
    summary: "Locks all but calls",
    minutes: null,
    startMinute: null,
    endMinute: null,
    days: [0, 1, 2, 3, 4, 5, 6],
    strict: true,
  },
];

export const APP_CATEGORIES = ["Social", "Entertainment", "Other", "Productivity", "Learning"] as const;

export const MAX_UPLOAD_APPS = 12;

/** 1440 → "1h 24m" style, kept here so pages share one format. */
export function minutesLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function hourLabel(hour: number): string {
  const safe = ((hour % 24) + 24) % 24;
  if (safe === 0) return "12 AM";
  if (safe === 12) return "12 PM";
  return safe < 12 ? `${safe} AM` : `${safe - 12} PM`;
}

export function minutesToTimeLabel(total: number | null): string {
  if (total === null || total === undefined) return "Any time";
  const safe = ((Math.round(total) % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  const suffix = hours < 12 ? "AM" : "PM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"] as const;
export const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
