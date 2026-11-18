import { z } from "zod";
import { ApiError, publicUser, readSession } from "@/server/auth";
import { persist } from "@/server/db";
import { body, route } from "@/server/http";

export const PATCH = route(async (req) => {
  const auth = await readSession();
  if (!auth) throw new ApiError(401, "Please sign in.");
  const input = await body(req, z.object({ name: z.string().trim().min(2).max(80).optional(), mfaEnabled: z.boolean().optional() }));
  Object.assign(auth.user, input);
  persist();
  return publicUser(auth.user);
});
