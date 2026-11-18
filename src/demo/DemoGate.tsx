"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { api } from "@/lib/api";
import type { SessionInfo } from "@/lib/types";

/**
 * Static (GitHub Pages) build only: does on the client what src/app/(app)/layout.tsx does on the
 * server — load the session from the in-browser backend and redirect to sign-in or onboarding.
 */
export function DemoGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ session: SessionInfo | null }>("/api/auth/session")
        .then((r) => alive && setSession(r.session))
        .catch(() => alive && setSession(null));
    void load();
    window.addEventListener("nexora:session", load);
    return () => {
      alive = false;
      window.removeEventListener("nexora:session", load);
    };
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/login");
    else if (session && !session.activeOrgId) router.replace("/onboarding");
  }, [session, router]);

  if (!session || !session.activeOrgId) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-line border-t-mint" aria-label="Loading" />
      </div>
    );
  }
  return <AppShell session={session}>{children}</AppShell>;
}

/** Root page of the static build: send visitors to the right place. */
export function DemoHome() {
  const router = useRouter();
  useEffect(() => {
    api<{ session: SessionInfo | null }>("/api/auth/session")
      .then((r) => router.replace(!r.session ? "/login" : r.session.activeOrgId ? "/overview" : "/onboarding"))
      .catch(() => router.replace("/login"));
  }, [router]);
  return null;
}
