"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { BookOpen, Check, Clapperboard, ConciergeBell, Leaf, Loader2, Moon, Plane, Presentation, Sparkles, Sunrise, Users, Utensils, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import type { Execution, Scene } from "@/lib/types";
import { BOOT_KEY } from "@/hooks/useNexora";
import { useToast } from "../ui/feedback";

export const SCENE_ICONS: Record<string, LucideIcon> = {
  sunrise: Sunrise,
  moon: Moon,
  clapperboard: Clapperboard,
  "book-open": BookOpen,
  plane: Plane,
  utensils: Utensils,
  "concierge-bell": ConciergeBell,
  leaf: Leaf,
  presentation: Presentation,
  users: Users,
  sparkles: Sparkles,
};

export function useActivateScene() {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  return async (scene: Scene) => {
    try {
      const exec = await api<Execution>(`/api/scenes/${scene.id}/activate`, { method: "POST" });
      const failed = exec.steps.filter((s) => s.status === "failed");
      if (exec.status === "success") toast({ tone: "success", title: `${scene.name} activated`, body: `${exec.steps.length} actions confirmed by devices.` });
      else toast({ tone: exec.status === "failed" ? "error" : "warning", title: `${scene.name} ${exec.status === "failed" ? "failed" : "partly applied"}`, body: failed.map((f) => `${f.label.split(" → ")[0]}: ${f.detail}`).join(" · ") });
      void mutate(BOOT_KEY);
      void mutate("/api/scenes");
      return exec;
    } catch (e) {
      toast({ tone: "error", title: `Couldn't run ${scene.name}`, body: (e as Error).message });
      return null;
    }
  };
}

/** One-tap scene activation with visible progress and confirmation. */
export function SceneTile({ scene, disabled, compact }: { scene: Scene; disabled?: boolean; compact?: boolean }) {
  const activate = useActivateScene();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const Icon = SCENE_ICONS[scene.icon] ?? Sparkles;
  const run = async () => {
    if (state === "running") return;
    setState("running");
    const r = await activate(scene);
    setState(r && r.status !== "failed" ? "done" : "idle");
    if (r) setTimeout(() => setState("idle"), 1800);
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      disabled={disabled}
      onClick={run}
      className={cx("focus-ring group relative flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-line bg-surface text-left transition hover:border-line-strong disabled:opacity-50", compact ? "w-[200px] p-3" : "w-full p-4")}
    >
      <AnimatePresence>
        {state !== "idle" && (
          <motion.span initial={{ scale: 0, opacity: 0.6 }} animate={{ scale: 4, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut" }} className="absolute left-6 top-1/2 size-16 -translate-y-1/2 rounded-full" style={{ background: scene.accent }} />
        )}
      </AnimatePresence>
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ color: scene.accent, background: `color-mix(in srgb, ${scene.accent} 15%, transparent)` }}>
        {state === "running" ? <Loader2 className="size-5 animate-spin" /> : state === "done" ? <Check className="size-5" /> : <Icon className="size-5" />}
      </span>
      <span className="relative min-w-0">
        <span className="block truncate text-[13.5px] font-semibold">{scene.name}</span>
        <span className="block truncate text-[11.5px] text-faint">{state === "running" ? "Applying…" : state === "done" ? "Applied" : `${scene.actions.length} actions`}</span>
      </span>
    </motion.button>
  );
}
