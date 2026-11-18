"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsLeft, ChevronsUpDown, LifeBuoy, LogOut, UserRound } from "lucide-react";
import { useSWRConfig } from "swr";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import type { OrgType } from "@/lib/types";
import { useBootstrap } from "@/hooks/useNexora";
import { Logo } from "../brand";
import { Popover } from "../ui/overlay";
import { useToast } from "../ui/feedback";
import { visibleNav } from "./nav";
import { useSession } from "./SessionContext";

const ORG_TYPE_LABEL: Record<OrgType, string> = { residential: "Residential", commercial: "Commercial", hospitality: "Hospitality" };

export function OrgSwitcher({ collapsed }: { collapsed?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const active = session.memberships.find((m) => m.orgId === session.activeOrgId);
  const switchTo = async (orgId: string) => {
    try {
      await api("/api/auth/switch-org", { body: { orgId } });
      await mutate(() => true, undefined, { revalidate: true });
      router.push("/overview");
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't switch organization", body: (e as Error).message });
    }
  };
  return (
    <Popover
      align="start"
      className="w-[272px]"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-expanded={open} aria-label="Switch organization" className={cx("focus-ring flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2 text-left transition hover:border-line-strong", collapsed ? "justify-center p-1.5" : "px-2.5 py-2")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--mint),var(--cyan))] font-display text-[13px] font-extrabold text-mint-ink">{active?.org.name.slice(0, 2).toUpperCase()}</span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{active?.org.name}</span>
                <span className="block truncate text-[11px] text-faint">{active ? ORG_TYPE_LABEL[active.org.type] : ""} · {active ? ROLES[active.role].label : ""}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-faint" />
            </>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="text-eyebrow px-2.5 pb-1.5 pt-2">Organizations</div>
          {session.memberships.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                close();
                if (m.orgId !== session.activeOrgId) void switchTo(m.orgId);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface-2"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-surface-3 text-[11px] font-bold">{m.org.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{m.org.name}</span>
                <span className="block text-[11px] text-faint">{ORG_TYPE_LABEL[m.org.type]}</span>
              </span>
              {m.orgId === session.activeOrgId && <Check className="size-4 text-mint" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <Link href="/onboarding?new=1" onClick={close} className="block rounded-xl px-2.5 py-2 text-[13px] text-mint transition hover:bg-surface-2">
            + Create organization
          </Link>
        </div>
      )}
    </Popover>
  );
}

export function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data, can } = useBootstrap();
  const session = useSession();
  const orgType = data?.org.type ?? session.memberships.find((m) => m.orgId === session.activeOrgId)?.org.type ?? "residential";
  const sections = visibleNav(orgType, (p) => (data ? can(p) : session.permissions.includes(p)));
  return (
    <nav className="space-y-5">
      {sections.map((s) => (
        <div key={s.section}>
          {!collapsed && <div className="text-eyebrow mb-1.5 px-3">{s.section}</div>}
          <ul className="space-y-0.5">
            {s.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cx("focus-ring group relative flex h-10 items-center gap-3 rounded-xl text-[13.5px] font-medium transition-colors", collapsed ? "justify-center" : "px-3", active ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text")}
                  >
                    {active && <motion.span layoutId={collapsed ? "nav-active-c" : "nav-active"} transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-xl border border-line-strong bg-surface-2" />}
                    {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-mint" />}
                    <Icon className={cx("relative size-[18px] shrink-0", active && "text-mint")} />
                    {!collapsed && <span className="relative truncate">{item.label}</span>}
                    {!collapsed && item.href === "/notifications" && !!data?.unread && <span className="num relative ml-auto rounded-full bg-mint px-1.5 text-[10.5px] font-bold text-mint-ink">{data.unread}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function useLogout() {
  const router = useRouter();
  return async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  };
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const logout = useLogout();
  const session = useSession();
  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 272 }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-bg-elev/90 backdrop-blur-xl lg:flex"
    >
      <div className={cx("flex h-16 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
        <Link href="/overview" aria-label="Nexora home">
          <Logo collapsed={collapsed} />
        </Link>
        {!collapsed && (
          <button onClick={onToggle} aria-label="Collapse sidebar" className="focus-ring rounded-lg p-1.5 text-faint transition hover:bg-surface-2 hover:text-text">
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>
      <div className={cx("pb-3", collapsed ? "px-3" : "px-4")}>
        <OrgSwitcher collapsed={collapsed} />
      </div>
      <div className={cx("min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-none", collapsed ? "px-3" : "px-3")}>
        <NavList collapsed={collapsed} />
      </div>
      <div className={cx("space-y-0.5 border-t border-line py-3", collapsed ? "px-3" : "px-3")}>
        {collapsed && (
          <button onClick={onToggle} aria-label="Expand sidebar" className="focus-ring flex h-10 w-full items-center justify-center rounded-xl text-faint hover:bg-surface-2 hover:text-text">
            <ChevronsLeft className="size-4 rotate-180" />
          </button>
        )}
        <BottomLink href="/settings" icon={<UserRound className="size-[18px]" />} label={session.user.name} collapsed={collapsed} />
        <BottomLink href="mailto:support@nexora.app" icon={<LifeBuoy className="size-[18px]" />} label="Support" collapsed={collapsed} />
        <button onClick={logout} title={collapsed ? "Log out" : undefined} className={cx("focus-ring flex h-10 w-full items-center gap-3 rounded-xl text-[13.5px] font-medium text-muted transition hover:bg-surface-2 hover:text-err", collapsed ? "justify-center" : "px-3")}>
          <LogOut className="size-[18px]" />
          <AnimatePresence>{!collapsed && <span>Log out</span>}</AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}

function BottomLink({ href, icon, label, collapsed }: { href: string; icon: React.ReactNode; label: string; collapsed: boolean }) {
  return (
    <Link href={href} title={collapsed ? label : undefined} className={cx("focus-ring flex h-10 items-center gap-3 rounded-xl text-[13.5px] font-medium text-muted transition hover:bg-surface-2 hover:text-text", collapsed ? "justify-center" : "px-3")}>
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
