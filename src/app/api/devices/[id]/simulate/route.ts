import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { simulateDevice } from "@/server/services/devices";

const schema = z.object({
  online: z.boolean().optional(),
  motion: z.boolean().optional(),
  contact: z.enum(["open", "closed"]).optional(),
  temperature: z.number().min(-20).max(60).optional(),
});
export const POST = route<{ id: string }>(async (req, { id }) => simulateDevice(await requireCtx("devices.control"), id, await body(req, schema)));
