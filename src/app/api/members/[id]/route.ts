import { z } from "zod";
import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { removeMember, updateMember } from "@/server/services/members";

type P = { id: string };
const schema = z.object({
  role: z.enum(["owner", "property_manager", "facility_manager", "hotel_manager", "staff", "resident", "guest"]).optional(),
  propertyIds: z.array(z.string()).nullable().optional(),
});
export const PATCH = route<P>(async (req, { id }) => updateMember(await requireCtx(), id, await body(req, schema)));
export const DELETE = route<P>(async (_req, { id }) => {
  removeMember(await requireCtx(), id);
  return { ok: true };
});
