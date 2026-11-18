import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { listMembers } from "@/server/services/members";

export const GET = route(async () => listMembers(await requireCtx("devices.view")));
