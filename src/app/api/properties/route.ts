import { requireCtx } from "@/server/auth";
import { body, route } from "@/server/http";
import { createProperty, propertySchema } from "@/server/services/structure";

export const POST = route(async (req) => createProperty(await requireCtx(), await body(req, propertySchema)));
