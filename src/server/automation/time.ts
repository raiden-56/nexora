/**
 * Pure, timezone-aware scheduling maths. No I/O — fully unit tested (tests/schedule.test.ts).
 *
 * Every property stores an IANA timezone. Triggers are expressed in local wall-clock time
 * ("18:30 every weekday") and evaluated against real instants, so daylight-saving shifts are
 * handled: a time skipped by a spring-forward gap fires at the first valid minute after the
 * gap, and a time repeated by a fall-back overlap fires once (dedupe key = local date + time).
 */
import type { Automation, Property } from "@/lib/types";

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  ymd: string; // 2026-11-18
  hhmm: string; // 18:30
  minutes: number; // minutes since local midnight
  dow: number; // 0 = Sunday
  y: number;
  m: number;
  d: number;
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = Object.fromEntries(fmt(tz).formatToParts(date).map((p) => [p.type, p.value]));
  const hh = parts.hour === "24" ? "00" : parts.hour;
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${hh}:${parts.minute}`,
    minutes: Number(hh) * 60 + Number(parts.minute),
    dow: DOW[parts.weekday as string],
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
  };
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Offset (minutes) of `tz` from UTC at the given instant. */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, Math.floor(p.minutes / 60), p.minutes % 60);
  const actual = Math.floor(date.getTime() / 60000) * 60000;
  return Math.round((asUtc - actual) / 60000);
}

/** Convert a local wall-clock time in `tz` to a UTC instant. */
export function zonedToUtc(y: number, m: number, d: number, minutes: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let offset = tzOffsetMinutes(new Date(guess), tz);
  let result = guess - offset * 60000;
  const offset2 = tzOffsetMinutes(new Date(result), tz);
  if (offset2 !== offset) {
    offset = offset2;
    result = guess - offset * 60000;
  }
  return new Date(result);
}

// ─── Sunrise / sunset (NOAA-style sunrise equation, ±2 min) ──────────
const rad = Math.PI / 180;
export function sunTimes(y: number, m: number, d: number, lat: number, lng: number): { sunrise: Date; sunset: Date } | null {
  const jDate = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const n = Math.round(jDate - 2451545 + 0.0008);
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDec = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDec) / (Math.cos(lat * rad) * cosDec);
  if (cosW < -1 || cosW > 1) return null; // polar day / night
  const w = Math.acos(cosW) / rad;
  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000);
  return { sunrise: toDate(jTransit - w / 360), sunset: toDate(jTransit + w / 360) };
}

/** Local minute-of-day at which a trigger (or end) fires on a given local date, or null if it doesn't run that day. */
export function targetMinute(automation: Pick<Automation, "trigger">, property: Pick<Property, "lat" | "lng" | "timezone">, local: ZonedParts): number | null {
  const t = automation.trigger;
  if (t.type === "time") {
    if (t.days.length && !t.days.includes(local.dow)) return null;
    return toMinutes(t.time);
  }
  if (t.type === "sunrise" || t.type === "sunset") {
    if (t.days.length && !t.days.includes(local.dow)) return null;
    const sun = sunTimes(local.y, local.m, local.d, property.lat, property.lng);
    if (!sun) return null;
    const at = new Date((t.type === "sunrise" ? sun.sunrise : sun.sunset).getTime() + t.offsetMin * 60000);
    return zonedParts(at, property.timezone).minutes;
  }
  return null;
}

export interface Occurrence {
  phase: "start" | "end";
  at: Date;
  dedupeKey: string;
}

function endMinute(automation: Pick<Automation, "trigger" | "end">, local: ZonedParts): number | null {
  if (!automation.end) return null;
  const t = automation.trigger;
  if ((t.type === "time" || t.type === "sunrise" || t.type === "sunset") && t.days.length && !t.days.includes(local.dow)) return null;
  return toMinutes(automation.end.time);
}

/**
 * Occurrences due in the half-open window (from, to]. The scheduler calls this every tick
 * with from = last tick, so nothing is missed between ticks and nothing fires twice.
 */
export function dueOccurrences(
  automation: Pick<Automation, "id" | "trigger" | "end">,
  property: Pick<Property, "lat" | "lng" | "timezone">,
  from: Date,
  to: Date,
): Occurrence[] {
  const out: Occurrence[] = [];
  const start = Math.floor(from.getTime() / 60000) + 1;
  const end = Math.floor(to.getTime() / 60000);
  let prev = zonedParts(new Date((start - 1) * 60000), property.timezone);
  for (let minute = start; minute <= end; minute++) {
    const at = new Date(minute * 60000);
    const cur = zonedParts(at, property.timezone);
    for (const phase of ["start", "end"] as const) {
      const target = phase === "start" ? targetMinute(automation, property, cur) : endMinute(automation, cur);
      if (target === null) continue;
      const exact = cur.minutes === target;
      // DST spring-forward: wall clock jumped over the target minute
      const skipped = prev.ymd === cur.ymd && cur.minutes - prev.minutes > 1 && target > prev.minutes && target < cur.minutes;
      if (exact || skipped) out.push({ phase, at, dedupeKey: `${automation.id}:${phase}:${cur.ymd}T${fromMinutes(target)}` });
    }
    prev = cur;
  }
  return out;
}

/** Next `count` occurrences from `from` within `days` days — used for the schedule timeline. */
export function upcomingOccurrences(
  automation: Pick<Automation, "id" | "trigger" | "end">,
  property: Pick<Property, "lat" | "lng" | "timezone">,
  from: Date,
  days = 7,
  count = 6,
): Occurrence[] {
  const out: Occurrence[] = [];
  for (let i = 0; i <= days && out.length < count; i++) {
    const day = zonedParts(new Date(from.getTime() + i * 86400000), property.timezone);
    const phases: ["start" | "end", number | null][] = [
      ["start", targetMinute(automation, property, day)],
      ["end", endMinute(automation, day)],
    ];
    for (const [phase, minute] of phases.sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))) {
      if (minute === null) continue;
      const at = zonedToUtc(day.y, day.m, day.d, minute, property.timezone);
      if (at.getTime() <= from.getTime()) continue;
      out.push({ phase, at, dedupeKey: `${automation.id}:${phase}:${day.ymd}T${fromMinutes(minute)}` });
      if (out.length >= count) break;
    }
  }
  return out;
}
