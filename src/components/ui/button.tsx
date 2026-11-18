"use client";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cx } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-mint text-mint-ink hover:brightness-110 active:brightness-95 shadow-[0_8px_24px_-10px_var(--mint)]",
  secondary: "bg-surface-3 text-text hover:bg-[color-mix(in_srgb,var(--surface-3)_80%,var(--text)_8%)]",
  outline: "border border-line-strong text-text hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
  danger: "bg-[color-mix(in_srgb,var(--err)_16%,transparent)] text-err hover:bg-[color-mix(in_srgb,var(--err)_24%,transparent)]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "focus-ring inline-flex shrink-0 select-none items-center justify-center font-medium whitespace-nowrap transition-[background,filter,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx("focus-ring inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
