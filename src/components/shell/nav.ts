import {
  Activity,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  ConciergeBell,
  Cpu,
  Layers,
  LayoutDashboard,
  Puzzle,
  Settings,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { OrgType, Permission } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  orgTypes?: OrgType[];
}

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Control",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/devices", label: "Devices", icon: Cpu },
      { href: "/rooms", label: "Rooms & Floors", icon: Layers },
    ],
  },
  {
    section: "Automate",
    items: [
      { href: "/automations", label: "Automations", icon: Workflow },
      { href: "/scenes", label: "Scenes", icon: Sparkles },
      { href: "/schedules", label: "Schedules", icon: CalendarClock },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/hotel", label: "Hotel Operations", icon: ConciergeBell, orgTypes: ["hospitality"] },
      { href: "/office", label: "Office Operations", icon: Briefcase, orgTypes: ["commercial"] },
      { href: "/energy", label: "Energy Analytics", icon: BarChart3, permission: "analytics.view" },
      { href: "/activity", label: "Activity Logs", icon: Activity },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/users", label: "Users & Permissions", icon: Users },
      { href: "/integrations", label: "Integrations", icon: Puzzle },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const MOBILE_TABS = ["/overview", "/devices", "/scenes", "/automations"];

export function visibleNav(orgType: OrgType, can: (p: Permission) => boolean) {
  return NAV.map((s) => ({ ...s, items: s.items.filter((i) => (!i.orgTypes || i.orgTypes.includes(orgType)) && (!i.permission || can(i.permission))) })).filter((s) => s.items.length);
}

export const ALL_ITEMS = NAV.flatMap((s) => s.items);
