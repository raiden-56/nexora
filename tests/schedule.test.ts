import { describe, expect, it } from "vitest";
import { dueOccurrences, sunTimes, upcomingOccurrences, zonedParts, zonedToUtc } from "@/server/automation/time";

const kolkata = { timezone: "Asia/Kolkata", lat: 12.97, lng: 77.64 };
const newYork = { timezone: "America/New_York", lat: 40.71, lng: -74.0 };
const daily = [0, 1, 2, 3, 4, 5, 6];

describe("zoned time", () => {
  it("converts local wall time to UTC", () => {
    const at = zonedToUtc(2026, 11, 18, 18 * 60 + 30, "Asia/Kolkata");
    expect(at.toISOString()).toBe("2026-11-18T13:00:00.000Z");
    expect(zonedParts(at, "Asia/Kolkata").hhmm).toBe("18:30");
  });
});

describe("dueOccurrences", () => {
  const a = { id: "a1", trigger: { type: "time" as const, time: "18:30", days: daily }, end: { time: "23:00" } };

  it("fires exactly once when a tick window contains the trigger minute", () => {
    const from = new Date("2026-11-18T12:59:40Z");
    const to = new Date("2026-11-18T13:00:10Z");
    const occ = dueOccurrences(a, kolkata, from, to);
    expect(occ).toHaveLength(1);
    expect(occ[0].phase).toBe("start");
    expect(occ[0].dedupeKey).toBe("a1:start:2026-11-18T18:30");
  });

  it("does not fire in adjacent windows (no double execution)", () => {
    const w1 = dueOccurrences(a, kolkata, new Date("2026-11-18T12:59:00Z"), new Date("2026-11-18T13:00:00Z"));
    const w2 = dueOccurrences(a, kolkata, new Date("2026-11-18T13:00:00Z"), new Date("2026-11-18T13:01:00Z"));
    expect(w1.length + w2.length).toBe(1);
  });

  it("emits the end phase at the end time", () => {
    const occ = dueOccurrences(a, kolkata, new Date("2026-11-18T17:29:00Z"), new Date("2026-11-18T17:31:00Z"));
    expect(occ.map((o) => o.phase)).toEqual(["end"]);
  });

  it("respects selected weekdays", () => {
    const weekdays = { id: "w", trigger: { type: "time" as const, time: "09:00", days: [1, 2, 3, 4, 5] }, end: null };
    // 2026-11-21 is a Saturday
    expect(dueOccurrences(weekdays, kolkata, new Date("2026-11-21T03:29:00Z"), new Date("2026-11-21T03:31:00Z"))).toHaveLength(0);
    // 2026-11-23 is a Monday
    expect(dueOccurrences(weekdays, kolkata, new Date("2026-11-23T03:29:00Z"), new Date("2026-11-23T03:31:00Z"))).toHaveLength(1);
  });

  it("fires a time skipped by DST spring-forward right after the gap", () => {
    // 2027-03-14 02:00 → 03:00 in New York; 02:30 does not exist
    const dst = { id: "d", trigger: { type: "time" as const, time: "02:30", days: daily }, end: null };
    const occ = dueOccurrences(dst, newYork, new Date("2027-03-14T06:50:00Z"), new Date("2027-03-14T07:10:00Z"));
    expect(occ).toHaveLength(1);
    expect(zonedParts(occ[0].at, "America/New_York").hhmm).toBe("03:00");
  });

  it("uses one dedupe key for a time repeated by DST fall-back", () => {
    // 2026-11-01 01:30 happens twice in New York
    const fb = { id: "f", trigger: { type: "time" as const, time: "01:30", days: daily }, end: null };
    const occ = dueOccurrences(fb, newYork, new Date("2026-11-01T05:00:00Z"), new Date("2026-11-01T07:00:00Z"));
    expect(occ.length).toBe(2);
    expect(new Set(occ.map((o) => o.dedupeKey)).size).toBe(1); // executor dedupes → runs once
  });
});

describe("sun times", () => {
  it("computes a plausible Bengaluru sunset", () => {
    const s = sunTimes(2026, 11, 18, kolkata.lat, kolkata.lng)!;
    const local = zonedParts(s.sunset, "Asia/Kolkata");
    expect(local.minutes).toBeGreaterThan(17 * 60 + 40);
    expect(local.minutes).toBeLessThan(18 * 60 + 10);
  });

  it("lists upcoming occurrences in order", () => {
    const a = { id: "u", trigger: { type: "time" as const, time: "07:00", days: daily }, end: { time: "08:00" } };
    const up = upcomingOccurrences(a, kolkata, new Date("2026-11-18T00:00:00Z"), 2, 4);
    expect(up.map((u) => u.phase)).toEqual(["start", "end", "start", "end"]);
    expect(up[0].at < up[1].at).toBe(true);
  });
});
