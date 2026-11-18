"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cx, relTime } from "@/lib/format";
import type { Execution } from "@/lib/types";
import { Badge } from "../ui/surface";

const tone = { success: "ok", partial: "warn", failed: "err", skipped: "idle" } as const;
const src = { scheduler: "Scheduler", event: "Device event", user: "Manual run", gateway: "Local gateway" };

export function ExecutionList({ executions, empty = "No executions yet." }: { executions: Execution[]; empty?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!executions.length) return <p className="p-5 text-center text-[13px] text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-[var(--line)]">
      {executions.map((e) => {
        const isOpen = open === e.id;
        return (
          <li key={e.id}>
            <button onClick={() => setOpen(isOpen ? null : e.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">
                  {e.name}
                  {e.phase === "end" && <span className="text-faint"> · end of schedule</span>}
                </div>
                <div className="text-[12px] text-faint">
                  {src[e.source]} · {relTime(e.startedAt)} · {new Date(e.startedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <Badge tone={tone[e.status]}>{e.status}</Badge>
              <ChevronDown className={cx("size-4 shrink-0 text-faint transition", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <ol className="space-y-1.5 px-5 pb-4">
                {e.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]">
                    <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", s.status === "success" ? "bg-ok" : s.status === "failed" ? "bg-err" : "bg-idle")} />
                    <div className="min-w-0">
                      <div className="text-text-2">{s.label}</div>
                      {(s.detail || (s.attempts ?? 0) > 1) && (
                        <div className={cx("text-[11.5px]", s.status === "failed" ? "text-err" : "text-faint")}>
                          {s.detail}
                          {(s.attempts ?? 0) > 1 ? ` · ${s.attempts} attempts` : ""}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ul>
  );
}
