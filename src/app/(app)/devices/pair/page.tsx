"use client";
import { appHref } from "@/lib/routes";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { AlertTriangle, ArrowLeft, Check, CircleCheck, Loader2, QrCode, Radar, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/controls";
import { useToast } from "@/components/ui/feedback";
import { Badge, Card, DemoBadge, PageHeader } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api } from "@/lib/api";
import { DEVICE_CATALOG, PROVIDER_LABEL } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Device, DeviceType, PublicIntegration } from "@/lib/types";

interface Discovered {
  externalId: string;
  name: string;
  type: DeviceType;
  manufacturer: string;
  model: string;
  firmware: string;
  ratedWatts: number;
  details?: string;
}

const STEPS = ["Method", "Discover", "Location", "Name", "Connect"];

export default function PairPage() {
  const { data, property, can } = useBootstrap();
  const router = useRouter();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState(0);
  const [integration, setIntegration] = useState<PublicIntegration | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [found, setFound] = useState<Discovered[] | null>(null);
  const [pick, setPick] = useState<Discovered | null>(null);
  const [floorId, setFloorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [essential, setEssential] = useState(false);
  const [phase, setPhase] = useState<"idle" | "connecting" | "done" | "error">("idle");
  const [pairError, setPairError] = useState<string | null>(null);
  const [result, setResult] = useState<{ device: Device; latencyMs: number; message: string } | null>(null);

  if (!data) return null;
  if (!can("integrations.manage")) return <p className="text-muted">Your role can&apos;t pair devices. Ask an owner or property manager.</p>;

  const discover = async (i: PublicIntegration) => {
    setDiscovering(true);
    setDiscoverError(null);
    setFound(null);
    try {
      const r = await api<{ devices: Discovered[] }>("/api/pairing/discover", { body: { integrationId: i.id } });
      setFound(r.devices);
    } catch (e) {
      setDiscoverError((e as Error).message);
    } finally {
      setDiscovering(false);
    }
  };

  const connect = async () => {
    if (!integration || !pick) return;
    setPhase("connecting");
    setPairError(null);
    try {
      const r = await api<{ device: Device; latencyMs: number; message: string }>("/api/pairing/pair", {
        body: { integrationId: integration.id, roomId, name, essential, device: { externalId: pick.externalId, type: pick.type, manufacturer: pick.manufacturer, model: pick.model, firmware: pick.firmware, ratedWatts: pick.ratedWatts } },
      });
      setResult(r);
      setPhase("done");
      await mutate(BOOT_KEY);
    } catch (e) {
      setPairError((e as Error).message);
      setPhase("error");
    }
  };

  const floors = data.floors;
  const rooms = data.rooms.filter((r) => r.floorId === floorId);
  const canNext = [!!integration, !!pick, !!roomId, name.trim().length >= 2, false][step];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/devices" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Devices
      </Link>
      <PageHeader eyebrow="Device pairing" title="Add a device" description="Nexora only marks a device as connected after its integration confirms two-way communication." />

      <ol className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold", i < step ? "bg-mint text-mint-ink" : i === step ? "bg-surface-3 ring-2 ring-[var(--mint)]" : "bg-surface-2 text-faint")}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
            <span className={cx("hidden truncate text-[12.5px] sm:block", i === step ? "font-medium text-text" : "text-faint")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px min-w-3 flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-[17px] font-semibold">How is this device connected?</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.integrations.map((i) => (
                    <button
                      key={i.id}
                      onClick={() => setIntegration(i)}
                      aria-pressed={integration?.id === i.id}
                      className={cx("focus-ring rounded-2xl border p-4 text-left transition", integration?.id === i.id ? "border-[var(--mint)] bg-[color-mix(in_srgb,var(--mint)_7%,transparent)]" : "border-line bg-surface-2 hover:border-line-strong")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold">{i.label}</span>
                        {i.provider === "simulated" ? <DemoBadge /> : <Badge tone={i.status === "connected" ? "ok" : "err"} dot>{i.status}</Badge>}
                      </div>
                      <div className="mt-1 text-[12px] text-muted">{PROVIDER_LABEL[i.provider]}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[12.5px] text-faint">
                  Need Matter, Home Assistant or Tuya? <Link href="/integrations" className="text-mint hover:underline">Connect an integration</Link> first. Not every Wi-Fi device exposes a controllable API — check the manufacturer supports one of these.
                </p>
              </div>
            )}

            {step === 1 && integration && (
              <div className="space-y-4">
                {integration.provider === "matter" && (
                  <div className="rounded-2xl border border-line bg-surface-2 p-4">
                    <div className="flex items-center gap-2 text-[14px] font-semibold">
                      <QrCode className="size-4 text-mint" /> Matter setup code
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted">Scan the QR on the device with the Nexora mobile app, or type the 11-digit manual pairing code.</p>
                    <Input className="mt-3" placeholder="3497-011-2332" value={setupCode} onChange={(e) => setSetupCode(e.target.value)} />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[17px] font-semibold">Discover devices via {integration.label}</h2>
                  <Button variant="outline" size="sm" icon={<RefreshCw className="size-3.5" />} loading={discovering} onClick={() => discover(integration)}>
                    {found || discoverError ? "Scan again" : "Scan"}
                  </Button>
                </div>
                {discovering && (
                  <div className="flex flex-col items-center py-10">
                    <div className="relative flex size-20 items-center justify-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-[color-mix(in_srgb,var(--mint)_25%,transparent)]" />
                      <span className="relative flex size-14 items-center justify-center rounded-full bg-surface-3 text-mint">
                        <Radar className="size-6" />
                      </span>
                    </div>
                    <p className="mt-4 text-[13px] text-muted">Looking for devices that aren&apos;t paired yet…</p>
                  </div>
                )}
                {!discovering && !found && !discoverError && (
                  <button onClick={() => discover(integration)} className="focus-ring flex w-full flex-col items-center rounded-2xl border border-dashed border-line-strong py-10 text-muted hover:text-text">
                    <Search className="mb-2 size-6" /> Start scanning
                  </button>
                )}
                {discoverError && (
                  <div className="flex items-start gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--err)_10%,transparent)] p-4 text-[13px]">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-err" />
                    <div>
                      <div className="font-semibold text-err">Discovery failed</div>
                      <div className="mt-0.5 text-text-2">{discoverError}</div>
                    </div>
                  </div>
                )}
                {found && found.length === 0 && <p className="py-6 text-center text-[13px] text-muted">No new devices found. Make sure the device is powered and in pairing mode.</p>}
                {found && found.length > 0 && (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {found.map((f) => (
                      <button key={f.externalId} onClick={() => (setPick(f), setName(f.name))} aria-pressed={pick?.externalId === f.externalId} className={cx("focus-ring rounded-2xl border p-3.5 text-left transition", pick?.externalId === f.externalId ? "border-[var(--mint)] bg-[color-mix(in_srgb,var(--mint)_7%,transparent)]" : "border-line bg-surface-2 hover:border-line-strong")}>
                        <div className="text-[13.5px] font-semibold">{f.name}</div>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {DEVICE_CATALOG[f.type].label} · {f.model}
                        </div>
                        {f.details && <div className="mt-1 text-[11px] text-faint">{f.details}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-[17px] font-semibold">Where is it installed?</h2>
                <Field label="Property" hint="Switch property from the top bar to pair into another one.">
                  {(id) => <Input id={id} value={property?.name ?? ""} disabled />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Floor">
                    {(id) => (
                      <Select id={id} value={floorId} onChange={(e) => (setFloorId(e.target.value), setRoomId(""))}>
                        <option value="">Choose floor</option>
                        {floors.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Room">
                    {(id) => (
                      <Select id={id} value={roomId} disabled={!floorId} onChange={(e) => setRoomId(e.target.value)}>
                        <option value="">Choose room</option>
                        {rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-[17px] font-semibold">Name it</h2>
                <Field label="Device name" hint="Use something people will recognise, e.g. “Patio Ceiling Fan”.">
                  {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
                <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
                  <div>
                    <div className="text-[13.5px] font-medium">Essential / safety load</div>
                    <p className="mt-0.5 text-[12px] text-muted">Protect fridges, medical equipment, security and life-safety systems from automated switch-off.</p>
                  </div>
                  <Switch label="Essential load" checked={essential} onChange={setEssential} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h2 className="text-[17px] font-semibold">Test connection & finish</h2>
                <div className="rounded-2xl border border-line bg-surface-2 p-4 text-[13px]">
                  <div className="font-semibold">{name}</div>
                  <div className="mt-0.5 text-muted">
                    {pick && DEVICE_CATALOG[pick.type].label} · {data.rooms.find((r) => r.id === roomId)?.name} · via {integration?.label}
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    ["Reach device through integration", phase !== "idle"],
                    ["Confirm two-way communication", phase === "done"],
                    ["Save to property inventory", phase === "done"],
                  ].map(([l, ok], i) => (
                    <li key={i} className="flex items-center gap-3 text-[13.5px]">
                      <span className={cx("flex size-6 items-center justify-center rounded-full", ok && phase === "done" ? "bg-mint text-mint-ink" : phase === "error" && i > 0 ? "bg-[color-mix(in_srgb,var(--err)_18%,transparent)] text-err" : "bg-surface-3 text-faint")}>
                        {phase === "connecting" ? <Loader2 className="size-3.5 animate-spin" /> : ok && phase === "done" ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
                      </span>
                      <span className={ok ? "text-text" : "text-muted"}>{l as string}</span>
                    </li>
                  ))}
                </ul>
                {phase === "error" && (
                  <div className="flex items-start gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--err)_10%,transparent)] p-4 text-[13px]">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-err" />
                    <div>
                      <div className="font-semibold text-err">Not connected</div>
                      <div className="mt-0.5 text-text-2">{pairError}</div>
                    </div>
                  </div>
                )}
                {phase === "done" && result && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] p-4 text-[13px]">
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" />
                    <div>
                      <div className="font-semibold text-ok">Paired · responded in {result.latencyMs} ms</div>
                      <div className="mt-0.5 text-text-2">{result.message}</div>
                    </div>
                  </motion.div>
                )}
                <div className="flex flex-wrap gap-2">
                  {phase !== "done" ? (
                    <Button variant="primary" loading={phase === "connecting"} onClick={connect}>
                      {phase === "error" ? "Retry connection" : "Connect & test"}
                    </Button>
                  ) : (
                    <>
                      <Button variant="primary" onClick={() => router.push(appHref(`/devices/${result?.device.id}`))}>
                        Open device
                      </Button>
                      <Button variant="outline" onClick={() => (setStep(1), setPick(null), setPhase("idle"), setResult(null), void (integration && discover(integration)))}>
                        Pair another
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {step < 4 && (
          <div className="mt-8 flex justify-between gap-3 border-t border-line pt-5">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Back
            </Button>
            <Button
              variant="primary"
              disabled={!canNext}
              onClick={() => {
                if (step === 0 && integration) {
                  setPick(null);
                  setFound(null);
                  void discover(integration);
                }
                if (step === 2 && !roomId) return toast({ tone: "info", title: "Choose a room" });
                setStep(step + 1);
              }}
            >
              Continue
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
