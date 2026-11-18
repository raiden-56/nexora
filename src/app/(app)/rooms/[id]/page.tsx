"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ArrowLeft, ArrowUpRight, Lightbulb, Power, PowerOff, Users, Workflow } from "lucide-react";
import { DeviceCard } from "@/components/devices/DeviceCard";
import { DeviceControls } from "@/components/devices/DeviceControls";
import { ROOM_KIND_LABEL } from "@/components/property/PropertyWizard";
import { roomStats } from "@/components/property/FloorPlan";
import { RoomArt } from "@/components/property/RoomArt";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import type { AutomationView } from "@/lib/apiTypes";
import { estimateWatts, isSwitchable } from "@/lib/devices";
import { daysLabel, to12h, watts } from "@/lib/format";

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const { data, roomById, floorById, devicesByRoom, can } = useBootstrap();
  const { data: autos } = useSWR<{ automations: AutomationView[] }>("/api/automations", fetcher);
  const [openId, setOpenId] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();

  if (!data) return <Skeleton className="h-[600px]" />;
  const room = roomById.get(id);
  if (!room) return <EmptyState icon={<ArrowLeft className="size-5" />} title="Room not found" body="It may belong to another property. Switch property from the top bar." action={<Link href="/rooms"><Button>All rooms</Button></Link>} />;

  const devices = devicesByRoom.get(room.id) ?? [];
  const s = roomStats(devices);
  const floor = floorById.get(room.floorId);
  const open = devices.find((d) => d.id === openId) ?? null;
  const canControl = can("devices.control");
  const lights = devices.filter((d) => (d.type === "bulb" || d.type === "led_strip" || d.type === "switch") && d.online);
  const power = devices.reduce((sum, d) => sum + estimateWatts(d), 0);
  const roomAutos = (autos?.automations ?? []).filter((a) => a.actions.some((x) => x.type === "device" && devices.some((d) => d.id === x.deviceId)) || a.conditions.some((c) => c.type === "room_occupied" && c.roomId === room.id));

  const bulk = async (ids: string[], on: boolean, label: string) => {
    if (!ids.length) return toast({ tone: "info", title: "Nothing to switch" });
    if (!on && ids.length > 2 && !(await confirm({ title: `${label}?`, body: `${ids.length} devices in ${room.name} will be switched off. Essential loads are skipped.`, confirmLabel: "Turn off", danger: true }))) return;
    try {
      const r = await api<{ succeeded: number; failed: number }>("/api/devices/bulk", { body: { deviceIds: ids, command: { on } } });
      toast({ tone: r.failed ? "warning" : "success", title: `${label}: ${r.succeeded} done${r.failed ? `, ${r.failed} failed` : ""}` });
      await mutate(BOOT_KEY);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't update room", body: (e as Error).message });
    }
  };

  const setOccupied = async (v: boolean) => {
    try {
      await api(`/api/rooms/${room.id}`, { method: "PATCH", body: { occupied: v } });
      await mutate(BOOT_KEY);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't change occupancy", body: (e as Error).message });
    }
  };

  return (
    <div>
      <Link href="/rooms" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="size-4" /> {floor?.name ?? "Rooms"}
      </Link>
      <Card className="mb-6 overflow-hidden">
        <div className="grid md:grid-cols-[280px_1fr]">
          <RoomArt kind={room.kind} lit={s.active > 0} className="h-36 md:h-full" />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-eyebrow">{floor?.name} · {ROOM_KIND_LABEL[room.kind]}</div>
                <h1 className="text-display mt-1.5 text-[28px]">{room.name}</h1>
                {room.hotel && <Badge tone="cyan" className="mt-2">Guest room · {room.hotel.status}{room.hotel.guestName ? ` · ${room.hotel.guestName}` : ""}</Badge>}
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
                <Users className="size-4 text-cyan" />
                <span className="text-[13px] font-medium">Occupied</span>
                <Switch label="Room occupied" checked={room.occupied} disabled={!canControl} onChange={setOccupied} />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-[13px]">
              <div><span className="num font-display text-[20px] font-bold">{s.total}</span> <span className="text-faint">devices</span></div>
              <div><span className="num font-display text-[20px] font-bold text-mint">{s.active}</span> <span className="text-faint">active</span></div>
              <div><span className={`num font-display text-[20px] font-bold ${s.offline ? "text-err" : ""}`}>{s.offline}</span> <span className="text-faint">offline</span></div>
              <div><span className="num font-display text-[20px] font-bold">{watts(power)}</span> <span className="text-faint">now</span></div>
            </div>
            {canControl && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<Lightbulb className="size-3.5" />} onClick={() => bulk(lights.map((d) => d.id), true, "Lights on")}>Lights on</Button>
                <Button size="sm" variant="secondary" icon={<Lightbulb className="size-3.5 opacity-50" />} onClick={() => bulk(lights.map((d) => d.id), false, "Lights off")}>Lights off</Button>
                <Button size="sm" variant="secondary" icon={<Power className="size-3.5" />} onClick={() => bulk(devices.filter((d) => isSwitchable(d) && d.online).map((d) => d.id), true, "Everything on")}>All on</Button>
                <Button size="sm" variant="danger" icon={<PowerOff className="size-3.5" />} onClick={() => bulk(devices.filter((d) => isSwitchable(d) && d.online && !d.essential).map((d) => d.id), false, `Turn off ${room.name}`)}>All off</Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <h2 className="mb-3 text-[15px] font-semibold">Devices</h2>
          {devices.length === 0 ? (
            <EmptyState icon={<Power className="size-5" />} title="No devices in this room" body="Pair a device and assign it here, or move an existing device from its settings." action={can("integrations.manage") && <Link href="/devices/pair"><Button variant="primary">Pair device</Button></Link>} />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {devices.map((d) => (
                <DeviceCard key={d.id} device={d} canControl={canControl} onOpen={() => setOpenId(d.id)} />
              ))}
            </div>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader title="Room automations" subtitle="Routines that touch this room" action={<Workflow className="size-4 text-faint" />} />
          <ul className="space-y-1 p-3">
            {roomAutos.length === 0 && <li className="p-3 text-[13px] text-muted">No automations use this room yet.</li>}
            {roomAutos.map((a) => (
              <li key={a.id}>
                <Link href={`/automations/${a.id}`} className="flex items-center justify-between gap-2 rounded-xl p-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{a.name}</span>
                    <span className="block truncate text-[12px] text-faint">{a.trigger.type === "time" ? `${to12h(a.trigger.time)} · ${daysLabel(a.trigger.days)}` : a.trigger.type.replace("_", " ")}</span>
                  </span>
                  <Badge tone={a.enabled ? "ok" : "idle"}>{a.enabled ? "Active" : "Paused"}</Badge>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/automations/new" className="flex items-center gap-1.5 p-3 text-[13px] font-medium text-mint">
                Create automation <ArrowUpRight className="size-3.5" />
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.name} headerExtra={open && <Link href={`/devices/${open.id}`} className="mr-1 text-[12.5px] font-medium text-mint">Details</Link>}>
        {open && <DeviceControls device={open} canControl={canControl} />}
      </Sheet>
    </div>
  );
}
