import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { bulkControl, commandSchema } from "@/server/services/devices";

const schema = z.object({ deviceIds: z.array(z.string()).min(1).max(500), command: commandSchema });
export const POST = route(async (req) => {
  const { deviceIds, command } = await body(req, schema);
  return bulkControl(await requireCtx(), deviceIds, command);
});
