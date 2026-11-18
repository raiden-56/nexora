"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Cpu, LayoutDashboard, LifeBuoy, LogOut, Menu, Sparkles, Workflow, X } from "lucide-react";
import { cx } from "@/lib/format";
import type { SessionInfo } from "@/lib/types";
import { Logo } from "../brand";
import { CommandPalette } from "./CommandPalette";
import { NavList, OrgSwitcher, Sidebar, useLogout } from "./Sidebar";
import { SessionCtx } from "./SessionContext";
import { ThemeToggle, Topbar } from "./Topbar";

const TABS = [
  { href: "/overview", label: "Home", icon: LayoutDashboard },
  { href: "/devices", label: "Devices", icon: Cpu },
  { href: "/scenes", label: "Scenes", icon: Sparkles },
  { href: "/automations", label: "Routines", icon: Workflow },
];

export function AppShell({ session, children }: { session: SessionInfo; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const pathname = usePathname();
  const logout = useLogout();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("nx-sidebar") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => setDrawer(false), [pathname]);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("nx-sidebar", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  return (
    <SessionCtx.Provider value={session}>
      <div className="ambient min-h-dvh">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <div className={cx("min-h-dvh transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-20" : "lg:pl-[272px]")}>
          <Topbar onSearch={() => setSearch(true)} />
          <main className="mx-auto w-full max-w-[1600px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 sm:px-6 md:pt-8 lg:pb-12 xl:px-8">

            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                {children}
            </motion.div>
          </main>
        </div>

        {/* Mobile + tablet bottom navigation */}
        <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
          <div className="mx-auto grid h-[68px] max-w-xl grid-cols-5">
            {TABS.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + "/");
              return (
                <Link key={t.href} href={t.href} className={cx("relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", active ? "text-mint" : "text-faint")}>
                  {active && <motion.span layoutId="tab-pill" className="absolute top-1.5 h-8 w-12 rounded-full bg-[color-mix(in_srgb,var(--mint)_14%,transparent)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                  <t.icon className="relative size-5" />
                  <span className="relative">{t.label}</span>
                </Link>
              );
            })}
            <button onClick={() => setDrawer(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-faint" aria-label="Open menu">
              <Menu className="size-5" />
              More
            </button>
          </div>
        </nav>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawer && (
            <div className="fixed inset-0 z-[60] lg:hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setDrawer(false)} />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 40 }}
                className="absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col border-r border-line-strong bg-bg-elev pt-[env(safe-area-inset-top)]"
              >
                <div className="flex h-16 items-center justify-between px-5">
                  <Logo />
                  <button onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-lg p-2 text-muted hover:bg-surface-2">
                    <X className="size-5" />
                  </button>
                </div>
                <div className="px-4 pb-3">
                  <OrgSwitcher />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  <NavList onNavigate={() => setDrawer(false)} />
                </div>
                <div className="flex items-center gap-2 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <ThemeToggle />
                  <a href="mailto:support@nexora.app" className="flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] text-muted hover:bg-surface-2">
                    <LifeBuoy className="size-4" /> Support
                  </a>
                  <button onClick={logout} className="ml-auto flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-err">
                    <LogOut className="size-4" /> Log out
                  </button>
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <CommandPalette open={search} onClose={() => setSearch(false)} />
      </div>
    </SessionCtx.Provider>
  );
}
