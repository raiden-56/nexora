"use client";
import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CircleCheck, Info, X, XCircle } from "lucide-react";
import { Button } from "./button";
import { Modal } from "./overlay";

type ToastTone = "success" | "error" | "info" | "warning";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

const ToastCtx = createContext<{ toast: (t: Omit<ToastItem, "id">) => void } | null>(null);
const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

const icons = { success: CircleCheck, error: XCircle, info: Info, warning: AlertTriangle };
const colors = { success: "var(--ok)", error: "var(--err)", info: "var(--cyan)", warning: "var(--warn)" };

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++seq.current;
    setToasts((x) => [...x.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((i) => i.id !== id)), t.tone === "error" ? 6500 : 3800);
  }, []);

  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <ToastCtx.Provider value={{ toast }}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <Modal
          open={!!confirmState}
          onClose={() => close(false)}
          title={confirmState?.title ?? ""}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button data-autofocus variant={confirmState?.danger ? "danger" : "primary"} onClick={() => close(true)}>
                {confirmState?.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <div className="text-[14px] text-text-2">{confirmState?.body}</div>
        </Modal>
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6">
          <AnimatePresence initial={false}>
            {toasts.map((t) => {
              const Icon = icons[t.tone];
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                  className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line-strong p-3.5 shadow-2xl"
                >
                  <Icon className="mt-0.5 size-[18px] shrink-0" style={{ color: colors[t.tone] }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{t.title}</div>
                    {t.body && <div className="mt-0.5 text-[12.5px] text-muted">{t.body}</div>}
                  </div>
                  <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))} className="text-faint hover:text-text">
                    <X className="size-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside FeedbackProvider");
  return c.toast;
}

export function useConfirm() {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error("useConfirm outside FeedbackProvider");
  return c;
}
