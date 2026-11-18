import { z } from "zod";
import { ApiError, clientIp, createSession, publicUser, rateLimit } from "@/server/auth";
import { db } from "@/server/db";
import { body, route } from "@/server/http";
import { verifyPassword } from "@/server/util";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

export const POST = route(async (req) => {
  const input = await body(req, schema);
  rateLimit(`login:${await clientIp()}:${input.email}`, 8);
  const user = db().users.find((u) => u.email.toLowerCase() === input.email);
  // Same error for unknown email and wrong password — no account enumeration.
  if (!user || !verifyPassword(input.password, user.salt, user.passwordHash)) throw new ApiError(401, "Email or password is incorrect.");
  await createSession(user);
  return { user: publicUser(user), hasOrg: db().memberships.some((m) => m.userId === user.id) };
});
