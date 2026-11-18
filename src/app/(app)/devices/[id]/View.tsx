"use client";
import { appHref, useRouteId } from "@/lib/routes";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ArrowLeft, DoorOpen, Pencil, Radar, RefreshCw, Thermometer, Trash2, Wifi, WifiOff } from "lucide-react";
import { BarChart } from "@/components/charts";
import { DeviceControls } from "@/components/devices/DeviceControls";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import { DEVICE_CATALOG, has, PROVIDER_LABEL } from "@/lib/devices";
import { relTime } from "@/lib/format";
import type { ActivityLog, Device, PublicIntegration, Room } from "@/lib/types";

interface Detail {
  device: Device;
  room: Room | null;
  integration: PublicIntegration | null;
  activity: ActivityLog[];
  energy: { label: string; wh: number }[];
  usedIn: { scenes: { id: string; name: string }[]; automations: { id: string; name: string }[] };
}

export default function DevicePageView() {
  const id = useRouteId();
  const router = useRouter();
  const { data: boot, can, roomById } = useBootstrap();
  const { data, error, mutate } = useSWR<Detail>(`/api/devices/${id}`, fetcher, { refreshInterval: 5000 });
  const { mutate: g } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);

  // Prefer live state from the bootstrap snapshot (updated optimistically on control)
  const device = boot?.devices.find((d) => d.id === id) ?? data?.device;

  if (error) return <EmptyState icon={<WifiOff className="size-5" />} title="Device not found" body={error.message} action={<Link href="/devices"><Button>Back to devices</Button></Link>} />;
  if (!device || !data)
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Skeleton className="h-[520px]" />
        <Skeleton className="h-[520px]" />
      </div>
    );

  const room = roomById.get(device.roomId) ?? data.room;
  const simulated = device.provider === "simulated";
  const canManage = can("integrations.manage") || can("properties.manage");

  const simulate = async (body: Record<string, unknown>, label: string) => {
    try {
      await api(`/api/devices/${device.id}/simulate`, { body });
      await Promise.all([mutate(), g(BOOT_KEY)]);
      toast({ tone: "info", title: label, body: "Simulator event sent — matching automations evaluate immediately." });
    } catch (e) {
      toast({ tone: "error", title: "Simulator error", body: (e as Error).message });
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await api<{ ok: boolean; latencyMs: number; message: string }>(`/api/devices/${device.id}/test`, { method: "POST" });
      toast({ tone: r.ok ? "success" : "error", title: r.ok ? `Responded in ${r.latencyMs} ms` : "No response", body: r.message });
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Remove ${device.name}?`, body: `It will be unpaired from Nexora and removed from ${data.usedIn.scenes.length} scenes and ${data.usedIn.automations.length} automations. The physical device is not reset.`, confirmLabel: "Remove device", danger: true }))) return;
    try {
      await api(`/api/devices/${device.id}`, { method: "DELETE" });
      await g(BOOT_KEY);
      toast({ tone: "success", title: `${device.name} removed` });
      router.push("/devices");
    } catch (e) {
      toast({ tone: "error", title: "Couldn't remove device", body: (e as Error).message });
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href={room ? appHref(`/rooms/${room.id}`) : "/devices"} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
            <ArrowLeft className="size-4" /> {room?.name ?? "Devices"}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display text-[26px] sm:text-[30px]">{device.name}</h1>
            {simulated && <DemoBadge />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone={device.online ? "ok" : "err"} dot>
              {device.online ? "Online" : "Offline"}
            </Badge>
            <span>{DEVICE_CATALOG[device.type].label}</span>·<span>{PROVIDER_LABEL[device.provider]}</span>·<span>Last seen {relTime(device.lastSeenAt)}</span>
            {device.essential && <Badge tone="warn">Essential load</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<RefreshCw className="size-4" />} loading={testing} onClick={test}>
            Test connection
          </Button>
          {canManage && (
            <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="p-5 sm:p-6">
          <DeviceControls device={device} canControl={can("devices.control")} />
          {simulated && (
            <div className="mt-6 rounded-2xl border border-dashed p-4" style={{ borderColor: "color-mix(in srgb, var(--violet) 40%, transparent)" }}>
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-violet">Simulator controls</div>
              <p className="mb-3 text-[12px] text-muted">This is simulated hardware. Use these to reproduce real-world events and test automations and failure handling.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" icon={device.online ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />} onClick={() => simulate({ online: !device.online }, device.online ? "Device taken offline" : "Device back online")}>
                  {device.online ? "Simulate outage" : "Restore connection"}
                </Button>
                {has(device, "motion") && (
                  <Button size="sm" variant="outline" icon={<Radar className="size-3.5" />} onClick={() => simulate({ motion: !device.state.motion }, device.state.motion ? "Motion cleared" : "Motion detected")}>
                    {device.state.motion ? "Clear motion" : "Trigger motion"}
                  </Button>
                )}
                {has(device, "contact") && (
                  <Button size="sm" variant="outline" icon={<DoorOpen className="size-3.5" />} onClick={() => simulate({ contact: device.state.contact === "open" ? "closed" : "open" }, device.state.contact === "open" ? "Door closed" : "Door opened")}>
                    {device.state.contact === "open" ? "Close door" : "Open door"}
                  </Button>
                )}
                {has(device, "temperature") && (
                  <Button size="sm" variant="outline" icon={<Thermometer className="size-3.5" />} onClick={() => simulate({ temperature: Math.round(((device.state.temperature ?? 25) + 2) * 10) / 10 }, "Temperature +2°C")}>
                    +2°C
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Energy · last 24 hours" subtitle={`Rated ${device.ratedWatts} W`} action={simulated ? <DemoBadge label="Demo data" /> : null} />
            <div className="p-5 pt-3">
              <BarChart data={data.energy} valueKey="wh" format={(v) => `${Math.round(v)} Wh`} valueLabel="Energy" height={170} color="var(--cyan)" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px] sm:grid-cols-3">
              {[
                ["Room", room?.name ?? "—"],
                ["Manufacturer", device.manufacturer],
                ["Model", device.model],
                ["Firmware", device.firmware],
                ["Protocol / provider", PROVIDER_LABEL[device.provider]],
                ["Integration", data.integration?.label ?? "—"],
                ["External ID", device.externalId],
                ["Capabilities", device.capabilities.join(", ")],
                ["Added", new Date(device.createdAt).toLocaleDateString("en-IN")],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-eyebrow">{k}</dt>
                  <dd className="mt-1 truncate text-text-2" title={v}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            {(data.usedIn.scenes.length > 0 || data.usedIn.automations.length > 0) && (
              <div className="flex flex-wrap gap-1.5 border-t border-line p-5">
                <span className="mr-1 text-[12px] text-faint">Used in</span>
                {data.usedIn.automations.map((a) => (
                  <Link key={a.id} href={appHref(`/automations/${a.id}`)}>
                    <Badge tone="mint">{a.name}</Badge>
                  </Link>
                ))}
                {data.usedIn.scenes.map((s) => (
                  <Link key={s.id} href="/scenes">
                    <Badge tone="violet">{s.name}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Activity history" subtitle="Every state change with its source" />
            <ul className="max-h-[380px] divide-y divide-[var(--line)] overflow-y-auto px-5 pb-3">
              {data.activity.length === 0 && <li className="py-6 text-center text-[13px] text-muted">No activity recorded yet.</li>}
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-3 text-[13px]">
                  <div className="min-w-0">
                    <div className="font-medium">{a.action}</div>
                    <div className="truncate text-[12px] text-faint">
                      {a.previous && a.next ? `${a.previous} → ${a.next}` : a.next ?? a.previous ?? ""} · {a.userName ?? a.source}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-faint">{relTime(a.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <EditDevice open={editing} onClose={() => setEditing(false)} device={device} rooms={boot?.rooms ?? []} onSaved={() => Promise.all([mutate(), g(BOOT_KEY)])} onRemove={can("integrations.manage") ? remove : undefined} />
    </div>
  );
}

function EditDevice({ open, onClose, device, rooms, onSaved, onRemove }: { open: boolean; onClose: () => void; device: Device; rooms: Room[]; onSaved: () => Promise<unknown>; onRemove?: () => void }) {
  const [name, setName] = useState(device.name);
  const [roomId, setRoomId] = useState(device.roomId);
  const [essential, setEssential] = useState(device.essential);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/devices/${device.id}`, { method: "PATCH", body: { name, roomId, essential } });
      await onSaved();
      toast({ tone: "success", title: "Device updated" });
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit device"
      description="Rename, move to another room, or protect it as an essential load."
      footer={
        <>
          {onRemove && (
            <Button variant="danger" className="sm:mr-auto" icon={<Trash2 className="size-4" />} onClick={onRemove}>
              Remove device
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Room">
          {(id) => (
            <Select id={id} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
          <div>
            <div className="text-[13.5px] font-medium">Essential / safety load</div>
            <p className="mt-0.5 text-[12px] text-muted">Never switched off by bulk actions, hotel checkout, after-hours or end-of-schedule automations.</p>
          </div>
          <Switch label="Essential load" checked={essential} onChange={setEssential} />
        </div>
      </div>
    </Modal>
  );
}
