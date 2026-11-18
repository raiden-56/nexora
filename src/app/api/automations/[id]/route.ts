import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { deleteAutomation, getAutomation, listExecutions, updateAutomation, withNext } from "@/server/services/automations";

type P = { id: string };
export const GET = route<P>(async (_req, { id }) => {
  const ctx = await requireCtx("devices.view");
  return { automation: withNext(getAutomation(ctx, id)), executions: listExecutions(ctx, { automationId: id, limit: 25 }) };
});
export const PATCH = route<P>(async (req, { id }) => updateAutomation(await requireCtx(), id, await body(req, z.record(z.string(), z.any()))));
export const DELETE = route<P>(async (_req, { id }) => {
  deleteAutomation(await requireCtx(), id);
  return { ok: true };
});
