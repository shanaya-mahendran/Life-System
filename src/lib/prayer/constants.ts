/**
 * Prayer (Salah) domain constants.
 *
 * The proposal's "Quiet Light" palette: parchment and sand, soft emerald, clay
 * instead of red. The app itself runs dark, so the accent is the dark-mode
 * emerald and every status has a readable dark tint plus its own shape cue.
 * Colour is never the only signal — each status also carries a label and a
 * mark in the UI.
 */

export const PRAYER_ACCENT = "#3db596";
export const PRAYER_ACCENT_DEEP = "#0f6b57";
export const PRAYER_SAND = "#d9c9a3";

export type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export interface PrayerDefinition {
  key: PrayerKey;
  label: string;
  arabic: string;
  /** The sky at that time of day, used sparingly on arcs and edges. */
  hue: string;
  /** Plain-language cue for newcomers. */
  blurb: string;
}

export const PRAYERS: PrayerDefinition[] = [
  { key: "fajr", label: "Fajr", arabic: "الفجر", hue: "#4a5a9a", blurb: "Pre-dawn" },
  { key: "dhuhr", label: "Dhuhr", arabic: "الظهر", hue: "#e8c46a", blurb: "Just after midday" },
  { key: "asr", label: "Asr", arabic: "العصر", hue: "#d98c3f", blurb: "Afternoon" },
  { key: "maghrib", label: "Maghrib", arabic: "المغرب", hue: "#c25b6b", blurb: "Just after sunset" },
  { key: "isha", label: "Isha", arabic: "العشاء", hue: "#2b2f5b", blurb: "Night" },
];

export const PRAYER_KEYS: PrayerKey[] = PRAYERS.map((prayer) => prayer.key);

export function prayerDefinition(key: string): PrayerDefinition | undefined {
  return PRAYERS.find((prayer) => prayer.key === key);
}

export function prayerLabel(key: string): string {
  return prayerDefinition(key)?.label ?? key;
}

/** Optional prayers, tracked separately and never counted in the five. */
export const EXTRAS: { key: string; label: string; note: string }[] = [
  { key: "sunnah", label: "Sunnah before Fajr", note: "Two rak'ah before the fard" },
  { key: "witr", label: "Witr", note: "The closing prayer of the night" },
];

export type LogStatus = "on_time" | "late" | "missed";

export const STATUS_ORDER: LogStatus[] = ["on_time", "late", "missed"];

export const STATUS_META: Record<
  LogStatus,
  { label: string; color: string; fill: string; mark: string; spoken: string }
> = {
  on_time: {
    label: "On time",
    color: "#4ec3a2",
    fill: "#2f8a70",
    mark: "check",
    spoken: "prayed on time",
  },
  late: {
    label: "Late",
    color: "#e0b45c",
    fill: "#b08a3a",
    mark: "half",
    spoken: "prayed late",
  },
  missed: {
    label: "Missed",
    // Clay, never red: something to tend to, not a verdict.
    color: "#d1815f",
    fill: "#8d5741",
    mark: "open",
    spoken: "not prayed",
  },
};

export type DayState = "active" | "excused" | "adapted" | "traveller" | "review";

export interface DayStateMeta {
  key: DayState;
  label: string;
  color: string;
  summary: string;
  /** Whether logged prayers are required for the day to count. */
  countsApplicable: boolean;
  keepStreak: boolean;
}

export const DAY_STATES: DayStateMeta[] = [
  {
    key: "active",
    label: "Active",
    color: PRAYER_ACCENT,
    summary: "Normal practice. Five prayers, one calm reminder each.",
    countsApplicable: true,
    keepStreak: false,
  },
  {
    key: "excused",
    label: "Excused",
    color: "#b3a9d0",
    summary: "Prayer is not obligatory today. Nothing is counted as missed and your streak is safe.",
    countsApplicable: false,
    keepStreak: true,
  },
  {
    key: "adapted",
    label: "Adapted",
    color: "#6bb9c9",
    summary: "Praying as you are able — seated, lying, or combined where your school allows.",
    countsApplicable: true,
    keepStreak: false,
  },
  {
    key: "traveller",
    label: "Traveller",
    color: "#d9c9a3",
    summary: "Shortening or combining may apply. Times follow your current location.",
    countsApplicable: true,
    keepStreak: false,
  },
  {
    key: "review",
    label: "In review",
    color: "#8b8698",
    summary: "Incomplete information. Counts are held until you confirm — nothing is marked failed.",
    countsApplicable: false,
    keepStreak: false,
  },
];

export function dayStateMeta(state: string): DayStateMeta {
  return DAY_STATES.find((entry) => entry.key === state) ?? DAY_STATES[0];
}

export function isApplicableState(state: string): boolean {
  return dayStateMeta(state).countsApplicable;
}

export const STATE_SOURCES: { key: string; label: string }[] = [
  { key: "user", label: "you" },
  { key: "health", label: "your health log" },
  { key: "cycle", label: "your cycle log" },
  { key: "travel", label: "your travel plans" },
  { key: "mood", label: "your journal" },
];

export function stateSourceLabel(source: string): string {
  return STATE_SOURCES.find((entry) => entry.key === source)?.label ?? "you";
}

export type CalcMethodKey = "mwl" | "isna" | "egypt" | "karachi" | "umm_al_qura" | "tehran";

export const CALC_METHODS: {
  key: CalcMethodKey;
  label: string;
  region: string;
  fajrAngle: number;
  ishaAngle: number;
  ishaInterval?: number;
}[] = [
  { key: "mwl", label: "Muslim World League", region: "Europe, Far East, parts of the Middle East", fajrAngle: 18, ishaAngle: 17 },
  { key: "isna", label: "ISNA", region: "North America", fajrAngle: 15, ishaAngle: 15 },
  { key: "egypt", label: "Egyptian General Authority", region: "Africa, Syria, Iraq, Lebanon", fajrAngle: 19.5, ishaAngle: 17.5 },
  { key: "karachi", label: "University of Islamic Sciences, Karachi", region: "Pakistan, Bangladesh, India, Afghanistan", fajrAngle: 18, ishaAngle: 18 },
  { key: "umm_al_qura", label: "Umm al-Qura", region: "Arabian Peninsula", fajrAngle: 18.5, ishaAngle: 0, ishaInterval: 90 },
  { key: "tehran", label: "Institute of Geophysics, Tehran", region: "Iran, some Shia communities", fajrAngle: 17.7, ishaAngle: 14 },
];

export function calcMethod(key: string) {
  return CALC_METHODS.find((method) => method.key === key) ?? CALC_METHODS[0];
}

export const ASR_METHODS: { key: string; label: string; summary: string }[] = [
  { key: "standard", label: "Standard", summary: "Shafi'i, Maliki and Hanbali: shadow equals the object." },
  { key: "hanafi", label: "Hanafi", summary: "Shadow is twice the object." },
];

export const HIGH_LATITUDE_RULES: { key: string; label: string; summary: string }[] = [
  { key: "angle", label: "Angle-based", summary: "Divides the night by the twilight angle. A common default above 48°." },
  { key: "middle", label: "Middle of the night", summary: "Fajr and Isha sit halfway through the night." },
  { key: "seventh", label: "One seventh of the night", summary: "Fajr and Isha sit one seventh in from either end." },
];

export const MADHHABS: { key: string; label: string }[] = [
  { key: "shafii", label: "Shafi'i" },
  { key: "hanafi", label: "Hanafi" },
  { key: "maliki", label: "Maliki" },
  { key: "hanbali", label: "Hanbali" },
  { key: "other", label: "Prefer not to say" },
];

export interface LocationPreset {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export const LOCATION_PRESETS: LocationPreset[] = [
  { label: "Makkah", latitude: 21.3891, longitude: 39.8579, timezone: "Asia/Riyadh" },
  { label: "Madinah", latitude: 24.4672, longitude: 39.6111, timezone: "Asia/Riyadh" },
  { label: "Karachi", latitude: 24.8607, longitude: 67.0011, timezone: "Asia/Karachi" },
  { label: "Lahore", latitude: 31.5204, longitude: 74.3587, timezone: "Asia/Karachi" },
  { label: "Delhi", latitude: 28.6139, longitude: 77.209, timezone: "Asia/Kolkata" },
  { label: "Hyderabad", latitude: 17.385, longitude: 78.4867, timezone: "Asia/Kolkata" },
  { label: "Dhaka", latitude: 23.8103, longitude: 90.4125, timezone: "Asia/Dhaka" },
  { label: "Colombo", latitude: 6.9271, longitude: 79.8612, timezone: "Asia/Colombo" },
  { label: "Jakarta", latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
  { label: "Kuala Lumpur", latitude: 3.139, longitude: 101.6869, timezone: "Asia/Kuala_Lumpur" },
  { label: "Istanbul", latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul" },
  { label: "Cairo", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo" },
  { label: "Dubai", latitude: 25.2048, longitude: 55.2708, timezone: "Asia/Dubai" },
  { label: "London", latitude: 51.5072, longitude: -0.1276, timezone: "Europe/London" },
  { label: "Toronto", latitude: 43.6532, longitude: -79.3832, timezone: "America/Toronto" },
  { label: "New York", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
];

const COLOMBO_PRESET =
  LOCATION_PRESETS.find((preset) => preset.label === "Colombo") ?? LOCATION_PRESETS[0];

/** Sri Lanka and India share UTC+5:30, so both default to the app's home city. */
const SRI_LANKA_OFFSET_ZONES = new Set(["Asia/Colombo", "Asia/Kolkata"]);

/**
 * A sensible starting point before the person picks a city. Colombo is the
 * app's home location; any timezone with a preset of its own keeps that city.
 * The choice is only a default — Settings → Location changes it any time.
 */
export function defaultLocation(timezone: string): LocationPreset {
  if (SRI_LANKA_OFFSET_ZONES.has(timezone)) return COLOMBO_PRESET;
  const exact = LOCATION_PRESETS.find((preset) => preset.timezone === timezone);
  return exact ?? COLOMBO_PRESET;
}

export const QADA_PLANS: { key: string; label: string; summary: string }[] = [
  { key: "with_each", label: "1 extra with each prayer", summary: "One make-up prayer alongside each of the five." },
  { key: "two_with_each", label: "2 extra with each prayer", summary: "A quicker catch-up while it stays realistic." },
  { key: "friday", label: "Gather on Friday", summary: "Keep the weekdays steady and make up on Friday." },
];

export function qadaPlanLabel(key: string): string {
  return QADA_PLANS.find((plan) => plan.key === key)?.label ?? QADA_PLANS[0].label;
}

/** Emerald ramp for the heatmap, dark-mode luminance. */
export const HEATMAP_RAMP = ["#1a2521", "#1f3b32", "#276a54", "#2f8a70", "#3db596"];

export function heatmapColor(onTime: number, applicable: number): string {
  if (applicable === 0) return HEATMAP_RAMP[1];
  if (onTime === 0) return HEATMAP_RAMP[0];
  const ratio = onTime / applicable;
  if (ratio >= 1) return HEATMAP_RAMP[4];
  if (ratio >= 0.6) return HEATMAP_RAMP[3];
  return HEATMAP_RAMP[2];
}

/** 312 → "5:12 AM" */
export function minutesToClock(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** "5:12 AM – 6:34 AM" */
export function windowLabel(start: number, end: number): string {
  return `${minutesToClock(start)} – ${minutesToClock(end)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-27" → "Fri 27 Nov" */
export function dateKeyLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  const date = new Date(Date.UTC(year, month - 1, day));
  return `${WEEKDAYS[date.getUTCDay()]} ${day} ${MONTHS[month - 1]}`;
}

export function monthShort(month: number): string {
  return MONTHS[month - 1] ?? "";
}

/** Minutes as "1h 12m" / "12m". */
export function durationLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe}m`;
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
