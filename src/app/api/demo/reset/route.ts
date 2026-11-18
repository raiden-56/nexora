import { ApiError, readSession } from "@/server/auth";
import { resetDatabase } from "@/server/db";
import { route } from "@/server/http";

/** Restore the seeded demonstration dataset. Platform super-admins only. */
export const POST = route(async () => {
  const auth = await readSession();
  if (!auth?.user.isSuperAdmin) throw new ApiError(403, "Only platform administrators can reset demo data.");
  resetDatabase();
  return { ok: true };
});
