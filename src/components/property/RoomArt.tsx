import { Armchair, Bath, Bed, BookOpen, Briefcase, ConciergeBell, CookingPot, DoorOpen, Server, Sofa, TreePalm, Users, Utensils, Wrench, type LucideIcon } from "lucide-react";
import type { RoomKind } from "@/lib/types";
import { cx } from "@/lib/format";

const ART: Record<RoomKind, { icon: LucideIcon; hue: string }> = {
  living: { icon: Sofa, hue: "var(--mint)" },
  kitchen: { icon: CookingPot, hue: "#F2B66D" },
  dining: { icon: Utensils, hue: "#F2B66D" },
  bedroom: { icon: Bed, hue: "var(--violet)" },
  bathroom: { icon: Bath, hue: "var(--cyan)" },
  study: { icon: BookOpen, hue: "var(--cyan)" },
  balcony: { icon: TreePalm, hue: "var(--ok)" },
  office: { icon: Briefcase, hue: "var(--cyan)" },
  meeting: { icon: Users, hue: "var(--violet)" },
  lobby: { icon: ConciergeBell, hue: "#F2B66D" },
  guest_room: { icon: Bed, hue: "var(--mint)" },
  corridor: { icon: DoorOpen, hue: "var(--blue)" },
  utility: { icon: Wrench, hue: "var(--blue)" },
  server: { icon: Server, hue: "var(--err)" },
};

/** Abstract architectural tile used as the room "image". */
export function RoomArt({ kind, lit, className }: { kind: RoomKind; lit?: boolean; className?: string }) {
  const a = ART[kind] ?? { icon: Armchair, hue: "var(--mint)" };
  const Icon = a.icon;
  return (
    <div className={cx("relative overflow-hidden", className)} style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${a.hue} ${lit ? 22 : 10}%, var(--surface-2)), var(--surface-2) 70%)` }}>
      <svg className="absolute inset-0 size-full opacity-60" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden>
        <path d="M0 70 L60 40 L140 40 L200 70" fill="none" stroke="var(--line-strong)" />
        <path d="M60 40 L60 100 M140 40 L140 100" stroke="var(--line)" />
        <rect x="80" y="52" width="40" height="22" rx="3" fill="none" stroke="var(--line-strong)" />
      </svg>
      {lit && <span className="absolute -right-6 -top-6 size-24 rounded-full blur-2xl" style={{ background: `color-mix(in srgb, ${a.hue} 30%, transparent)` }} />}
      <span className="absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-xl bg-surface/80 backdrop-blur" style={{ color: a.hue }}>
        <Icon className="size-[18px]" />
      </span>
    </div>
  );
}
