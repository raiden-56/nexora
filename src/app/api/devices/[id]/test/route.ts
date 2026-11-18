import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { testDevice } from "@/server/services/integrations";

export const POST = route<{ id: string }>(async (_req, { id }) => testDevice(await requireCtx("devices.view"), id));
