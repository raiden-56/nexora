"use client";
import { useState } from "react";
import useSWR from "swr";
import { ArrowDownRight, ArrowUpRight, Download, IndianRupee, Leaf, Lightbulb, Zap } from "lucide-react";
import { AreaChart, BarChart, HBarList, Ring } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Badge, Card, CardHeader, DemoBadge, PageHeader, Skeleton } from "@/components/ui/surface";
import { useBootstrap } from "@/hooks/useNexora";
import { fetcher } from "@/lib/api";
import type { EnergyReport } from "@/lib/apiTypes";
import { kwh, money, watts } from "@/lib/format";

type Range = "24h" | "7d" | "30d";

export default function EnergyPage() {
  const { data: boot, property, can } = useBootstrap();
  const [range, setRange] = useState<Range>("7d");
  const [scope, setScope] = useState<"property" | "org">("property");
  const { data, isLoading } = useSWR<EnergyReport>(can("analytics.view") ? `/api/energy?range=${range}&scope=${scope}` : null, fetcher, { refreshInterval: 60000, keepPreviousData: true });

  if (boot && !can("analytics.view")) return <p className="text-muted">Your role doesn&apos;t include analytics.</p>;
  if (!data || !boot) return <Skeleton className="h-[600px]" />;

  const rangeLabel = { "24h": "last 24 hours", "7d": "last 7 days", "30d": "last 30 days" }[range];
  const prevLabel = { "24h": "Previous day", "7d": "Previous week", "30d": "Previous 30 days" }[range];
  const up = data.changePct > 0;

  const exportCsv = () => {
    const rows = [
      ["Section", "Name", "Detail", "kWh", `Cost (${data.currency})`],
      ...data.series.map((s) => ["Timeline", s.label, s.at, s.kwh, (s.kwh * data.tariff).toFixed(2)]),
      ...data.byDevice.map((d) => ["Device", d.name, d.room, d.kwh, d.cost]),
      ...data.byRoom.map((r) => ["Room", r.name, "", r.kwh, r.cost]),
      ...data.byProperty.map((p) => ["Property", p.name, "", p.kwh, p.cost]),
    ];
    const csv = (data.source === "demonstration" ? "# DEMONSTRATION DATA — simulated devices, not real meter readings\n" : "") + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexora-energy-${scope === "org" ? boot.org.name : property?.name}-${range}.csv`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={isLoading ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <PageHeader
        eyebrow={scope === "org" ? `${boot.org.name} · all properties` : property?.name}
        title="Energy Analytics"
        description={
          <>
            Consumption, cost and saving opportunities for the {rangeLabel}.{" "}
            {data.source === "demonstration" && <span className="text-violet">Figures are a labelled demonstration profile — simulated devices have no real meters.</span>}
          </>
        }
        actions={
          <Button variant="outline" icon={<Download className="size-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Segmented label="Range" value={range} onChange={setRange} options={[{ value: "24h", label: "24 hours" }, { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }]} />
        {boot.properties.length > 1 && <Segmented label="Scope" value={scope} onChange={setScope} options={[{ value: "property", label: "This property" }, { value: "org", label: "All properties" }]} />}
        {data.source === "demonstration" && <DemoBadge label="Demonstration data" className="ml-auto" />}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-[12.5px] text-muted">Total consumption <Zap className="size-4 text-mint" /></div>
          <div className="num mt-3 font-display text-[24px] font-bold sm:text-[28px]">{kwh(data.totalKwh)}</div>
          <div className={`mt-1.5 flex items-center gap-1 text-[12px] ${up ? "text-warn" : "text-ok"}`}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />} {Math.abs(data.changePct)}% vs {prevLabel.toLowerCase()}
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-[12.5px] text-muted">Estimated cost <IndianRupee className="size-4 text-warn" /></div>
          <div className="num mt-3 font-display text-[24px] font-bold sm:text-[28px]">{money(data.cost, data.currency)}</div>
          <div className="mt-1.5 text-[12px] text-faint">@ {money(data.tariff, data.currency)}/kWh avg tariff</div>
        </Card>
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-[12.5px] text-muted">Projected this month <Lightbulb className="size-4 text-cyan" /></div>
          <div className="num mt-3 font-display text-[24px] font-bold sm:text-[28px]">{money(data.projectedMonthlyCost, data.currency)}</div>
          <div className="mt-1.5 text-[12px] text-faint">At the current run-rate</div>
        </Card>
        <Card className="flex items-center gap-4 p-4 sm:p-5">
          <Ring value={data.liveWatts} max={Math.max(data.liveWatts * 1.6, 2000)} size={78} stroke={8} color="var(--mint)">
            <Zap className="size-4 text-mint" />
          </Ring>
          <div>
            <div className="text-[12.5px] text-muted">Live draw</div>
            <div className="num font-display text-[22px] font-bold">{watts(data.liveWatts)}</div>
            <div className="text-[11.5px] text-faint">from current device states</div>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Consumption over time" subtitle={`kWh per ${range === "24h" ? "hour" : "day"} compared with the ${prevLabel.toLowerCase()}`} />
          <div className="p-5 pt-3">
            <AreaChart data={data.series} height={260} series={[{ key: "kwh", label: "Current", color: "var(--mint)" }, { key: "previousKwh", label: prevLabel, color: "var(--blue)", dashed: true }]} format={(v) => kwh(v)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Room-wise" subtitle={`Top rooms · ${rangeLabel}`} />
          <div className="p-5">
            <HBarList items={data.byRoom.slice(0, 7).map((r) => ({ label: r.name, value: r.kwh }))} format={(v) => kwh(v)} color="var(--cyan)" />
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Device-wise" subtitle="Highest consumers" />
          <div className="divide-y divide-[var(--line)] px-5 pb-3 pt-2">
            {data.byDevice.map((d, i) => (
              <div key={d.deviceId} className="flex items-center gap-3 py-2.5 text-[13px]">
                <span className="num w-5 text-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {d.name} {d.essential && <Badge tone="warn" className="ml-1 h-5">Essential</Badge>}
                  </div>
                  <div className="truncate text-[12px] text-faint">{d.room}</div>
                </div>
                <div className="text-right">
                  <div className="num font-semibold">{kwh(d.kwh)}</div>
                  <div className="num text-[11.5px] text-faint">{money(d.cost, data.currency)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Energy-saving opportunities" subtitle="Derived from live device state and occupancy" action={<Leaf className="size-4 text-ok" />} />
            <ul className="space-y-2 p-5">
              {data.opportunities.length === 0 && <li className="text-[13px] text-muted">No obvious waste right now. Nice.</li>}
              {data.opportunities.map((o, i) => (
                <li key={i} className="rounded-xl border border-line bg-surface-2 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[13px] font-semibold">{o.title}</div>
                    <Badge tone="ok">~{kwh(o.savingKwh)}/day</Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">{o.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
          {data.byProperty.length > 1 && (
            <Card>
              <CardHeader title="Property comparison" subtitle={rangeLabel} />
              <div className="p-5 pt-3">
                <BarChart data={data.byProperty.map((p) => ({ label: p.name.split(" ").slice(0, 2).join(" "), kwh: p.kwh }))} valueKey="kwh" format={(v) => kwh(v)} color="var(--violet)" height={180} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
