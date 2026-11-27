/**
 * Prayer times engine.
 *
 * A small, dependency-free implementation of the standard solar calculation
 * used by most timetables: the sun's declination and equation of time give
 * solar noon, and each prayer is an hour angle either side of it. Methods
 * differ only in the twilight angles; Asr depends on the juristic shadow
 * factor; high latitudes fall back to a night-fraction rule because the sun
 * may never reach the required angle there.
 *
 * Times are returned as minutes after local midnight for one date key, so the
 * caller can render them without worrying about instants or DST.
 *
 * No network, no location upload: latitude and longitude stay in the user's
 * own row and are only used here.
 */

import { calcMethod, type CalcMethodKey } from "./constants";
import { tzOffsetMs } from "@/lib/time";

const DEG = Math.PI / 180;

const dsin = (value: number) => Math.sin(value * DEG);
const dcos = (value: number) => Math.cos(value * DEG);
const dtan = (value: number) => Math.tan(value * DEG);
const darcsin = (value: number) => Math.asin(value) / DEG;
const darccos = (value: number) => Math.acos(value) / DEG;
const darctan2 = (y: number, x: number) => Math.atan2(y, x) / DEG;
const darccot = (value: number) => Math.atan(1 / value) / DEG;

function fix(value: number, range: number): number {
  const result = value - range * Math.floor(value / range);
  return result < 0 ? result + range : result;
}

const fixAngle = (value: number) => fix(value, 360);
const fixHour = (value: number) => fix(value, 24);

/** Julian day at 00:00 UT for a calendar date. */
function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

/** Sun declination (degrees) and equation of time (hours) for a Julian day. */
function sunPosition(jd: number): { declination: number; equationOfTime: number } {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const rightAscension = fixHour(darctan2(dcos(e) * dsin(l), dcos(l)) / 15);
  const declination = darcsin(dsin(e) * dsin(l));
  const equationOfTime = q / 15 - rightAscension;
  return { declination, equationOfTime };
}

export interface PrayerTimeSet {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface TimesInput {
  dateKey: string;
  timezone: string;
  latitude: number;
  longitude: number;
  method: CalcMethodKey | string;
  asrMethod: string;
  highLatitude: string;
  adjustMinutes?: number;
}

const DEFAULT_SUN_ANGLE = 0.833;

/** Minutes after local midnight, clamped into one day. */
function toMinutes(hours: number, adjust: number): number {
  if (!Number.isFinite(hours)) return Number.NaN;
  const minutes = Math.round(hours * 60) + adjust;
  return ((minutes % 1440) + 1440) % 1440;
}

/** Compute the five prayer times for one local date. */
export function computePrayerTimes(input: TimesInput): PrayerTimeSet {
  const { dateKey, timezone, latitude, longitude, asrMethod, highLatitude } = input;
  const method = calcMethod(input.method);
  const adjust = Number.isFinite(input.adjustMinutes) ? Number(input.adjustMinutes) : 0;

  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return { fajr: 300, sunrise: 360, dhuhr: 720, asr: 900, maghrib: 1080, isha: 1140 };
  }

  // The offset for local noon is used for the whole day, which keeps the
  // calculation stable across a DST boundary instead of jumping an hour.
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetHours = tzOffsetMs(noonUtc, timezone) / 3_600_000;

  const jd = julianDay(year, month, day);
  const { declination, equationOfTime } = sunPosition(jd);

  const solarNoon = 12 + offsetHours - longitude / 15 - equationOfTime;

  /** Hour angle (in hours) to the sun being `angle` degrees *below* the horizon. */
  function depressionHourAngle(angle: number): number {
    const numerator = -dsin(angle) - dsin(latitude) * dsin(declination);
    const denominator = dcos(latitude) * dcos(declination);
    const cosH = numerator / denominator;
    if (!Number.isFinite(cosH) || cosH > 1 || cosH < -1) return Number.NaN;
    return darccos(cosH) / 15;
  }

  /** Hour angle (in hours) to the sun reaching an altitude *above* the horizon. */
  function altitudeHourAngle(altitude: number): number {
    const numerator = dsin(altitude) - dsin(latitude) * dsin(declination);
    const denominator = dcos(latitude) * dcos(declination);
    const cosH = numerator / denominator;
    if (!Number.isFinite(cosH) || cosH > 1 || cosH < -1) return Number.NaN;
    return darccos(cosH) / 15;
  }

  const sunriseAngle = depressionHourAngle(DEFAULT_SUN_ANGLE);
  const sunrise = solarNoon - sunriseAngle;
  const sunset = solarNoon + sunriseAngle;

  // Asr is defined by the sun's altitude, not its depression, so it needs the
  // opposite sign to the twilight angles.
  const shadowFactor = asrMethod === "hanafi" ? 2 : 1;
  const asrAngle = darccot(shadowFactor + dtan(Math.abs(latitude - declination)));
  const asrHourAngle = altitudeHourAngle(asrAngle);
  const asr = Number.isFinite(asrHourAngle) ? solarNoon + asrHourAngle : solarNoon + 3;

  let fajr = solarNoon - depressionHourAngle(method.fajrAngle);
  let isha =
    method.ishaInterval != null
      ? sunset + method.ishaInterval / 60
      : solarNoon + depressionHourAngle(method.ishaAngle);

  // High latitude: when the sun never reaches the twilight angle, spread the
  // night by a rule the person picked. This is guidance, not a ruling.
  const nightLength = Number.isFinite(sunrise) && Number.isFinite(sunset) ? 24 - (sunset - sunrise) : Number.NaN;
  const portion = (angle: number) => {
    if (!Number.isFinite(nightLength)) return Number.NaN;
    if (highLatitude === "middle") return nightLength / 2;
    if (highLatitude === "seventh") return nightLength / 7;
    return (angle / 60) * nightLength;
  };

  if (!Number.isFinite(fajr) && Number.isFinite(sunrise)) {
    fajr = sunrise - portion(method.fajrAngle);
  }
  if (!Number.isFinite(isha) && Number.isFinite(sunset)) {
    isha = sunset + portion(method.ishaInterval != null ? 18 : method.ishaAngle);
  }

  // Polar day/night: fall back to calm, ordered approximations rather than
  // showing nothing. The settings page tells the person to use a local
  // timetable above 48° latitude.
  if (!Number.isFinite(fajr) || !Number.isFinite(sunrise) || !Number.isFinite(isha)) {
    return { fajr: 300, sunrise: 360, dhuhr: 720, asr: 900, maghrib: 1080, isha: 1140 };
  }

  const times = {
    fajr: toMinutes(fajr, adjust),
    sunrise: toMinutes(sunrise, adjust),
    dhuhr: toMinutes(solarNoon, adjust),
    asr: toMinutes(asr, adjust),
    maghrib: toMinutes(sunset, adjust),
    isha: toMinutes(isha, adjust),
  };

  // Keep the sequence sane if a time crossed midnight after adjustment.
  if (times.sunrise < times.fajr) times.sunrise = times.fajr + 45;
  if (times.dhuhr < times.sunrise) times.dhuhr = times.sunrise + 60;
  if (times.asr < times.dhuhr) times.asr = times.dhuhr + 90;
  if (times.maghrib < times.asr) times.maghrib = times.asr + 60;
  if (times.isha < times.maghrib) times.isha = times.maghrib + 60;

  return times;
}

export interface PrayerWindow {
  key: "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
  start: number;
  end: number;
}

/** The five windows: from each adhan to the next prayer's adhan. */
export function prayerWindows(times: PrayerTimeSet): PrayerWindow[] {
  return [
    { key: "fajr", start: times.fajr, end: times.sunrise },
    { key: "dhuhr", start: times.dhuhr, end: times.asr },
    { key: "asr", start: times.asr, end: times.maghrib },
    { key: "maghrib", start: times.maghrib, end: times.isha },
    { key: "isha", start: times.isha, end: 1440 },
  ];
}

/** The next window that has not started yet, or tomorrow's Fajr. */
export function nextPrayer(
  times: PrayerTimeSet,
  nowMinutes: number,
): { key: PrayerWindow["key"]; start: number; minutesUntil: number; tomorrow: boolean } {
  const window = prayerWindows(times).find((entry) => entry.start > nowMinutes);
  if (window) {
    return { key: window.key, start: window.start, minutesUntil: window.start - nowMinutes, tomorrow: false };
  }
  return {
    key: "fajr",
    start: times.fajr,
    minutesUntil: 1440 - nowMinutes + times.fajr,
    tomorrow: true,
  };
}

/** The window containing `nowMinutes`, if any. */
export function currentWindow(times: PrayerTimeSet, nowMinutes: number): PrayerWindow | null {
  return prayerWindows(times).find((entry) => nowMinutes >= entry.start && nowMinutes < entry.end) ?? null;
}
