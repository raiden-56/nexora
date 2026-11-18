import { redirect } from "next/navigation";
import { DemoHome } from "@/demo/DemoGate";
import { sessionInfo } from "@/server/auth";

export default async function Home() {
  if (process.env.NEXT_PUBLIC_NEXORA_STATIC === "1") return <DemoHome />;
  const s = await sessionInfo();
  redirect(!s ? "/login" : s.activeOrgId ? "/overview" : "/onboarding");
}
