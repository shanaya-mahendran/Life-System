/**
 * Prayer data access and derived views.
 *
 * The web app stores one row per logged prayer plus a per-day state row. Every
 * screen — the ring, the strip, the heatmap, the qada ledger, the weekly
 * review — is derived from those two tables, so the numbers can never disagree
 * with each other.
 *
 * States are confirmed by the person, never inferred silently: a state change
 * records its source so the banner can say where it came from and offer undo.
 */

import { prisma } from "@/lib/db";
import type { ServiceUser } from "@/lib/calendar/service";
import { dayKey, utcToZoned } from "@/lib/time";
import { clamp } from "@/lib/utils";
import {
  DAY_STATES,
  EXTRAS,
  PRAYERS,
  PRAYER_KEYS,
  dayStateMeta,
  defaultLocation,
  isApplicableState,
  type CalcMethodKey,
  type DayState,
  type LogStatus,
  type PrayerKey,
} from "./constants";
import {
  buildHeatmap,
  computeStreak,
  consistency,
  dateKeysBetween,
  emptyDay,
  mondayIndexFromKey,
  shiftDateKey,
  weakestPrayer,
  type DaySummary,
  type Heatmap,
  type PrayerTally,
} from "./stats";
import { computePrayerTimes, currentWindow, nextPrayer, prayerWindows, type PrayerTimeSet } from "./times";

const HISTORY_DAYS = 371;

export interface PrayerSettingsCard {
  latitude: number;
  longitude: number;
  locationLabel: string;
  method: string;
  asrMethod: string;
  highLatitude: string;
  madhhab: string;
  adjustMinutes: number;
  remindersOn: boolean;
  fajrAlarm: boolean;
  lockDuringPrayer: boolean;
  trackSunnah: boolean;
  trackWitr: boolean;
  qadaPlan: string;
}

export interface PrayerLogCard {
  prayer: string;
  status: LogStatus;
  method: string;
  category: string;
}

export interface QadaRow {
  prayer: string;
  owed: number;
  completed: number;
}

export interface PrayerDayStateCard {
  dateKey: string;
  state: DayState;
  source: string;
  note: string;
}

export interface PrayerNextCard {
  key: PrayerKey;
  start: number;
  minutesUntil: number;
  tomorrow: boolean;
}

export interface PrayerOverview {
  todayKey: string;
  nowMinutes: number;
  settings: PrayerSettingsCard;
  times: PrayerTimeSet;
  windows: { key: PrayerKey; start: number; end: number }[];
  next: PrayerNextCard;
  currentKey: PrayerKey | null;
  todayState: PrayerDayStateCard;
  today: DaySummary;
  logs: PrayerLogCard[];
  summaries: DaySummary[];
  heatmap: Heatmap;
  tallies: PrayerTally[];
  stats: {
    currentStreak: number;
    longestStreak: number;
    consistency: number;
    weekLogged: number;
    weekApplicable: number;
    monthLogged: number;
    monthApplicable: number;
    excusedDays: number;
  };
  weakest: { prayer: string; missed: number; late: number; applicable: number } | null;
  qada: QadaRow[];
  qadaOwed: number;
  qadaCompleted: number;
  hasData: boolean;
}

function defaultMethodForTimezone(timezone: string): CalcMethodKey {
  if (["Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Colombo"].includes(timezone)) return "karachi";
  if (timezone === "Asia/Riyadh") return "umm_al_qura";
  if (timezone === "Africa/Cairo") return "egypt";
  if (timezone.startsWith("America/")) return "isna";
  return "mwl";
}

function settingsDefaults(timezone: string) {
  const location = defaultLocation(timezone);
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    locationLabel: location.label,
    method: defaultMethodForTimezone(timezone),
    asrMethod: "standard",
    highLatitude: "angle",
    madhhab: "shafii",
    adjustMinutes: 0,
    remindersOn: true,
    fajrAlarm: false,
    lockDuringPrayer: false,
    trackSunnah: false,
    trackWitr: true,
    qadaPlan: "with_each",
  };
}

function toSettingsCard(row: {
  latitude: number;
  longitude: number;
  locationLabel: string;
  method: string;
  asrMethod: string;
  highLatitude: string;
  madhhab: string;
  adjustMinutes: number;
  remindersOn: boolean;
  fajrAlarm: boolean;
  lockDuringPrayer: boolean;
  trackSunnah: boolean;
  trackWitr: boolean;
  qadaPlan: string;
}): PrayerSettingsCard {
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.locationLabel,
    method: row.method,
    asrMethod: row.asrMethod,
    highLatitude: row.highLatitude,
    madhhab: row.madhhab,
    adjustMinutes: row.adjustMinutes,
    remindersOn: row.remindersOn,
    fajrAlarm: row.fajrAlarm,
    lockDuringPrayer: row.lockDuringPrayer,
    trackSunnah: row.trackSunnah,
    trackWitr: row.trackWitr,
    qadaPlan: row.qadaPlan,
  };
}

export async function ensurePrayerSettings(userId: string, timezone: string) {
  // Read first: the section used to upsert on every page view, which is a
  // write round trip for a row that almost always already exists.
  const existing = await prisma.prayerSettings.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.prayerSettings.upsert({
    where: { userId },
    update: {},
    create: { userId, ...settingsDefaults(timezone) },
  });
}

export async function updatePrayerSettings(
  user: ServiceUser,
  patch: Partial<PrayerSettingsCard>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const safe: Partial<PrayerSettingsCard> = {};
  if (patch.latitude != null) safe.latitude = clamp(patch.latitude, -90, 90);
  if (patch.longitude != null) safe.longitude = clamp(patch.longitude, -180, 180);
  if (patch.method) safe.method = patch.method;
  if (patch.asrMethod) safe.asrMethod = patch.asrMethod;
  if (patch.highLatitude) safe.highLatitude = patch.highLatitude;
  if (patch.madhhab) safe.madhhab = patch.madhhab;
  if (patch.adjustMinutes != null) safe.adjustMinutes = clamp(Math.round(patch.adjustMinutes), -45, 45);
  if (patch.locationLabel != null) safe.locationLabel = patch.locationLabel.trim().slice(0, 60);
  if (patch.qadaPlan) safe.qadaPlan = patch.qadaPlan;
  for (const flag of ["remindersOn", "fajrAlarm", "lockDuringPrayer", "trackSunnah", "trackWitr"] as const) {
    if (patch[flag] != null) safe[flag] = Boolean(patch[flag]);
  }

  if (!Object.keys(safe).length) return { ok: false, message: "Nothing to update." };

  await ensurePrayerSettings(user.id, user.timezone);
  await prisma.prayerSettings.update({ where: { userId: user.id }, data: safe });
  return { ok: true };
}

const FAR_KEY = new Set<string>(PRAYER_KEYS);
const EXTRA_KEY = new Set<string>(EXTRAS.map((extra) => extra.key));
const STATUS_KEY = new Set<string>(["on_time", "late", "missed"]);

export async function logPrayer(
  userId: string,
  input: { dateKey: string; prayer: string; status: string; method?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!FAR_KEY.has(input.prayer) && !EXTRA_KEY.has(input.prayer)) {
    return { ok: false, message: "Unknown prayer." };
  }
  if (!STATUS_KEY.has(input.status)) {
    return { ok: false, message: "Unknown status." };
  }

  const category = FAR_KEY.has(input.prayer) ? "fard" : input.prayer === "witr" ? "witr" : "sunnah";

  await prisma.prayerLog.upsert({
    where: {
      userId_dateKey_prayer: { userId, dateKey: input.dateKey, prayer: input.prayer },
    },
    update: {
      status: input.status,
      method: input.method ?? "normal",
      category,
      loggedAt: new Date(),
    },
    create: {
      userId,
      dateKey: input.dateKey,
      prayer: input.prayer,
      status: input.status,
      method: input.method ?? "normal",
      category,
    },
  });

  return { ok: true };
}

export async function clearPrayer(
  userId: string,
  dateKey: string,
  prayer: string,
): Promise<{ ok: true }> {
  await prisma.prayerLog.deleteMany({ where: { userId, dateKey, prayer } });
  return { ok: true };
}

export async function setDayState(
  userId: string,
  input: { dateKey: string; state: string; source?: string; note?: string },
): Promise<{ ok: true; state: DayState } | { ok: false; message: string }> {
  const known = DAY_STATES.some((entry) => entry.key === input.state);
  if (!known) return { ok: false, message: "Unknown day state." };

  const state = input.state as DayState;
  const source = input.source ?? "user";
  const note = (input.note ?? "").slice(0, 200);

  await prisma.prayerDay.upsert({
    where: { userId_dateKey: { userId, dateKey: input.dateKey } },
    update: { state, stateSource: source, stateNote: note },
    create: { userId, dateKey: input.dateKey, state, stateSource: source, stateNote: note },
  });

  // Keep one trail of state changes so a banner can always say where a state
  // came from, and so an automatic suggestion can be undone precisely.
  await prisma.prayerStateEvent.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  });
  await prisma.prayerStateEvent.create({
    data: { userId, state, source, note, confirmedBy: "user" },
  });

  return { ok: true, state };
}

export async function updateQada(
  userId: string,
  prayer: string,
  input: { owed?: number; completed?: number },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!FAR_KEY.has(prayer)) return { ok: false, message: "Unknown prayer." };
  const data: { owed?: number; completed?: number } = {};
  if (input.owed != null) data.owed = clamp(Math.round(input.owed), 0, 9999);
  if (input.completed != null) data.completed = clamp(Math.round(input.completed), 0, 9999);
  if (!Object.keys(data).length) return { ok: false, message: "Nothing to update." };

  await prisma.qadaLedger.upsert({
    where: { userId_prayer: { userId, prayer } },
    update: data,
    create: { userId, prayer, owed: data.owed ?? 0, completed: data.completed ?? 0 },
  });

  return { ok: true };
}

function buildSummaries(
  dateKeys: string[],
  stateByKey: Map<string, { state: string }>,
  logs: { dateKey: string; prayer: string; status: string; category: string }[],
): { summaries: DaySummary[]; tallies: PrayerTally[] } {
  const logsByKey = new Map<string, typeof logs>();
  for (const log of logs) {
    const bucket = logsByKey.get(log.dateKey) ?? [];
    bucket.push(log);
    logsByKey.set(log.dateKey, bucket);
  }

  const summaries: DaySummary[] = [];
  const tallyMap = new Map<string, PrayerTally>(
    PRAYER_KEYS.map((prayer) => [prayer, { prayer, onTime: 0, late: 0, missed: 0, applicable: 0 }]),
  );

  for (const key of dateKeys) {
    const state = stateByKey.get(key)?.state ?? "active";
    const applicable = isApplicableState(state) ? PRAYER_KEYS.length : 0;
    const base = emptyDay(key);
    base.state = state;
    base.applicable = applicable;
    base.excused = state === "excused";

    const dayLogs = (logsByKey.get(key) ?? []).filter(
      (log) => log.category === "fard" && FAR_KEY.has(log.prayer),
    );

    for (const log of dayLogs) {
      if (log.status === "on_time") base.onTime += 1;
      else if (log.status === "late") base.late += 1;
      else if (log.status === "missed") base.missed += 1;
      base.logged += 1;
    }

    base.complete = applicable > 0 && base.onTime + base.late >= applicable;
    summaries.push(base);
  }

  // Tallies for the last four weeks only — old misses should not define now.
  const recent = new Set(dateKeys.slice(-28));
  for (const log of logs) {
    if (!recent.has(log.dateKey) || log.category !== "fard") continue;
    const tally = tallyMap.get(log.prayer);
    if (!tally) continue;
    const state = stateByKey.get(log.dateKey)?.state ?? "active";
    if (!isApplicableState(state)) continue;
    if (log.status === "on_time") tally.onTime += 1;
    else if (log.status === "late") tally.late += 1;
    else if (log.status === "missed") tally.missed += 1;
  }
  for (const key of recent) {
    const state = stateByKey.get(key)?.state ?? "active";
    if (!isApplicableState(state)) continue;
    for (const tally of tallyMap.values()) tally.applicable += 1;
  }

  return { summaries, tallies: [...tallyMap.values()] };
}

export async function getPrayerOverview(user: ServiceUser): Promise<PrayerOverview> {
  const timezone = user.timezone;
  const settingsRow = await ensurePrayerSettings(user.id, timezone);
  const settings = toSettingsCard(settingsRow);

  const todayKey = dayKey(new Date(), timezone);
  const windowStart = shiftDateKey(todayKey, -(HISTORY_DAYS - 1));

  const [logs, dayRows, ledger] = await Promise.all([
    prisma.prayerLog.findMany({
      where: { userId: user.id, dateKey: { gte: windowStart } },
      orderBy: { loggedAt: "asc" },
      select: { dateKey: true, prayer: true, status: true, method: true, category: true },
    }),
    prisma.prayerDay.findMany({
      where: { userId: user.id, dateKey: { gte: windowStart } },
      select: { dateKey: true, state: true, stateSource: true, stateNote: true },
    }),
    prisma.qadaLedger.findMany({ where: { userId: user.id }, select: { prayer: true, owed: true, completed: true } }),
  ]);

  const dateKeys = dateKeysBetween(windowStart, todayKey);
  const stateByKey = new Map(dayRows.map((row) => [row.dateKey, row]));
  const { summaries, tallies } = buildSummaries(dateKeys, stateByKey, logs);

  const summaryByKey = new Map(summaries.map((summary) => [summary.dateKey, summary]));
  const today = summaryByKey.get(todayKey) ?? emptyDay(todayKey);
  const todayRow = stateByKey.get(todayKey);

  const times = computePrayerTimes({
    dateKey: todayKey,
    timezone,
    latitude: settings.latitude,
    longitude: settings.longitude,
    method: settings.method,
    asrMethod: settings.asrMethod,
    highLatitude: settings.highLatitude,
    adjustMinutes: settings.adjustMinutes,
  });
  const windows = prayerWindows(times);
  const nowParts = utcToZoned(new Date(), timezone);
  const nowMinutes = nowParts.hour * 60 + nowParts.minute;
  const next = nextPrayer(times, nowMinutes);
  const current = currentWindow(times, nowMinutes);

  const last30 = summaries.slice(-30);
  const weekStartKey = shiftDateKey(todayKey, -mondayIndexFromKey(todayKey));
  const thisWeek = summaries.filter((summary) => summary.dateKey >= weekStartKey);
  const month = consistency(last30);
  const week = consistency(thisWeek);
  const streak = computeStreak(summaries);

  const qadaMap = new Map(ledger.map((row) => [row.prayer, row]));
  const qada: QadaRow[] = PRAYER_KEYS.map((prayer) => ({
    prayer,
    owed: qadaMap.get(prayer)?.owed ?? 0,
    completed: qadaMap.get(prayer)?.completed ?? 0,
  }));

  const todayLogs: PrayerLogCard[] = logs
    .filter((log) => log.dateKey === todayKey)
    .map((log) => ({
      prayer: log.prayer,
      status: log.status as LogStatus,
      method: log.method,
      category: log.category,
    }));

  const hasData =
    logs.length > 0 ||
    dayRows.some((row) => row.state !== "active") ||
    qada.some((row) => row.owed > 0 || row.completed > 0);

  return {
    todayKey,
    nowMinutes,
    settings,
    times,
    windows,
    next,
    currentKey: current?.key ?? null,
    todayState: {
      dateKey: todayKey,
      state: (todayRow?.state as DayState) ?? "active",
      source: todayRow?.stateSource ?? "user",
      note: todayRow?.stateNote ?? "",
    },
    today,
    logs: todayLogs,
    summaries,
    heatmap: buildHeatmap(summaryByKey, todayKey, 26),
    tallies,
    stats: {
      currentStreak: streak.current,
      longestStreak: streak.longest,
      consistency: month.percent,
      weekLogged: week.logged,
      weekApplicable: week.applicable,
      monthLogged: month.logged,
      monthApplicable: month.applicable,
      excusedDays: summaries.filter((summary) => summary.excused).length,
    },
    weakest: weakestPrayer(tallies),
    qada,
    qadaOwed: qada.reduce((total, row) => total + row.owed, 0),
    qadaCompleted: qada.reduce((total, row) => total + row.completed, 0),
    hasData,
  };
}

export interface PrayerDayDetail {
  dateKey: string;
  state: DayState;
  source: string;
  note: string;
  times: PrayerTimeSet;
  logs: PrayerLogCard[];
  summary: DaySummary;
}

/** One day's five prayers, for the heatmap drill-down. */
export async function getDayDetail(user: ServiceUser, dateKey: string): Promise<PrayerDayDetail> {
  const settingsRow = await ensurePrayerSettings(user.id, user.timezone);
  const settings = toSettingsCard(settingsRow);

  const [dayRow, logs] = await Promise.all([
    prisma.prayerDay.findUnique({ where: { userId_dateKey: { userId: user.id, dateKey } } }),
    prisma.prayerLog.findMany({
      where: { userId: user.id, dateKey },
      select: { prayer: true, status: true, method: true, category: true },
    }),
  ]);

  const state = (dayRow?.state as DayState) ?? "active";
  const applicable = isApplicableState(state) ? PRAYER_KEYS.length : 0;
  const summary = emptyDay(dateKey);
  summary.state = state;
  summary.applicable = applicable;
  summary.excused = state === "excused";
  for (const log of logs) {
    if (log.category !== "fard") continue;
    if (log.status === "on_time") summary.onTime += 1;
    else if (log.status === "late") summary.late += 1;
    else if (log.status === "missed") summary.missed += 1;
    summary.logged += 1;
  }
  summary.complete = applicable > 0 && summary.onTime + summary.late >= applicable;

  return {
    dateKey,
    state,
    source: dayRow?.stateSource ?? "user",
    note: dayRow?.stateNote ?? "",
    times: computePrayerTimes({
      dateKey,
      timezone: user.timezone,
      latitude: settings.latitude,
      longitude: settings.longitude,
      method: settings.method,
      asrMethod: settings.asrMethod,
      highLatitude: settings.highLatitude,
      adjustMinutes: settings.adjustMinutes,
    }),
    logs: logs.map((log) => ({
      prayer: log.prayer,
      status: log.status as LogStatus,
      method: log.method,
      category: log.category,
    })),
    summary,
  };
}

/**
 * Per-prayer statuses by day, for the prayer-rows heatmap. Returned as a plain
 * object so it can cross the server/client boundary unchanged.
 */
export async function getPrayerLogIndex(
  userId: string,
  startKey: string,
): Promise<Record<string, Record<string, string>>> {
  const logs = await prisma.prayerLog.findMany({
    where: { userId, dateKey: { gte: startKey }, category: "fard" },
    select: { dateKey: true, prayer: true, status: true },
  });

  const index: Record<string, Record<string, string>> = {};
  for (const log of logs) {
    index[log.dateKey] = index[log.dateKey] ?? {};
    index[log.dateKey][log.prayer] = log.status;
  }
  return index;
}

/** The prayer names in display order, for pages that only need labels. */
export const DISPLAY_PRAYERS = PRAYERS;

export function stateSummary(state: string): string {
  return dayStateMeta(state).summary;
}
