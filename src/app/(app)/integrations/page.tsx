"use client";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Cloud, Cpu, House, KeyRound, Network, Radio, RefreshCw, Router, ShieldCheck, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, DemoBadge, PageHeader, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import { relTime } from "@/lib/format";
import type { ProviderKey, PublicIntegration } from "@/lib/types";

const PROVIDERS: { key: ProviderKey; name: string; icon: typeof Cpu; tagline: string; how: string; fields: { key: string; label: string; type?: string; placeholder?: string; hint?: string }[]; status: string }[] = [
  { key: "matter", name: "Matter", icon: Network, tagline: "Primary interoperability standard — local, multi-vendor", how: "Commissioned through the Nexora local gateway (Matter controller). Devices are paired with their QR / setup code.", fields: [], status: "Requires local gateway" },
  { key: "home_assistant", name: "Home Assistant", icon: House, tagline: "Thousands of integrations with local control", how: "Connects to your Home Assistant REST API with a long-lived access token. Lights, switches, fans, climate, covers and locks are imported.", fields: [{ key: "baseUrl", label: "Home Assistant URL", placeholder: "http://homeassistant.local:8123" }, { key: "token", label: "Long-lived access token", type: "password", hint: "Profile → Security → Long-lived access tokens. Stored server-side only." }], status: "Live integration" },
  { key: "tuya", name: "Tuya Smart", icon: Cloud, tagline: "Smart Life switches, plugs, bulbs and appliances", how: "Uses a Tuya IoT Platform cloud project. Requests are HMAC-signed on the server; secrets never reach the browser.", fields: [{ key: "clientId", label: "Access ID / Client ID" }, { key: "clientSecret", label: "Access Secret", type: "password" }, { key: "region", label: "Data center", placeholder: "in / eu / us / cn" }], status: "Adapter ready · transport pending" },
  { key: "mqtt", name: "MQTT", icon: Radio, tagline: "Custom and DIY devices over a broker", how: "The gateway subscribes to device topics on your broker with authenticated TLS connections.", fields: [{ key: "baseUrl", label: "Broker URL", placeholder: "mqtts://broker.local:8883" }, { key: "token", label: "Password / token", type: "password" }], status: "Adapter ready · transport pending" },
  { key: "zigbee", name: "Zigbee", icon: Router, tagline: "Through a coordinator such as Zigbee2MQTT", how: "Zigbee devices are bridged by a coordinator connected to the local gateway, then managed like MQTT devices.", fields: [{ key: "baseUrl", label: "Zigbee2MQTT broker URL", placeholder: "mqtt://192.168.1.20:1883" }], status: "Via coordinator" },
  { key: "simulated", name: "Nexora Simulator", icon: Cpu, tagline: "Realistic virtual devices for demos and development", how: "Behaves like hardware — latency, outages and sensor events — and is always labelled as simulated.", fields: [], status: "Development" },
];

export default function IntegrationsPage() {
  const { can } = useBootstrap();
  const { data, mutate } = useSWR<{ integrations: PublicIntegration[] }>("/api/integrations", fetcher);
  const [connect, setConnect] = useState<(typeof PROVIDERS)[number] | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const { mutate: g } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();
  if (!data) return <Skeleton className="h-96" />;
  const manage = can("integrations.manage");

  const test = async (i: PublicIntegration) => {
    setTesting(i.id);
    try {
      const r = await api<PublicIntegration>(`/api/integrations/${i.id}/test`, { method: "POST" });
      toast({ tone: r.status === "connected" ? "success" : "error", title: r.status === "connected" ? `${i.label} connected` : `${i.label}: not reachable`, body: r.message });
      await Promise.all([mutate(), g(BOOT_KEY)]);
    } finally {
      setTesting(null);
    }
  };
  const remove = async (i: PublicIntegration) => {
    if (!(await confirm({ title: `Disconnect ${i.label}?`, body: "Stored credentials are deleted. Integrations with paired devices must have those devices removed first.", confirmLabel: "Disconnect", danger: true }))) return;
    try {
      await api(`/api/integrations/${i.id}`, { method: "DELETE" });
      await Promise.all([mutate(), g(BOOT_KEY)]);
      toast({ tone: "success", title: `${i.label} disconnected` });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't disconnect", body: (e as Error).message });
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Vendor-neutral by design" title="Integrations" description="Every ecosystem plugs into the same device abstraction — the dashboard, scenes and automations work identically whether a device speaks Matter, Home Assistant or Tuya." />

      <Card className="mb-6">
        <CardHeader title="Connected accounts" subtitle="Credentials are encrypted at rest and never sent to the browser" action={<ShieldCheck className="size-4 text-ok" />} />
        <ul className="divide-y divide-[var(--line)] p-2">
          {data.integrations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px] font-medium">
                  {i.label} {i.provider === "simulated" && <DemoBadge />}
                </div>
                <div className="truncate text-[12px] text-faint">
                  {PROVIDERS.find((p) => p.key === i.provider)?.name} · {i.hasCredentials ? "Credentials stored" : "No credentials"} · synced {relTime(i.lastSyncAt)}
                  {i.message ? ` · ${i.message}` : ""}
                </div>
              </div>
              <Badge tone={i.status === "connected" ? "ok" : i.status === "error" ? "err" : "idle"} dot>{i.status}</Badge>
              {manage && (
                <div className="flex gap-1">
                  <IconButton label="Test connection" onClick={() => test(i)} disabled={testing === i.id}>
                    <RefreshCw className={`size-4 ${testing === i.id ? "animate-spin" : ""}`} />
                  </IconButton>
                  <IconButton label="Disconnect" className="hover:text-err" onClick={() => remove(i)}>
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-3 text-[15px] font-semibold">Available integrations</h2>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {PROVIDERS.map((p) => {
          const accounts = data.integrations.filter((i) => i.provider === p.key);
          return (
            <Card key={p.key} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-mint">
                  <p.icon className="size-5" />
                </span>
                <Badge tone={p.key === "home_assistant" ? "ok" : p.key === "simulated" ? "violet" : "neutral"}>{p.status}</Badge>
              </div>
              <h3 className="mt-4 text-[16px] font-semibold">{p.name}</h3>
              <p className="mt-0.5 text-[12.5px] text-text-2">{p.tagline}</p>
              <p className="mt-3 text-[12px] text-faint">{p.how}</p>
              <div className="mt-auto flex items-center justify-between pt-5">
                <span className="text-[12px] text-faint">{accounts.length ? `${accounts.length} connected` : "Not connected"}</span>
                {manage && <Button size="sm" variant={accounts.length ? "secondary" : "primary"} onClick={() => setConnect(p)}>{accounts.length ? "Add another" : "Connect"}</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-5 text-[13px] text-muted">
        <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-text"><KeyRound className="size-4 text-mint" /> How control works</div>
        Nexora never assumes a Wi-Fi device is controllable. Each provider adapter must confirm discovery and two-way communication before a device is shown as connected, and each command reports the provider&apos;s real result. Safety-critical automations are designed to run on the local gateway so they keep working without internet.
      </Card>

      {connect && <ConnectModal provider={connect} onClose={() => setConnect(null)} onDone={() => Promise.all([mutate(), g(BOOT_KEY)])} />}
    </div>
  );
}

function ConnectModal({ provider, onClose, onDone }: { provider: (typeof PROVIDERS)[number]; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [label, setLabel] = useState(provider.name);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, string> = { provider: provider.key, label };
      for (const [k, v] of Object.entries(vals)) if (v.trim()) body[k] = v.trim();
      const r = await api<PublicIntegration>("/api/integrations", { body });
      await onDone();
      toast({ tone: r.status === "connected" ? "success" : "warning", title: r.status === "connected" ? `${label} connected` : `${label} saved but not connected`, body: r.message });
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't connect", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Connect ${provider.name}`} description={provider.how} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Connect & test</Button></>}>
      <div className="space-y-4">
        <Field label="Display name">{(id) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} />}</Field>
        {provider.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            {(id) => <Input id={id} type={f.type ?? "text"} autoComplete="off" placeholder={f.placeholder} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />}
          </Field>
        ))}
        {!provider.fields.length && <p className="text-[13px] text-muted">No credentials needed. Nexora will check that the {provider.name} transport is reachable.</p>}
      </div>
    </Modal>
  );
}
