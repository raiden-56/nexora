"use client";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/format";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-text">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

type Tone = "mint" | "cyan" | "ok" | "warn" | "err" | "idle" | "violet" | "neutral";
const toneVar: Record<Tone, string> = { mint: "var(--mint)", cyan: "var(--cyan)", ok: "var(--ok)", warn: "var(--warn)", err: "var(--err)", idle: "var(--idle)", violet: "var(--violet)", neutral: "var(--muted)" };

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  const c = toneVar[tone];
  return (
    <span
      className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium whitespace-nowrap", className)}
      style={{ color: c, background: `color-mix(in srgb, ${c} 13%, transparent)` }}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: c }} />}
      {children}
    </span>
  );
}

export function StatusDot({ tone, pulse, className }: { tone: Tone; pulse?: boolean; className?: string }) {
  const c = toneVar[tone];
  return (
    <span className={cx("relative inline-flex size-2", className)}>
      {pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: c }} />}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: c }} />
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-surface-3/70", className)} />;
}

export function EmptyState({ icon, title, body, action, className }: { icon: ReactNode; title: string; body: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center rounded-[18px] border border-dashed border-line-strong px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface-2 text-mint">{icon}</div>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="text-eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-display text-[26px] sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Animated number — springs to new values, instant when the user prefers reduced motion. */
export function Counter({ value, decimals = 0, className, suffix }: { value: number; decimals?: number; className?: string; suffix?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => v.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + (suffix ?? ""));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [value, reduce, mv]);
  return <motion.span className={cx("num", className)}>{text}</motion.span>;
}

export function Stat({ label, value, icon, tone = "mint", foot, decimals, suffix }: { label: string; value: number; icon: ReactNode; tone?: Tone; foot?: ReactNode; decimals?: number; suffix?: string }) {
  const c = toneVar[tone];
  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-xl" style={{ color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` }}>
          {icon}
        </span>
      </div>
      <div className="mt-3 font-display text-[26px] font-bold leading-none tracking-tight sm:text-[28px]">
        <Counter value={value} decimals={decimals} suffix={suffix} />
      </div>
      {foot && <div className="mt-2 text-xs text-faint">{foot}</div>}
    </Card>
  );
}

export function DemoBadge({ className, label = "Simulated" }: { className?: string; label?: string }) {
  return (
    <span className={cx("inline-flex h-5 items-center gap-1 rounded-md border border-dashed px-1.5 text-[10.5px] font-semibold tracking-wide uppercase", className)} style={{ color: "var(--violet)", borderColor: "color-mix(in srgb, var(--violet) 45%, transparent)" }}>
      {label}
    </span>
  );
}
