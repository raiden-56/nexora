import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { DemoGate } from "@/demo/DemoGate";
import { sessionInfo } from "@/server/auth";
import { ensureScheduler } from "@/server/automation/scheduler";

// Reading the session cookie makes this layout dynamic on the server build.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Static GitHub Pages build: there is no server, so the session is checked in the browser.
  if (process.env.NEXT_PUBLIC_NEXORA_STATIC === "1") return <DemoGate>{children}</DemoGate>;
  ensureScheduler();
  const session = await sessionInfo();
  if (!session) redirect("/login");
  if (!session.activeOrgId) redirect("/onboarding");
  return <AppShell session={session}>{children}</AppShell>;
}
