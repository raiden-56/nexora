// Response shapes inferred from server services (type-only imports, erased at build time).
import type { energyReport } from "@/server/services/energy";
import type { withNext } from "@/server/services/automations";
import type { listMembers } from "@/server/services/members";
import type { ActivityLog, Execution } from "./types";

export type EnergyReport = ReturnType<typeof energyReport>;
export type AutomationView = ReturnType<typeof withNext>;
export type MembersView = ReturnType<typeof listMembers>;
export type ActivityPage = { total: number; page: number; size: number; rows: ActivityLog[] };
export type ExecutionList = { executions: Execution[] };
