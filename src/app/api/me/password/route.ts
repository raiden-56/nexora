import { z } from "zod";
import { ApiError, rateLimit, readSession } from "@/server/auth";
import { db, persist } from "@/server/db";
import { body, route } from "@/server/http";
import { hashPassword, verifyPassword } from "@/server/util";

const schema = z.object({
  current: z.string(),
  next: z.string().min(10, "use at least 10 characters").max(200).regex(/[A-Za-z]/, "include a letter").regex(/\d/, "include a number"),
});

export const POST = route(async (req) => {
  const auth = await readSession();
  if (!auth) throw new ApiError(401, "Please sign in.");
  rateLimit(`pwd:${auth.user.id}`, 5);
  const input = await body(req, schema);
  if (!verifyPassword(input.current, auth.user.salt, auth.user.passwordHash)) throw new ApiError(400, "Current password is incorrect.");
  const { hash, salt } = hashPassword(input.next);
  auth.user.passwordHash = hash;
  auth.user.salt = salt;
  // Sign out every other session of this user
  const d = db();
  d.sessions = d.sessions.filter((s) => s.userId !== auth.user.id || s.id === auth.session.id);
  persist();
  return { ok: true };
});
