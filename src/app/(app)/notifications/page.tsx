"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AlertTriangle, Bell, CheckCheck, CircleCheck, Info, Trash2, X, XCircle } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { useToast } from "@/components/ui/feedback";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import { cx, relTime } from "@/lib/format";
import type { Notification } from "@/lib/types";

const icon = { info: Info, success: CircleCheck, warning: AlertTriangle, error: XCircle };
const color = { info: "var(--cyan)", success: "var(--ok)", warning: "var(--warn)", error: "var(--err)" };

export default function NotificationsPage() {
  const { data, mutate } = useSWR<{ notifications: Notification[] }>("/api/notifications", fetcher, { refreshInterval: 10000 });
  const { mutate: g } = useSWRConfig();
  const [filter, setFilter] = useState<"all" | "unread" | "alerts">("all");
  const toast = useToast();
  if (!data) return <Skeleton className="h-96" />;
  const list = data.notifications.filter((n) => (filter === "unread" ? !n.read : filter === "alerts" ? n.severity === "error" || n.severity === "warning" : true));
  const refresh = () => Promise.all([mutate(), g(BOOT_KEY)]);

  const setRead = async (n: Notification, read: boolean) => {
    await mutate({ notifications: data.notifications.map((x) => (x.id === n.id ? { ...x, read } : x)) }, { revalidate: false });
    await api(`/api/notifications/${n.id}`, { method: "PATCH", body: { read } });
    void refresh();
  };
  const dismiss = async (n: Notification) => {
    await mutate({ notifications: data.notifications.filter((x) => x.id !== n.id) }, { revalidate: false });
    await api(`/api/notifications/${n.id}`, { method: "DELETE" });
    void refresh();
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Offline devices, automation results, energy anomalies and integration health. Push and email delivery plug into the same events."
        actions={
          <>
            <Button variant="outline" icon={<CheckCheck className="size-4" />} onClick={async () => (await api("/api/notifications", { method: "PATCH" }), await refresh(), toast({ tone: "success", title: "All marked as read" }))}>
              Mark all read
            </Button>
            <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={async () => (await api("/api/notifications", { method: "DELETE" }), await refresh(), toast({ tone: "success", title: "Read notifications cleared" }))}>
              Clear read
            </Button>
          </>
        }
      />
      <Segmented label="Filter" className="mb-5" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread ${data.notifications.filter((n) => !n.read).length}` }, { value: "alerts", label: "Alerts" }]} />
      {list.length === 0 ? (
        <EmptyState icon={<Bell className="size-5" />} title="Nothing here" body={filter === "unread" ? "You're all caught up." : "Notifications will appear as devices and automations report in."} />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            <AnimatePresence initial={false}>
              {list.map((n) => {
                const Icon = icon[n.severity];
                return (
                  <motion.li key={n.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className={cx("flex gap-3 border-b border-line px-4 py-4 last:border-0 sm:px-5", !n.read && "bg-[color-mix(in_srgb,var(--mint)_4%,transparent)]")}>
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ color: color[n.severity], background: `color-mix(in srgb, ${color[n.severity]} 13%, transparent)` }}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className={cx("text-[14px]", n.read ? "text-text-2" : "font-semibold")}>{n.title}</span>
                        <span className="shrink-0 text-[11.5px] text-faint">{relTime(n.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
                        {n.link && <Link href={n.link} onClick={() => !n.read && setRead(n, true)} className="font-medium text-mint hover:underline">View</Link>}
                        <button onClick={() => setRead(n, !n.read)} className="text-muted hover:text-text">{n.read ? "Mark unread" : "Mark read"}</button>
                      </div>
                    </div>
                    <IconButton label="Dismiss" className="size-8 shrink-0" onClick={() => dismiss(n)}>
                      <X className="size-4" />
                    </IconButton>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </Card>
      )}
    </div>
  );
}
