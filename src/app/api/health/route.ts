import { db } from "@/server/db";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";
export const GET = route(async () => ({ ok: true, schedulerLastTick: db().meta.schedulerLastTick, time: new Date().toISOString() }));
