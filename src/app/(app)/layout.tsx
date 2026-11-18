import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { sessionInfo } from "@/server/auth";
import { ensureScheduler } from "@/server/automation/scheduler";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  ensureScheduler();
  const session = await sessionInfo();
  if (!session) redirect("/login");
  if (!session.activeOrgId) redirect("/onboarding");
  return <AppShell session={session}>{children}</AppShell>;
}
