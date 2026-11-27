/**
 * MindReset data access and derived metrics.
 *
 * Raw per-app usage never leaves the device in the Android module; this web
 * section stores one aggregated summary per day (screen minutes, pickups,
 * focus, late-night minutes, per-app totals and 24 hour buckets) and derives
 * every screen from it. Baselines are always the user's own history.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ServiceUser } from "@/lib/calendar/service";
import { addZonedDays, dayKey, startOfZonedDay, utcToZoned, zonedToUtc } from "@/lib/time";
import { clamp } from "@/lib/utils";
import {
  APP_CATEGORIES,
  MAX_UPLOAD_APPS,
  PRESETS,
  type PresetConfig,
  type ThrivingBand,
  thrivingBand,
} from "./constants";
import {
  computeThriving,
  cumulativeHours,
  mean,
  median,
  normalizeHours,
  type ThrivingResult,
  type UsageStatus,
  usageStatus,
  usualCurve,
} from "./score";

export interface MindResetApp {
  name: string;
  minutes: number;
  category: string;
}

export interface MindResetDayCard {
  dateKey: string;
  screenMinutes: number;
  pickups: number;
  focusMinutes: number;
  nightMinutes: number;
  apps: MindResetApp[];
  hours: number[];
  logged: boolean;
  score: number;
  band: ThrivingBand;
}

export interface MindResetLimitCard {
  id: string;
  label: string;
  type: string;
  target: string;
  minutes: number | null;
  startMinute: number | null;
  endMinute: number | null;
  days: number[];
  enabled: boolean;
  strict: boolean;
  preset: string | null;
}

export interface MindResetSettingsCard {
  goalMinutes: number;
  focusGoalMinutes: number;
  blockingOn: boolean;
  pauseStyle: string;
  strictMode: boolean;
  securityLock: boolean;
  savePauseToDiary: boolean;
  shareWithSleep: boolean;
  shareWithHabits: boolean;
}

export interface MindResetOverview {
  todayKey: string;
  settings: MindResetSettingsCard;
  today: MindResetDayCard | null;
  recentDays: MindResetDayCard[];
  week: { dateKey: string; label: string; minutes: number; logged: boolean }[];
  weekAvg: number;
  usual: number[];
  todayCumulative: number[];
  usualNow: number;
  status: UsageStatus;
  currentHour: number;
  score: ThrivingResult;
  topApps: (MindResetApp & { share: number })[];
  mostActiveHour: number | null;
  focus: { today: number; longest: number; lifetime: number; sessions: number };
  pauses: { today: number; total: number; goBackRate: number | null };
  limits: MindResetLimitCard[];
  blockedApps: string[];
  hasData: boolean;
}

const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function dateFromKey(key: string, timeZone: string): Date {
  return zonedToUtc(
    {
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)),
      day: Number(key.slice(8, 10)),
    },
    timeZone,
  );
}

export function normalizeApps(value: unknown): MindResetApp[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const minutes = Number(record.minutes);
      if (!name || !Number.isFinite(minutes) || minutes <= 0) return null;
      const category =
        typeof record.category === "string" && (APP_CATEGORIES as readonly string[]).includes(record.category)
          ? record.category
          : "Other";
      return { name: name.slice(0, 60), minutes: Math.round(clamp(minutes, 0, 1440)), category };
    })
    .filter((entry): entry is MindResetApp => entry !== null)
    .slice(0, MAX_UPLOAD_APPS);
}

function normalizeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 1, 2, 3, 4, 5, 6];
  const days = value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

export async function getMindResetSettings(userId: string): Promise<MindResetSettingsCard> {
  const settings = await prisma.mindResetSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return {
    goalMinutes: settings.goalMinutes,
    focusGoalMinutes: settings.focusGoalMinutes,
    blockingOn: settings.blockingOn,
    pauseStyle: settings.pauseStyle,
    strictMode: settings.strictMode,
    securityLock: settings.securityLock,
    savePauseToDiary: settings.savePauseToDiary,
    shareWithSleep: settings.shareWithSleep,
    shareWithHabits: settings.shareWithHabits,
  };
}

function toLimitCard(limit: {
  id: string;
  label: string;
  type: string;
  target: string;
  minutes: number | null;
  startMinute: number | null;
  endMinute: number | null;
  days: unknown;
  enabled: boolean;
  strict: boolean;
  preset: string | null;
}): MindResetLimitCard {
  return {
    id: limit.id,
    label: limit.label,
    type: limit.type,
    target: limit.target,
    minutes: limit.minutes,
    startMinute: limit.startMinute,
    endMinute: limit.endMinute,
    days: normalizeDays(limit.days),
    enabled: limit.enabled,
    strict: limit.strict,
    preset: limit.preset,
  };
}

export async function getMindResetOverview(user: ServiceUser, now: Date = new Date()): Promise<MindResetOverview> {
  const todayKey = dayKey(now, user.timezone);
  const todayStart = startOfZonedDay(now, user.timezone);
  const windowStartKey = dayKey(addZonedDays(todayStart, -14, user.timezone), user.timezone);

  const [settings, rows, limitRows, focusAgg, focusTodayAgg, focusLongest, pauseRows, pauseToday] =
    await Promise.all([
      getMindResetSettings(user.id),
      prisma.mindResetDay.findMany({
        where: { userId: user.id, dateKey: { gte: windowStartKey } },
        orderBy: { dateKey: "asc" },
      }),
      prisma.mindResetLimit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      prisma.mindResetFocusSession.aggregate({
        where: { userId: user.id },
        _sum: { actualMinutes: true },
        _count: true,
      }),
      prisma.mindResetFocusSession.aggregate({
        where: { userId: user.id, startedAt: { gte: todayStart } },
        _sum: { actualMinutes: true },
      }),
      prisma.mindResetFocusSession.findFirst({
        where: { userId: user.id },
        orderBy: { actualMinutes: "desc" },
        select: { actualMinutes: true },
      }),
      prisma.mindResetPause.findMany({
        where: { userId: user.id, at: { gte: addZonedDays(todayStart, -14, user.timezone) } },
        select: { at: true, wentBack: true },
      }),
      prisma.mindResetPause.count({ where: { userId: user.id, at: { gte: todayStart } } }),
    ]);

  const goBackCount = pauseRows.filter((pause) => pause.wentBack).length;
  const goBackRate = pauseRows.length ? goBackCount / pauseRows.length : null;
  const medianPickups = median(rows.filter((row) => row.dateKey !== todayKey).map((row) => row.pickups));

  const recentDays: MindResetDayCard[] = rows.map((row) => {
    const hours = normalizeHours(row.hours);
    const apps = normalizeApps(row.apps);
    const score = computeThriving({
      day: {
        screenMinutes: row.screenMinutes,
        pickups: row.pickups,
        nightMinutes: row.nightMinutes,
        focusMinutes: row.focusMinutes,
      },
      goalMinutes: settings.goalMinutes,
      focusGoalMinutes: settings.focusGoalMinutes,
      medianPickups,
      goBackRate,
    });
    return {
      dateKey: row.dateKey,
      screenMinutes: row.screenMinutes,
      pickups: row.pickups,
      focusMinutes: row.focusMinutes,
      nightMinutes: row.nightMinutes,
      apps,
      hours,
      logged: true,
      score: score.score,
      band: thrivingBand(score.score),
    };
  });

  const todayRow = recentDays.find((day) => day.dateKey === todayKey) ?? null;
  const byKey = new Map(recentDays.map((day) => [day.dateKey, day]));

  const week = Array.from({ length: 7 }, (_, index) => {
    const key = dayKey(addZonedDays(todayStart, index - 6, user.timezone), user.timezone);
    const day = byKey.get(key);
    const weekday = utcToZoned(dateFromKey(key, user.timezone), user.timezone).weekday;
    return {
      dateKey: key,
      label: WEEK_LABELS[weekday] ?? "·",
      minutes: day?.screenMinutes ?? 0,
      logged: Boolean(day),
    };
  });

  const loggedWeek = recentDays.filter((day) => week.some((entry) => entry.dateKey === day.dateKey));
  const weekAvg = Math.round(mean(loggedWeek.map((day) => day.screenMinutes)) ?? 0);

  const priorHours = recentDays
    .filter((day) => day.dateKey !== todayKey && day.hours.some((minutes) => minutes > 0))
    .map((day) => day.hours);
  const usual = usualCurve(priorHours);
  const currentHour = utcToZoned(now, user.timezone).hour;
  const todayHours = todayRow?.hours ?? Array.from({ length: 24 }, () => 0);
  const statusResult = usageStatus(todayHours, usual, currentHour);

  // Session minutes count toward the focus bonus without a second entry step.
  const focusMinutesToday = Math.max(todayRow?.focusMinutes ?? 0, focusTodayAgg._sum.actualMinutes ?? 0);

  const score = computeThriving({
    day: {
      screenMinutes: todayRow?.screenMinutes ?? 0,
      pickups: todayRow?.pickups ?? 0,
      nightMinutes: todayRow?.nightMinutes ?? 0,
      focusMinutes: focusMinutesToday,
    },
    goalMinutes: settings.goalMinutes,
    focusGoalMinutes: settings.focusGoalMinutes,
    medianPickups,
    goBackRate,
  });

  const appTotals = new Map<string, MindResetApp>();
  for (const day of recentDays.slice(-7)) {
    for (const app of day.apps) {
      const current = appTotals.get(app.name);
      appTotals.set(app.name, {
        name: app.name,
        category: app.category,
        minutes: (current?.minutes ?? 0) + app.minutes,
      });
    }
  }
  const todayAppTotal = (todayRow?.apps ?? []).reduce((sum, app) => sum + app.minutes, 0);
  const topApps = (todayRow?.apps ?? [])
    .slice()
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 4)
    .map((app) => ({
      ...app,
      share: todayAppTotal > 0 ? Math.round((app.minutes / todayAppTotal) * 1000) / 10 : 0,
    }));

  const peakIndex = todayHours.reduce((best, value, index) => (value > todayHours[best] ? index : best), 0);
  const mostActiveHour = todayHours[peakIndex] > 0 ? peakIndex : null;

  const blockedApps = Array.from(appTotals.values())
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 6)
    .map((app) => app.name);

  return {
    todayKey,
    settings,
    today: todayRow,
    recentDays,
    week,
    weekAvg,
    usual,
    todayCumulative: cumulativeHours(todayHours),
    usualNow: statusResult.usualMinutes,
    status: statusResult.status,
    currentHour,
    score,
    topApps,
    mostActiveHour,
    focus: {
      today: focusTodayAgg._sum.actualMinutes ?? 0,
      longest: focusLongest?.actualMinutes ?? 0,
      lifetime: focusAgg._sum.actualMinutes ?? 0,
      sessions: focusAgg._count,
    },
    pauses: {
      today: pauseToday,
      total: pauseRows.length,
      goBackRate,
    },
    limits: limitRows.map(toLimitCard),
    blockedApps,
    hasData: recentDays.length > 0,
  };
}

export interface UsageInput {
  dateKey?: string;
  screenMinutes: number;
  pickups: number;
  focusMinutes: number;
  nightMinutes: number;
  apps: MindResetApp[];
  hours?: number[];
  source?: string;
}

export async function logUsageDay(
  user: ServiceUser,
  input: UsageInput,
): Promise<{ ok: true; dateKey: string } | { ok: false; message: string }> {
  const today = dayKey(new Date(), user.timezone);
  const requested = input.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(input.dateKey) ? input.dateKey : today;
  const targetKey = requested > today ? today : requested;

  const screenMinutes = Math.round(clamp(Number(input.screenMinutes) || 0, 0, 1440));
  if (screenMinutes <= 0) return { ok: false, message: "Enter today's screen time — even a rough estimate works." };

  const data = {
    screenMinutes,
    pickups: Math.round(clamp(Number(input.pickups) || 0, 0, 999)),
    focusMinutes: Math.round(clamp(Number(input.focusMinutes) || 0, 0, 1440)),
    nightMinutes: Math.round(clamp(Number(input.nightMinutes) || 0, 0, 1440)),
    apps: normalizeApps(input.apps) as unknown as Prisma.InputJsonValue,
    hours: normalizeHours(input.hours) as unknown as Prisma.InputJsonValue,
    source: input.source === "sync" ? "sync" : "manual",
  };

  await prisma.mindResetDay.upsert({
    where: { userId_dateKey: { userId: user.id, dateKey: targetKey } },
    update: data,
    create: { userId: user.id, dateKey: targetKey, ...data },
  });

  return { ok: true, dateKey: targetKey };
}

export interface LimitInput {
  label: string;
  type: "cap" | "schedule" | "budget" | "preset";
  target?: string;
  minutes?: number | null;
  startMinute?: number | null;
  endMinute?: number | null;
  days?: number[];
  strict?: boolean;
  preset?: string | null;
}

export async function createLimit(
  userId: string,
  input: LimitInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const count = await prisma.mindResetLimit.count({ where: { userId } });
  if (count >= 40) return { ok: false, message: "Forty limits is the cap for this version." };
  if (input.type !== "preset" && !input.label.trim()) {
    return { ok: false, message: "Name the app or group this limit applies to." };
  }
  if ((input.type === "cap" || input.type === "budget") && !input.minutes) {
    return { ok: false, message: "Choose how many minutes the limit allows." };
  }
  if (input.type === "schedule" && (input.startMinute == null || input.endMinute == null)) {
    return { ok: false, message: "Choose a start and end time for the schedule block." };
  }

  const limit = await prisma.mindResetLimit.create({
    data: {
      userId,
      label: input.label.trim().slice(0, 80),
      type: input.type,
      target: (input.target ?? "").trim().slice(0, 80),
      minutes: input.minutes ?? null,
      startMinute: input.startMinute ?? null,
      endMinute: input.endMinute ?? null,
      days: normalizeDays(input.days),
      strict: Boolean(input.strict),
      preset: input.preset ?? null,
    },
  });

  return { ok: true, id: limit.id };
}

export async function setLimitEnabled(
  userId: string,
  limitId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const limit = await prisma.mindResetLimit.findFirst({ where: { id: limitId, userId } });
  if (!limit) return { ok: false, message: "Limit not found." };
  await prisma.mindResetLimit.update({ where: { id: limit.id }, data: { enabled } });
  return { ok: true };
}

export async function deleteLimit(
  userId: string,
  limitId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const limit = await prisma.mindResetLimit.findFirst({ where: { id: limitId, userId } });
  if (!limit) return { ok: false, message: "Limit not found." };
  await prisma.mindResetLimit.delete({ where: { id: limit.id } });
  return { ok: true };
}

export async function togglePreset(
  userId: string,
  preset: PresetConfig,
): Promise<{ ok: true; enabled: boolean } | { ok: false; message: string }> {
  const existing = await prisma.mindResetLimit.findFirst({
    where: { userId, type: "preset", preset: preset.name },
  });

  if (existing) {
    const enabled = !existing.enabled;
    await prisma.mindResetLimit.update({ where: { id: existing.id }, data: { enabled } });
    return { ok: true, enabled };
  }

  await prisma.mindResetLimit.create({
    data: {
      userId,
      label: preset.name,
      type: "preset",
      preset: preset.name,
      target: "",
      minutes: preset.minutes,
      startMinute: preset.startMinute,
      endMinute: preset.endMinute,
      days: preset.days,
      strict: preset.strict,
      enabled: true,
    },
  });
  return { ok: true, enabled: true };
}

export function findPreset(name: string): PresetConfig | null {
  return PRESETS.find((preset) => preset.name === name) ?? null;
}

export async function startFocusSession(
  user: ServiceUser,
  plannedMinutes: number,
  blockedApps: string[],
  domainSlug = "mindreset",
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const minutes = Math.round(clamp(Number(plannedMinutes) || 30, 5, 180));
  const apps = blockedApps
    .filter((app) => typeof app === "string" && app.trim())
    .map((app) => app.trim().slice(0, 60))
    .slice(0, 12);

  const session = await prisma.mindResetFocusSession.create({
    data: {
      userId: user.id,
      startedAt: new Date(),
      plannedMinutes: minutes,
      blockedApps: apps,
      domainSlug: domainSlug.slice(0, 40),
    },
  });

  return { ok: true, id: session.id };
}

export async function finishFocusSession(
  userId: string,
  sessionId: string,
  actualMinutes: number,
  completed: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await prisma.mindResetFocusSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) return { ok: false, message: "Focus session not found." };

  const minutes = Math.round(clamp(Number(actualMinutes) || 0, 0, 720));
  await prisma.mindResetFocusSession.update({
    where: { id: session.id },
    data: { actualMinutes: minutes, completed: Boolean(completed) },
  });

  return { ok: true };
}

export async function recordPause(
  userId: string,
  app: string,
  answer: string,
  moodTag: string,
  wentBack: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cleanApp = app.trim().slice(0, 80);
  if (!cleanApp) return { ok: false, message: "Which app was blocked?" };

  await prisma.mindResetPause.create({
    data: {
      userId,
      app: cleanApp,
      answer: answer.trim().slice(0, 500),
      moodTag: moodTag.trim().slice(0, 40),
      wentBack: Boolean(wentBack),
    },
  });

  return { ok: true };
}

export async function updateMindResetSettings(
  userId: string,
  patch: Partial<MindResetSettingsCard>,
): Promise<{ ok: true }> {
  const data: Record<string, unknown> = {};
  if (patch.goalMinutes !== undefined) data.goalMinutes = Math.round(clamp(patch.goalMinutes, 30, 960));
  if (patch.focusGoalMinutes !== undefined) {
    data.focusGoalMinutes = Math.round(clamp(patch.focusGoalMinutes, 5, 240));
  }
  if (patch.blockingOn !== undefined) data.blockingOn = Boolean(patch.blockingOn);
  if (patch.pauseStyle !== undefined) data.pauseStyle = patch.pauseStyle === "strict" ? "strict" : "reflective";
  if (patch.strictMode !== undefined) data.strictMode = Boolean(patch.strictMode);
  if (patch.securityLock !== undefined) data.securityLock = Boolean(patch.securityLock);
  if (patch.savePauseToDiary !== undefined) data.savePauseToDiary = Boolean(patch.savePauseToDiary);
  if (patch.shareWithSleep !== undefined) data.shareWithSleep = Boolean(patch.shareWithSleep);
  if (patch.shareWithHabits !== undefined) data.shareWithHabits = Boolean(patch.shareWithHabits);

  await prisma.mindResetSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  return { ok: true };
}

export async function purgeMindResetData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.mindResetDay.deleteMany({ where: { userId } }),
    prisma.mindResetLimit.deleteMany({ where: { userId } }),
    prisma.mindResetFocusSession.deleteMany({ where: { userId } }),
    prisma.mindResetPause.deleteMany({ where: { userId } }),
  ]);
}

export async function getMindResetExport(user: ServiceUser) {
  const [days, limits, sessions, pauses, settings] = await Promise.all([
    prisma.mindResetDay.findMany({ where: { userId: user.id }, orderBy: { dateKey: "asc" } }),
    prisma.mindResetLimit.findMany({ where: { userId: user.id } }),
    prisma.mindResetFocusSession.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" } }),
    prisma.mindResetPause.findMany({ where: { userId: user.id }, orderBy: { at: "desc" } }),
    getMindResetSettings(user.id),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    domain: "mindreset",
    settings,
    days: days.map((day) => ({
      dateKey: day.dateKey,
      screenMinutes: day.screenMinutes,
      pickups: day.pickups,
      focusMinutes: day.focusMinutes,
      nightMinutes: day.nightMinutes,
      apps: normalizeApps(day.apps),
      hours: normalizeHours(day.hours),
      source: day.source,
    })),
    limits: limits.map(toLimitCard),
    focusSessions: sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      plannedMinutes: session.plannedMinutes,
      actualMinutes: session.actualMinutes,
      blockedApps: session.blockedApps,
      completed: session.completed,
    })),
    pauses: pauses.map((pause) => ({
      id: pause.id,
      at: pause.at.toISOString(),
      app: pause.app,
      answer: pause.answer,
      moodTag: pause.moodTag,
      wentBack: pause.wentBack,
    })),
  };
}
