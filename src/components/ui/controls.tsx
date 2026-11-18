"use client";
import { motion } from "framer-motion";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "@/lib/format";

export function Switch({ checked, onChange, disabled, label, size = "md" }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; size?: "sm" | "md" }) {
  const w = size === "sm" ? "w-9 h-5" : "w-12 h-7";
  const k = size === "sm" ? "size-4" : "size-[22px]";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cx(
        "focus-ring relative inline-flex shrink-0 items-center rounded-full p-[3px] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        w,
        checked ? "bg-mint" : "bg-surface-3",
        checked ? "justify-end" : "justify-start",
      )}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 38 }} className={cx("rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.35)]", k)} />
    </button>
  );
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
  disabled,
  label,
  fill,
  track,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  disabled?: boolean;
  label: string;
  fill?: string;
  track?: string;
  className?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={label}
      className={cx("nx-range", className)}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      style={{ ["--pct" as string]: `${pct}%`, ...(fill ? { ["--track-fill" as string]: fill } : {}), ...(track ? { ["--track-bg" as string]: track } : {}) }}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

const fieldBase =
  "focus-ring w-full rounded-xl border border-line bg-surface-2 px-3.5 text-sm text-text placeholder:text-faint transition hover:border-line-strong focus:border-[var(--mint)] disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(fieldBase, "h-11", className)} {...rest} />;
});

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, "min-h-20 py-2.5", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cx(fieldBase, "h-11 appearance-none pr-9", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
    </div>
  );
}

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-text-2">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-xs text-err">{error}</p> : hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, size = "md", className, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md"; className?: string; label?: string }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cx("inline-flex rounded-xl border border-line bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(o.value);
            }}
            className={cx("focus-ring relative flex-1 rounded-lg font-medium whitespace-nowrap transition-colors", size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]", active ? "text-text" : "text-muted hover:text-text")}
          >
            {active && <motion.span layoutId={`seg-${id}`} transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-lg bg-surface-3 shadow-sm" />}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cx("focus-ring inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition", checked ? "border-mint bg-mint text-mint-ink" : "border-line-strong bg-surface-2 hover:border-muted", className)}
    >
      {checked && <Check className="size-3.5" strokeWidth={3} />}
    </button>
  );
}

export function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const L = ["S", "M", "T", "W", "T", "F", "S"];
  const full = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {L.map((l, i) => {
        const on = value.includes(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={on}
            aria-label={full[i]}
            onClick={() => onChange(on ? value.filter((d) => d !== i) : [...value, i].sort())}
            className={cx("focus-ring size-9 rounded-full text-[13px] font-semibold transition", on ? "bg-mint text-mint-ink" : "bg-surface-3 text-muted hover:text-text")}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
