"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "@/lib/format";
import { IconButton } from "./button";

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

/**
 * Centered dialog on ≥sm screens, bottom sheet on phones — a real mobile layout,
 * not a shrunken desktop modal.
 */
export function Modal({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useLockScroll(open);
  useEscape(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button[data-autofocus]")?.focus(), 60);
  }, [open]);
  const w = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" }[size];
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/55 backdrop-blur-[3px]" onClick={onClose} />
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              className={cx("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-line-strong bg-surface shadow-2xl sm:rounded-[22px]", w)}
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-surface-3 sm:hidden" />
              <div className="flex items-start justify-between gap-4 px-5 pt-4 sm:px-6 sm:pt-6">
                <div>
                  <h2 className="text-[17px] font-semibold">{title}</h2>
                  {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
                </div>
                <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
                  <X className="size-4" />
                </IconButton>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
              {footer && <div className="flex flex-col-reverse gap-2 border-t border-line bg-bg-elev/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Side panel on desktop, full-screen panel on phones (device control panels). */
export function Sheet({ open, onClose, title, children, headerExtra }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; headerExtra?: ReactNode }) {
  useLockScroll(open);
  useEscape(open, onClose);
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[75]">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
            <motion.aside
              role="dialog"
              aria-modal="true"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40 }}
              className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line-strong bg-surface sm:max-w-[440px]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
                <div className="min-w-0 text-[16px] font-semibold">{title}</div>
                <div className="flex items-center gap-1">
                  {headerExtra}
                  <IconButton label="Close" onClick={onClose}>
                    <X className="size-4" />
                  </IconButton>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Lightweight popover menu anchored to its trigger. */
export function Popover({ trigger, children, align = "end", className }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: "start" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={cx("absolute top-[calc(100%+8px)] z-[70] origin-top overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-2xl", align === "end" ? "right-0" : "left-0", className)}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, active }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] transition hover:bg-surface-2", danger ? "text-err" : active ? "text-mint" : "text-text-2 hover:text-text")}
    >
      {icon && <span className="flex size-4 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}
