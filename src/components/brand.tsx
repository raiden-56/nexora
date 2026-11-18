import { cx } from "@/lib/format";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cx("size-8", className)} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="var(--surface-2)" stroke="var(--line-strong)" />
      <path d="M12 28V12l16 16V12" fill="none" stroke="var(--mint)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="12" r="2.4" fill="var(--cyan)" />
    </svg>
  );
}

export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!collapsed && <span className="font-display text-[17px] font-extrabold tracking-[0.16em]">NEXORA</span>}
    </div>
  );
}
