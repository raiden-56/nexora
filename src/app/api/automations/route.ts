import { requireCtx } from "@/server/auth";
import { body, query, route } from "@/server/http";
import { automationSchema, createAutomation, listAutomations } from "@/server/services/automations";

export const GET = route(async (req) => {
  const ctx = await requireCtx("devices.view");
  return { automations: listAutomations(ctx, query(req).get("propertyId") ?? ctx.propertyId) };
});
export const POST = route(async (req) => createAutomation(await requireCtx(), await body(req, automationSchema)));
