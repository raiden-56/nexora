"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { AlertTriangle, Bell, Building2, Check, ChevronDown, CircleCheck, Info, Moon, Search, Sun, XCircle } from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { cx, greeting, relTime } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { LogoMark } from "../brand";
import { useTheme } from "../providers";
import { IconButton } from "../ui/button";
import { useToast } from "../ui/feedback";
import { Popover } from "../ui/overlay";
import { useSession } from "./SessionContext";

export function PropertySelector({ compact }: { compact?: boolean }) {
  const { data, property } = useBootstrap();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const router = useRouter();
  if (!data) return <div className="h-10 w-40 animate-pulse rounded-xl bg-surface-2" />;
  const select = async (id: string) => {
    try {
      await api("/api/properties/select", { body: { propertyId: id } });
      await mutate(() => true, undefined, { revalidate: true });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't switch property", body: (e as Error).message });
    }
  };
  return (
    <Popover
      align="start"
      className="w-[min(320px,calc(100vw-2rem))]"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} aria-label="Select property" className={cx("focus-ring flex h-10 min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-left transition hover:border-line-strong", compact ? "max-w-[46vw]" : "max-w-xs")}>
          <Building2 className="size-4 shrink-0 text-mint" />
          <span className="min-w-0 truncate text-[13px] font-semibold">{property?.name ?? "No property"}</span>
          <ChevronDown className="size-3.5 shrink-0 text-faint" />
        </button>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="text-eyebrow px-2.5 pb-1.5 pt-2">Properties · {data.org.name}</div>
          {data.properties.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                close();
                if (p.id !== data.propertyId) void select(p.id);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{p.name}</span>
                <span className="block truncate text-[11px] text-faint">
                  {p.onlineCount}/{p.deviceCount} devices online
                </span>
              </span>
              {p.id === data.propertyId && <Check className="size-4 text-mint" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <Link href="/properties/new" onClick={close} className="block rounded-xl px-2.5 py-2 text-[13px] text-mint transition hover:bg-surface-2">
            + Add property
          </Link>
        </div>
      )}
    </Popover>
  );
}

const sevIcon = { info: Info, success: CircleCheck, warning: AlertTriangle, error: XCircle };
const sevColor = { info: "var(--cyan)", success: "var(--ok)", warning: "var(--warn)", error: "var(--err)" };

export function NotificationBell() {
  const { data: boot } = useBootstrap();
  const { data, mutate } = useSWR<{ notifications: Notification[] }>("/api/notifications", fetcher, { refreshInterval: 15000 });
  const { mutate: g } = useSWRConfig();
  const unread = boot?.unread ?? 0;
  const markAll = async () => {
    await api("/api/notifications", { method: "PATCH" });
    await Promise.all([mutate(), g(BOOT_KEY)]);
  };
  const markOne = async (n: Notification) => {
    if (n.read) return;
    await api(`/api/notifications/${n.id}`, { method: "PATCH", body: { read: true } });
    await Promise.all([mutate(), g(BOOT_KEY)]);
  };
  return (
    <Popover
      className="w-[min(380px,calc(100vw-1.5rem))]"
      trigger={({ toggle }) => (
        <IconButton label={`Notifications${unread ? ` (${unread} unread)` : ""}`} onClick={toggle} className="relative border border-line bg-surface">
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="num absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-mint px-1 text-[10px] font-bold text-mint-ink">{unread > 9 ? "9+" : unread}</span>}
        </IconButton>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-semibold">Notifications</span>
            <button onClick={markAll} className="text-[12px] font-medium text-mint hover:underline">
              Mark all read
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!data && <div className="p-6 text-center text-[13px] text-muted">Loading…</div>}
            {data?.notifications.length === 0 && <div className="p-8 text-center text-[13px] text-muted">You&apos;re all caught up.</div>}
            {data?.notifications.slice(0, 8).map((n) => {
              const Icon = sevIcon[n.severity];
              return (
                <Link key={n.id} href={n.link ?? "/notifications"} onClick={() => (void markOne(n), close())} className={cx("flex gap-3 border-b border-line px-4 py-3 transition last:border-0 hover:bg-surface-2", !n.read && "bg-[color-mix(in_srgb,var(--mint)_4%,transparent)]")}>
                  <Icon className="mt-0.5 size-4 shrink-0" style={{ color: sevColor[n.severity] }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={cx("text-[13px] leading-snug", n.read ? "text-text-2" : "font-semibold text-text")}>{n.title}</span>
                      {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-mint" />}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{n.body}</p>
                    <div className="mt-1 text-[11px] text-faint">{relTime(n.createdAt)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
          <Link href="/notifications" onClick={close} className="block border-t border-line px-4 py-3 text-center text-[13px] font-medium text-mint hover:bg-surface-2">
            View all notifications
          </Link>
        </div>
      )}
    </Popover>
  );
}

function Clock({ tz }: { tz: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="opacity-0">—</span>;
  return (
    <span className="num">
      {now.toLocaleDateString("en-IN", { timeZone: tz, weekday: "long", day: "numeric", month: "long" })} · {now.toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" })}
    </span>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <IconButton label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="border border-line bg-surface">
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </IconButton>
  );
}

export function Topbar({ onSearch }: { onSearch: () => void }) {
  const session = useSession();
  const { property, data } = useBootstrap();
  const tz = property?.timezone ?? "Asia/Kolkata";
  const [greet, setGreet] = useState("Welcome");
  useEffect(() => setGreet(greeting(tz)), [tz]);
  const allSim = data ? data.devices.length > 0 && data.devices.every((d) => d.provider === "simulated") : false;

  return (
    <header className="glass sticky top-0 z-30 border-b border-line pt-[env(safe-area-inset-top)]">
      {/* Desktop / tablet */}
      <div className="hidden h-16 items-center gap-3 px-6 md:flex xl:px-8">
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[15px] font-bold">
            {greet}, {session.user.name.split(" ")[0]}
          </div>
          <div className="truncate text-[12px] text-faint">
            <Clock tz={tz} />
          </div>
        </div>
        {allSim && (
          <span className="hidden items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-semibold xl:inline-flex" style={{ color: "var(--violet)", borderColor: "color-mix(in srgb,var(--violet) 45%,transparent)" }} title="All devices in this property are simulated">
            Demo mode · simulated hardware
          </span>
        )}
        <PropertySelector />
        <button onClick={onSearch} className="focus-ring flex h-10 w-56 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] text-faint transition hover:border-line-strong xl:w-72">
          <Search className="size-4" />
          <span className="flex-1 text-left">Search devices, rooms…</span>
          <kbd className="rounded-md border border-line px-1.5 text-[10.5px]">Ctrl K</kbd>
        </button>
        <ThemeToggle />
        <NotificationBell />
        <Link href="/settings" aria-label="Profile and settings" className="focus-ring flex size-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--surface-3),var(--surface-2))] font-display text-[13px] font-bold text-text ring-1 ring-line">
          {session.user.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </Link>
      </div>
      {/* Phone */}
      <div className="flex h-14 items-center gap-2 px-4 md:hidden">
        <Link href="/overview" aria-label="Nexora home">
          <LogoMark className="size-8" />
        </Link>
        <div className="min-w-0 flex-1">
          <PropertySelector compact />
        </div>
        <IconButton label="Search" onClick={onSearch} className="border border-line bg-surface">
          <Search className="size-[18px]" />
        </IconButton>
        <NotificationBell />
      </div>
    </header>
  );
}
