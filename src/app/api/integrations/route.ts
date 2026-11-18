import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { createIntegration, integrationSchema, listIntegrations } from "@/server/services/integrations";

export const GET = route(async () => ({ integrations: listIntegrations(await requireCtx("devices.view")) }));
export const POST = route(async (req) => createIntegration(await requireCtx(), await body(req, integrationSchema)));
