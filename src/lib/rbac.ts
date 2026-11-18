import type { Permission, RoleKey } from "./types";

export const ALL_PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "devices.view", label: "View devices", description: "See devices, rooms and live status" },
  { key: "devices.control", label: "Control devices", description: "Switch, dim and adjust devices" },
  { key: "automations.manage", label: "Manage routines", description: "Create, edit and pause automations" },
  { key: "scenes.manage", label: "Create scenes", description: "Build and edit scenes" },
  { key: "properties.manage", label: "Manage properties", description: "Edit properties, floors and rooms" },
  { key: "users.invite", label: "Invite users", description: "Invite members and change roles" },
  { key: "analytics.view", label: "View analytics", description: "Energy reports and exports" },
  { key: "integrations.manage", label: "Manage integrations", description: "Connect hubs, clouds and pair devices" },
  { key: "billing.manage", label: "Manage billing", description: "Plans, invoices and payment" },
  { key: "hotel.operate", label: "Hotel operations", description: "Check guests in/out, housekeeping" },
];

export const ROLES: Record<RoleKey, { label: string; description: string; permissions: Permission[] }> = {
  owner: {
    label: "Organization Owner",
    description: "Full control of the organization, billing and members",
    permissions: ALL_PERMISSIONS.map((p) => p.key),
  },
  property_manager: {
    label: "Property Manager",
    description: "Runs assigned properties end to end",
    permissions: [
      "devices.view",
      "devices.control",
      "automations.manage",
      "scenes.manage",
      "properties.manage",
      "users.invite",
      "analytics.view",
      "integrations.manage",
      "hotel.operate",
    ],
  },
  facility_manager: {
    label: "Facility Manager",
    description: "Operates building systems and schedules",
    permissions: ["devices.view", "devices.control", "automations.manage", "scenes.manage", "analytics.view", "integrations.manage"],
  },
  hotel_manager: {
    label: "Hotel Manager",
    description: "Front-desk, housekeeping and guest-room automation",
    permissions: ["devices.view", "devices.control", "automations.manage", "scenes.manage", "analytics.view", "hotel.operate", "users.invite"],
  },
  staff: {
    label: "Staff",
    description: "Day-to-day device control in assigned areas",
    permissions: ["devices.view", "devices.control", "hotel.operate"],
  },
  resident: {
    label: "Resident",
    description: "Controls their home, scenes and routines",
    permissions: ["devices.view", "devices.control", "automations.manage", "scenes.manage", "analytics.view"],
  },
  guest: {
    label: "Guest",
    description: "View and control devices only",
    permissions: ["devices.view", "devices.control"],
  },
};

export function permissionsFor(role: RoleKey): Permission[] {
  return ROLES[role]?.permissions ?? [];
}

export function can(role: RoleKey | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return permissionsFor(role).includes(permission);
}

/** Roles a member with `actor` role may assign. Nobody but an owner can mint owners. */
export function assignableRoles(actor: RoleKey): RoleKey[] {
  if (actor === "owner") return Object.keys(ROLES) as RoleKey[];
  if (!can(actor, "users.invite")) return [];
  return (Object.keys(ROLES) as RoleKey[]).filter((r) => r !== "owner" && r !== "property_manager");
}

export function hasPropertyAccess(propertyIds: string[] | null, propertyId: string): boolean {
  return propertyIds === null || propertyIds.includes(propertyId);
}
