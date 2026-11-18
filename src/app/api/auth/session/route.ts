import { sessionInfo } from "@/server/auth";
import { route } from "@/server/http";

export const GET = route(async () => ({ session: await sessionInfo() }));
