import "server-only";
import { z } from "zod";
import { assignableRoles } from "@/lib/rbac";
import type { Invitation, RoleKey } from "@/lib/types";
import { ApiError, publicUser, type Ctx } from "../auth";
import { db, persist } from "../db";
import { id, nowIso, randomToken } from "../util";
import { logActivity } from "./log";

const roleEnum = z.enum(["owner", "property_manager", "facility_manager", "hotel_manager", "staff", "resident", "guest"]);

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: roleEnum,
  propertyIds: z.array(z.string()).nullable().default(null),
});

export function listMembers(ctx: Ctx) {
  const d = db();
  return {
    members: d.memberships
      .filter((m) => m.orgId === ctx.orgId)
      .map((m) => {
        const u = d.users.find((x) => x.id === m.userId);
        return { ...m, user: u ? publicUser(u) : null };
      }),
    invitations: d.invitations.filter((i) => i.orgId === ctx.orgId && i.status === "pending").map(({ token: _t, ...rest }) => rest),
  };
}

function assertAssignable(ctx: Ctx, role: RoleKey, propertyIds: string[] | null) {
  if (!ctx.can("users.invite")) throw new ApiError(403, "Your role can't manage members.");
  if (!assignableRoles(ctx.role).includes(role)) throw new ApiError(403, "You can't assign a role with more access than your own.");
  if (propertyIds) for (const p of propertyIds) ctx.assertProperty(p);
  // Property-scoped admins can only grant access to properties they hold.
  if (ctx.membership.propertyIds !== null && propertyIds === null) throw new ApiError(403, "You can only grant access to your own properties.");
}

export function invite(ctx: Ctx, input: z.infer<typeof inviteSchema>) {
  assertAssignable(ctx, input.role, input.propertyIds);
  const d = db();
  const existingUser = d.users.find((u) => u.email.toLowerCase() === input.email);
  if (existingUser && d.memberships.some((m) => m.orgId === ctx.orgId && m.userId === existingUser.id)) throw new ApiError(409, "That person is already a member.");
  if (d.invitations.some((i) => i.orgId === ctx.orgId && i.email === input.email && i.status === "pending")) throw new ApiError(409, "An invitation is already pending for that email.");
  const inv: Invitation = { id: id("inv_"), orgId: ctx.orgId, email: input.email, role: input.role, propertyIds: input.propertyIds, status: "pending", invitedBy: ctx.user.id, createdAt: nowIso(), token: randomToken(24) };
  d.invitations.push(inv);
  logActivity({ orgId: ctx.orgId, propertyId: null, userId: ctx.user.id, userName: ctx.user.name, deviceId: null, deviceName: null, action: `Invited ${input.email} as ${input.role}`, previous: null, next: null, source: "user", automationId: null });
  persist();
  // Email delivery is out of scope for the demo; the invite is accepted when that email registers.
  const { token: _t, ...safe } = inv;
  return safe;
}

export function revokeInvitation(ctx: Ctx, invitationId: string) {
  if (!ctx.can("users.invite")) throw new ApiError(403, "Your role can't manage members.");
  const inv = db().invitations.find((i) => i.id === invitationId && i.orgId === ctx.orgId);
  if (!inv) throw new ApiError(404, "Invitation not found.");
  inv.status = "revoked";
  persist();
}

export function updateMember(ctx: Ctx, membershipId: string, input: { role?: RoleKey; propertyIds?: string[] | null }) {
  const d = db();
  const m = d.memberships.find((x) => x.id === membershipId && x.orgId === ctx.orgId);
  if (!m) throw new ApiError(404, "Member not found.");
  if (m.userId === ctx.user.id) throw new ApiError(400, "You can't change your own role.");
  const role = input.role ? roleEnum.parse(input.role) : m.role;
  const propertyIds = input.propertyIds !== undefined ? input.propertyIds : m.propertyIds;
  assertAssignable(ctx, role, propertyIds);
  if (m.role === "owner" && ctx.role !== "owner") throw new ApiError(403, "Only an owner can change another owner.");
  if (m.role === "owner" && role !== "owner" && d.memberships.filter((x) => x.orgId === ctx.orgId && x.role === "owner").length <= 1) throw new ApiError(409, "An organization needs at least one owner.");
  m.role = role;
  m.propertyIds = propertyIds;
  persist();
  return m;
}

export function removeMember(ctx: Ctx, membershipId: string) {
  if (!ctx.can("users.invite")) throw new ApiError(403, "Your role can't manage members.");
  const d = db();
  const m = d.memberships.find((x) => x.id === membershipId && x.orgId === ctx.orgId);
  if (!m) throw new ApiError(404, "Member not found.");
  if (m.userId === ctx.user.id) throw new ApiError(400, "You can't remove yourself.");
  if (m.role === "owner" && ctx.role !== "owner") throw new ApiError(403, "Only an owner can remove an owner.");
  d.memberships = d.memberships.filter((x) => x.id !== m.id);
  d.sessions.filter((s) => s.userId === m.userId && s.activeOrgId === ctx.orgId).forEach((s) => (s.activeOrgId = null));
  persist();
}

/** Called after registration: accept any pending invitations for this email. */
export function acceptInvitationsFor(userId: string, email: string) {
  const d = db();
  for (const inv of d.invitations.filter((i) => i.email === email.toLowerCase() && i.status === "pending")) {
    inv.status = "accepted";
    d.memberships.push({ id: id("mem_"), orgId: inv.orgId, userId, role: inv.role, propertyIds: inv.propertyIds, createdAt: nowIso() });
  }
  persist();
}
