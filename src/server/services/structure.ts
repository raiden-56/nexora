import "@/server/guard";
import { z } from "zod";
import type { Floor, Property, Room, RoomKind } from "@/lib/types";
import { ApiError, type Ctx } from "../auth";
import { db, persist } from "../db";
import { id, nowIso } from "../util";

const ROOM_KINDS = ["living", "kitchen", "dining", "bedroom", "bathroom", "study", "balcony", "office", "meeting", "lobby", "guest_room", "corridor", "utility", "server"] as const;

export const propertySchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["home", "villa", "apartment", "office", "coworking", "hotel", "resort", "warehouse", "campus"]),
  address: z.string().trim().max(200).default(""),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "unknown timezone"),
  lat: z.number().min(-90).max(90).default(0),
  lng: z.number().min(-180).max(180).default(0),
  tariffPerKwh: z.number().min(0).max(1000).default(8),
  currency: z.string().length(3).default("INR"),
  floors: z
    .array(z.object({ name: z.string().trim().min(1).max(40), rooms: z.array(z.object({ name: z.string().trim().min(1).max(40), kind: z.enum(ROOM_KINDS) })).max(40) }))
    .max(60)
    .optional(),
});

function requireManage(ctx: Ctx) {
  if (!ctx.can("properties.manage")) throw new ApiError(403, "Your role can't change properties, floors or rooms.");
}

/** Auto-layout rooms on the 12×8 floor-plan grid. */
function layout(index: number, total: number): Room["plan"] {
  const cols = total <= 2 ? total : total <= 4 ? 2 : 3;
  const rows = Math.ceil(total / cols);
  const w = Math.floor(12 / cols);
  const h = Math.floor(8 / rows);
  return { x: (index % cols) * w, y: Math.floor(index / cols) * h, w, h };
}

export function createProperty(ctx: Ctx, input: z.infer<typeof propertySchema>) {
  requireManage(ctx);
  if (ctx.membership.propertyIds !== null) throw new ApiError(403, "Property-scoped members can't create new properties.");
  const d = db();
  const p: Property = { ...input, id: id("prp_"), orgId: ctx.orgId, mode: "home", createdAt: nowIso() };
  delete (p as Partial<typeof input>).floors;
  d.properties.push(p);
  const b = { id: id("bld_"), orgId: ctx.orgId, propertyId: p.id, name: "Main building" };
  d.buildings.push(b);
  (input.floors ?? [{ name: "Ground Floor", rooms: [] }]).forEach((f, i) => {
    const floor: Floor = { id: id("flr_"), orgId: ctx.orgId, propertyId: p.id, buildingId: b.id, name: f.name, order: i };
    d.floors.push(floor);
    f.rooms.forEach((r, j) => d.rooms.push({ id: id("rm_"), orgId: ctx.orgId, propertyId: p.id, floorId: floor.id, name: r.name, kind: r.kind, order: j, occupied: false, plan: layout(j, f.rooms.length) }));
  });
  ctx.session.activePropertyId = p.id;
  persist();
  return p;
}

export function updateProperty(ctx: Ctx, propertyId: string, input: Partial<z.infer<typeof propertySchema>> & { mode?: Property["mode"] }) {
  ctx.assertProperty(propertyId);
  const p = db().properties.find((x) => x.id === propertyId)!;
  // Mode changes (Home/Away/Night) are a control action; other edits need management rights.
  const onlyMode = Object.keys(input).every((k) => k === "mode");
  if (onlyMode) {
    if (!ctx.can("devices.control")) throw new ApiError(403, "Your role can't change the property mode.");
  } else requireManage(ctx);
  const parsed = propertySchema.partial().extend({ mode: z.enum(["home", "away", "night", "vacation"]).optional() }).parse(input);
  delete parsed.floors;
  Object.assign(p, parsed);
  persist();
  return p;
}

export function deleteProperty(ctx: Ctx, propertyId: string) {
  requireManage(ctx);
  ctx.assertProperty(propertyId);
  const d = db();
  if (d.properties.filter((p) => p.orgId === ctx.orgId).length <= 1) throw new ApiError(409, "An organization needs at least one property.");
  const keep = <T extends { propertyId: string | null }>(arr: T[]) => arr.filter((x) => x.propertyId !== propertyId);
  d.properties = d.properties.filter((p) => p.id !== propertyId);
  d.buildings = keep(d.buildings);
  d.floors = keep(d.floors);
  d.rooms = keep(d.rooms);
  d.devices = keep(d.devices);
  d.automations = keep(d.automations);
  d.scenes = keep(d.scenes);
  if (ctx.session.activePropertyId === propertyId) ctx.session.activePropertyId = null;
  persist();
}

export function selectProperty(ctx: Ctx, propertyId: string) {
  ctx.assertProperty(propertyId);
  ctx.session.activePropertyId = propertyId;
  persist();
}

// ─── Floors ───────────────────────────────────────────────
export function createFloor(ctx: Ctx, propertyId: string, name: string) {
  requireManage(ctx);
  ctx.assertProperty(propertyId);
  const d = db();
  const building = d.buildings.find((b) => b.propertyId === propertyId);
  if (!building) throw new ApiError(404, "Building not found.");
  const order = d.floors.filter((f) => f.propertyId === propertyId).length;
  const f: Floor = { id: id("flr_"), orgId: ctx.orgId, propertyId, buildingId: building.id, name: z.string().trim().min(1).max(40).parse(name), order };
  d.floors.push(f);
  persist();
  return f;
}

function getFloor(ctx: Ctx, floorId: string) {
  const f = db().floors.find((x) => x.id === floorId && x.orgId === ctx.orgId);
  if (!f) throw new ApiError(404, "Floor not found.");
  ctx.assertProperty(f.propertyId);
  return f;
}

export function renameFloor(ctx: Ctx, floorId: string, name: string) {
  requireManage(ctx);
  const f = getFloor(ctx, floorId);
  f.name = z.string().trim().min(1).max(40).parse(name);
  persist();
  return f;
}

export function deleteFloor(ctx: Ctx, floorId: string) {
  requireManage(ctx);
  const f = getFloor(ctx, floorId);
  const d = db();
  const roomIds = d.rooms.filter((r) => r.floorId === f.id).map((r) => r.id);
  if (d.devices.some((x) => roomIds.includes(x.roomId))) throw new ApiError(409, "Move or remove the devices on this floor before deleting it.");
  d.rooms = d.rooms.filter((r) => r.floorId !== f.id);
  d.floors = d.floors.filter((x) => x.id !== f.id);
  persist();
}

export function reorder<T extends { id: string; order: number }>(items: T[], ids: string[]) {
  ids.forEach((x, i) => {
    const it = items.find((r) => r.id === x);
    if (it) it.order = i;
  });
}

export function reorderFloors(ctx: Ctx, propertyId: string, ids: string[]) {
  requireManage(ctx);
  ctx.assertProperty(propertyId);
  reorder(db().floors.filter((f) => f.propertyId === propertyId), ids);
  persist();
}

// ─── Rooms ────────────────────────────────────────────────
export const roomSchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(ROOM_KINDS),
  floorId: z.string(),
  department: z.string().max(40).optional(),
});

export function createRoom(ctx: Ctx, input: z.infer<typeof roomSchema>) {
  requireManage(ctx);
  const f = getFloor(ctx, input.floorId);
  const d = db();
  const siblings = d.rooms.filter((r) => r.floorId === f.id);
  const r: Room = { id: id("rm_"), orgId: ctx.orgId, propertyId: f.propertyId, floorId: f.id, name: input.name, kind: input.kind as RoomKind, order: siblings.length, occupied: false, plan: layout(siblings.length, siblings.length + 1), department: input.department };
  if (r.kind === "guest_room") r.hotel = { status: "vacant", number: r.name.replace(/\D/g, "") || undefined };
  d.rooms.push(r);
  // re-flow the floor plan so the new room fits
  [...siblings, r].forEach((x, i, all) => (x.plan = layout(i, all.length)));
  persist();
  return r;
}

export function getRoom(ctx: Ctx, roomId: string) {
  const r = db().rooms.find((x) => x.id === roomId && x.orgId === ctx.orgId);
  if (!r) throw new ApiError(404, "Room not found.");
  ctx.assertProperty(r.propertyId);
  return r;
}

export function updateRoom(ctx: Ctx, roomId: string, input: Partial<z.infer<typeof roomSchema>> & { occupied?: boolean }) {
  const r = getRoom(ctx, roomId);
  const onlyOccupancy = Object.keys(input).every((k) => k === "occupied");
  if (onlyOccupancy) {
    if (!ctx.can("devices.control")) throw new ApiError(403, "Your role can't change occupancy.");
  } else requireManage(ctx);
  const parsed = roomSchema.partial().extend({ occupied: z.boolean().optional() }).parse(input);
  if (parsed.floorId) getFloor(ctx, parsed.floorId);
  Object.assign(r, parsed);
  persist();
  return r;
}

export function deleteRoom(ctx: Ctx, roomId: string) {
  requireManage(ctx);
  const r = getRoom(ctx, roomId);
  const d = db();
  if (d.devices.some((x) => x.roomId === r.id)) throw new ApiError(409, "Move or remove this room's devices before deleting it.");
  d.rooms = d.rooms.filter((x) => x.id !== r.id);
  persist();
}

export function reorderRooms(ctx: Ctx, floorId: string, ids: string[]) {
  requireManage(ctx);
  const f = getFloor(ctx, floorId);
  const rooms = db().rooms.filter((r) => r.floorId === f.id);
  reorder(rooms, ids);
  rooms.sort((a, b) => a.order - b.order).forEach((x, i, all) => (x.plan = layout(i, all.length)));
  persist();
}
