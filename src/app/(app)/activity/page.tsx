"use client";
import { appHref } from "@/lib/routes";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/controls";
import { Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { useBootstrap } from "@/hooks/useNexora";
import { fetcher } from "@/lib/api";
import type { ActivityPage } from "@/lib/apiTypes";

const SOURCES = ["user", "automation", "scene", "system", "integration", "gateway"];
const tone = { user: "cyan", automation: "mint", scene: "violet", system: "neutral", integration: "warn", gateway: "ok" } as const;

export default function ActivityPage() {
  const { data: boot } = useBootstrap();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [source, setSource] = useState("");
  const [scope, setScope] = useState<"property" | "org">("property");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => (setDebounced(q), setPage(1)), 250);
    return () => clearTimeout(t);
  }, [q]);
  const key = `/api/activity?page=${page}&size=25&q=${encodeURIComponent(debounced)}&source=${source}&scope=${scope}`;
  const { data } = useSWR<ActivityPage>(key, fetcher, { keepPreviousData: true, refreshInterval: 10000 });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const time = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", second: "2-digit" });

  return (
    <div>
      <PageHeader title="Activity Logs" description="Immutable audit trail of every device command, automation step, scene and administrative change — with previous and new state." />
      <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search device, user, action or state" className="pl-10" aria-label="Search activity" />
        </div>
        <Select aria-label="Source" value={source} onChange={(e) => (setSource(e.target.value), setPage(1))}>
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Select aria-label="Scope" value={scope} onChange={(e) => (setScope(e.target.value as typeof scope), setPage(1))}>
          <option value="property">This property</option>
          <option value="org">Whole organization</option>
        </Select>
      </div>
      {!data ? (
        <Skeleton className="h-96" />
      ) : data.rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-5" />} title="No matching activity" body="Try a broader search or another source." />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="text-eyebrow">
                <tr className="border-b border-line">
                  {["Time", "Device", "Action", "Previous → New", "By", "Source"].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {data.rows.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-2">
                    <td className="num whitespace-nowrap px-4 py-3 text-faint">{time(a.at)}</td>
                    <td className="px-4 py-3 font-medium">{a.deviceId && boot?.devices.some((d) => d.id === a.deviceId) ? <Link className="hover:underline" href={appHref(`/devices/${a.deviceId}`)}>{a.deviceName}</Link> : a.deviceName ?? "—"}</td>
                    <td className="px-4 py-3">{a.action}</td>
                    <td className="px-4 py-3 text-text-2">{a.previous ?? "—"} <span className="text-faint">→</span> {a.next ?? "—"}</td>
                    <td className="px-4 py-3 text-text-2">{a.userName ?? (a.automationId ? "Automation" : "System")}</td>
                    <td className="px-4 py-3"><Badge tone={tone[a.source]}>{a.source}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-[var(--line)] lg:hidden">
            {data.rows.map((a) => (
              <li key={a.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{a.deviceName ?? "System"} · <span className="font-normal text-muted">{a.action}</span></div>
                    <div className="truncate text-[12px] text-faint">{a.previous ?? "—"} → {a.next ?? "—"}</div>
                  </div>
                  <Badge tone={tone[a.source]}>{a.source}</Badge>
                </div>
                <div className="mt-1 text-[11.5px] text-faint">{time(a.at)} · {a.userName ?? (a.automationId ? "Automation" : "System")}</div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-[12.5px] text-muted">
            <span className="num">{data.total} events · page {page} of {pages}</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} icon={<ChevronLeft className="size-3.5" />}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="size-3.5" /></Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
