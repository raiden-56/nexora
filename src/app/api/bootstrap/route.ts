import { requireCtx } from "@/server/auth";
import { route } from "@/server/http";
import { bootstrap } from "@/server/services/org";

export const GET = route(async () => bootstrap(await requireCtx("devices.view")));
