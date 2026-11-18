import { describe, expect, it } from "vitest";
import { evaluateAll, evaluateCondition, type ConditionEnv } from "@/server/automation/conditions";
import { assignableRoles, can, hasPropertyAccess } from "@/lib/rbac";
import { validateCommand } from "@/server/services/devices";
import type { Device, Property, Room } from "@/lib/types";

const property = { id: "p", timezone: "Asia/Kolkata", mode: "home" } as Property;
const room = { id: "r", name: "Living Room", occupied: false } as Room;
const ac = { id: "ac", name: "Living AC", online: true, state: { on: false }, capabilities: ["onoff", "target_temp"] } as unknown as Device;
const sensor = { id: "s", name: "Sensor", online: true, state: { temperature: 29 } } as unknown as Device;
const env: ConditionEnv = { property, rooms: new Map([[room.id, room]]), devices: new Map([[ac.id, ac], [sensor.id, sensor]]), now: new Date("2026-11-18T06:00:00Z") };

describe("conditions", () => {
  it("blocks on unoccupied rooms", () => {
    expect(evaluateCondition({ type: "room_occupied", roomId: "r" }, env)).toEqual({ ok: false, reason: "Living Room is not occupied" });
  });
  it("passes temperature thresholds", () => {
    expect(evaluateCondition({ type: "temperature_above", deviceId: "s", value: 27 }, env).ok).toBe(true);
    expect(evaluateCondition({ type: "temperature_above", deviceId: "s", value: 30 }, env).ok).toBe(false);
  });
  it("checks day of week in the property's timezone", () => {
    // 2026-11-18 is a Wednesday (3)
    expect(evaluateCondition({ type: "day_of_week", days: [3] }, env).ok).toBe(true);
    expect(evaluateCondition({ type: "day_of_week", days: [0, 6] }, env).ok).toBe(false);
  });
  it("evaluateAll returns the first failing reason", () => {
    const r = evaluateAll([{ type: "property_mode", mode: "home" }, { type: "device_on", deviceId: "ac" }], env);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Living AC");
  });
});

describe("permissions", () => {
  it("guests can control but not manage", () => {
    expect(can("guest", "devices.control")).toBe(true);
    expect(can("guest", "automations.manage")).toBe(false);
    expect(can("staff", "users.invite")).toBe(false);
  });
  it("only owners may assign owner or property manager", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("hotel_manager")).not.toContain("owner");
    expect(assignableRoles("hotel_manager")).not.toContain("property_manager");
    expect(assignableRoles("staff")).toEqual([]);
  });
  it("scopes property access", () => {
    expect(hasPropertyAccess(null, "x")).toBe(true);
    expect(hasPropertyAccess(["a"], "x")).toBe(false);
  });
});

describe("device command validation", () => {
  it("rejects commands outside the device's capabilities", () => {
    expect(() => validateCommand(ac, { brightness: 50 })).toThrow(/does not support/);
  });
  it("rejects out-of-range values", () => {
    expect(() => validateCommand(ac, { targetTemp: 10 })).toThrow();
  });
  it("accepts supported commands", () => {
    expect(validateCommand(ac, { on: true, targetTemp: 24 })).toEqual({ on: true, targetTemp: 24 });
  });
});
