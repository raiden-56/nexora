import "@/server/guard";
import { z } from "zod";
import type { DeviceCommand, Room } from "@/lib/types";
import { ApiError, type Ctx } from "../auth";
import { db, persist } from "../db";
import { executeDeviceCommand } from "./devices";
import { logActivity, notify } from "./log";
import { nowIso } from "../util";

export const hotelActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checkin"), guestName: z.string().trim().min(2).max(80), welcomeTemp: z.number().min(18).max(28).default(23) }),
  z.object({ action: z.literal("checkout") }),
  z.object({ action: z.literal("housekeeping") }),
  z.object({ action: z.literal("clean") }),
  z.object({ action: z.literal("maintenance"), on: z.boolean() }),
]);

/**
 * Guest-room workflows. Essential loads (locks, minibars, emergency lighting, life-safety relays)
 * are never switched off by these workflows. Every device step reports its real outcome.
 */
export async function hotelRoomAction(ctx: Ctx, roomId: string, input: z.infer<typeof hotelActionSchema>) {
  if (!ctx.can("hotel.operate")) throw new ApiError(403, "Your role can't operate hotel rooms.");
  const d = db();
  const room = d.rooms.find((r) => r.id === roomId && r.orgId === ctx.orgId);
  if (!room || room.kind !== "guest_room") throw new ApiError(404, "Guest room not found.");
  ctx.assertProperty(room.propertyId);
  room.hotel ??= { status: "vacant" };
  const devices = d.devices.filter((x) => x.roomId === room.id);
  const results: { device: string; ok: boolean; detail?: string }[] = [];

  const run = async (filter: (t: string) => boolean, cmd: (t: string) => DeviceCommand | null) => {
    for (const dev of devices.filter((x) => filter(x.type))) {
      const c = cmd(dev.type);
      if (!c) continue;
      if (c.on === false && dev.essential) continue;
      const r = await executeDeviceCommand({ device: dev, command: c, source: "system", userId: ctx.user.id, userName: ctx.user.name, maxAttempts: 2 }).catch((e: Error) => ({ ok: false, error: e.message }));
      results.push({ device: dev.name, ok: r.ok, detail: "error" in r ? r.error : undefined });
    }
  };

  const label = room.hotel.number ? `Room ${room.hotel.number}` : room.name;
  switch (input.action) {
    case "checkin": {
      if (room.hotel.status === "occupied") throw new ApiError(409, `${label} is already occupied.`);
      if (room.hotel.status === "maintenance") throw new ApiError(409, `${label} is under maintenance.`);
      room.hotel = { ...room.hotel, status: "occupied", guestName: input.guestName, checkInAt: nowIso() };
      room.occupied = true;
      await run(
        (t) => ["bulb", "led_strip", "ac", "curtain", "blind"].includes(t),
        (t) => (t === "ac" ? { on: true, targetTemp: input.welcomeTemp, mode: "cool" } : t === "curtain" || t === "blind" ? { position: 60 } : { on: true, brightness: 70, ...(t === "bulb" ? { colorTemp: 3000 } : {}) }),
      );
      notify({ orgId: ctx.orgId, propertyId: room.propertyId, type: "hotel", severity: "success", title: `${input.guestName} checked in to ${label}`, body: "Welcome mode applied: warm lighting, curtains open, AC at " + input.welcomeTemp + "°C.", link: "/hotel" });
      break;
    }
    case "checkout": {
      if (room.hotel.status !== "occupied") throw new ApiError(409, `${label} has no checked-in guest.`);
      const guest = room.hotel.guestName;
      room.hotel = { status: "checkout", number: room.hotel.number };
      room.occupied = false;
      await run(() => true, (t) => (["bulb", "led_strip", "ac", "fan", "switch", "plug", "ventilation"].includes(t) ? { on: false } : t === "curtain" || t === "blind" ? { position: 0 } : null));
      notify({ orgId: ctx.orgId, propertyId: room.propertyId, type: "hotel", severity: "info", title: `${label} ready for housekeeping`, body: `${guest ?? "Guest"} checked out. Non-essential loads switched off; locks, minibar and safety systems untouched.`, link: "/hotel" });
      break;
    }
    case "housekeeping": {
      if (room.hotel.status === "occupied") throw new ApiError(409, `Check the guest out of ${label} first, or ask before entering.`);
      room.hotel.status = "cleaning";
      await run((t) => ["bulb", "curtain", "blind", "ac"].includes(t), (t) => (t === "bulb" ? { on: true, brightness: 100, colorTemp: 5000 } : t === "ac" ? { on: false } : { position: 100 }));
      break;
    }
    case "clean": {
      room.hotel = { status: "vacant", number: room.hotel.number };
      await run((t) => ["bulb", "led_strip", "ac"].includes(t), () => ({ on: false }));
      await run((t) => ["curtain", "blind"].includes(t), () => ({ position: 0 }));
      break;
    }
    case "maintenance": {
      room.hotel = { status: input.on ? "maintenance" : "vacant", number: room.hotel.number };
      room.occupied = false;
      break;
    }
  }
  logActivity({ orgId: ctx.orgId, propertyId: room.propertyId, userId: ctx.user.id, userName: ctx.user.name, deviceId: null, deviceName: null, action: `Hotel: ${input.action} ${label}`, previous: null, next: room.hotel.status, source: "user", automationId: null });
  persist();
  return { room: room as Room, results, failed: results.filter((r) => !r.ok).length };
}
