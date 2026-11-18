import { redirect } from "next/navigation";
import { sessionInfo } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await sessionInfo();
  redirect(!s ? "/login" : s.activeOrgId ? "/overview" : "/onboarding");
}
