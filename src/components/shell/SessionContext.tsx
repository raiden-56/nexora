"use client";
import { createContext, useContext } from "react";
import type { SessionInfo } from "@/lib/types";

export const SessionCtx = createContext<SessionInfo | null>(null);

export function useSession(): SessionInfo {
  const s = useContext(SessionCtx);
  if (!s) throw new Error("useSession outside AppShell");
  return s;
}
