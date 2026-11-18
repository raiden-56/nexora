import { z } from "zod";
import { ApiError, clientIp, createSession, publicUser, rateLimit } from "@/server/auth";
import { db, persist } from "@/server/db";
import { body, route } from "@/server/http";
import { acceptInvitationsFor } from "@/server/services/members";
import { hashPassword, id, nowIso } from "@/server/util";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "use at least 10 characters").max(200).regex(/[A-Za-z]/, "include a letter").regex(/\d/, "include a number"),
});

export const POST = route(async (req) => {
  rateLimit(`register:${await clientIp()}`, 10);
  const input = await body(req, schema);
  const d = db();
  if (d.users.some((u) => u.email.toLowerCase() === input.email)) throw new ApiError(409, "An account with this email already exists.");
  const { hash, salt } = hashPassword(input.password);
  const user = { id: id("usr_"), email: input.email, name: input.name, passwordHash: hash, salt, createdAt: nowIso(), mfaEnabled: false };
  d.users.push(user);
  acceptInvitationsFor(user.id, user.email);
  persist();
  await createSession(user);
  return { user: publicUser(user), hasOrg: d.memberships.some((m) => m.userId === user.id) };
});
