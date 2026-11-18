"use client";
import Link from "next/link";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { BedDouble, BrushCleaning, ConciergeBell, DoorOpen, LogIn, LogOut, ShieldCheck, Sparkles, Thermometer, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/overlay";
import { Badge, Card, EmptyState, PageHeader, Skeleton, Stat } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api } from "@/lib/api";
import { cx, relTime } from "@/lib/format";
import type { HotelRoomStatus, Room } from "@/lib/types";

const STATUS: Record<HotelRoomStatus, { label: string; color: string; tone: "ok" | "cyan" | "warn" | "violet" | "err" }> = {
  occupied: { label: "Occupied", color: "var(--cyan)", tone: "cyan" },
  vacant: { label: "Vacant · ready", color: "var(--ok)", tone: "ok" },
  checkout: { label: "Checked out", color: "var(--warn)", tone: "warn" },
  cleaning: { label: "Housekeeping", color: "var(--violet)", tone: "violet" },
  maintenance: { label: "Maintenance", color: "var(--err)", tone: "err" },
};

export default function HotelPage() {
  const { data, devicesByRoom, can } = useBootstrap();
  const [filter, setFilter] = useState<"all" | HotelRoomStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  if (!data) return <Skeleton className="h-96" />;
  const guestRooms = data.rooms.filter((r) => r.kind === "guest_room");
  if (!guestRooms.length)
    return (
      <EmptyState
        icon={<ConciergeBell className="size-5" />}
        title="No guest rooms in this property"
        body={data.org.type === "hospitality" ? "Add rooms of type “Guest room” to manage check-in, housekeeping and occupancy automation." : "Hotel operations are for hospitality organizations. Switch to one from the organization menu, or add guest rooms here."}
        action={<Link href="/rooms"><Button variant="primary">Manage rooms</Button></Link>}
      />
    );

  const counts = (s: HotelRoomStatus) => guestRooms.filter((r) => (r.hotel?.status ?? "vacant") === s).length;
  const occupancy = Math.round((counts("occupied") / guestRooms.length) * 100);
  const shown = guestRooms.filter((r) => filter === "all" || (r.hotel?.status ?? "vacant") === filter);
  const byFloor = data.floors.map((f) => ({ floor: f, rooms: shown.filter((r) => r.floorId === f.id) })).filter((x) => x.rooms.length);
  const open = guestRooms.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <PageHeader eyebrow={data.org.name} title="Hotel Operations" description="Check-in, check-out and housekeeping drive guest-room automation. Locks, minibars, emergency lighting and life-safety systems are never switched off by these workflows." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Occupancy" value={occupancy} suffix="%" icon={<BedDouble className="size-4" />} tone="cyan" foot={`${counts("occupied")} of ${guestRooms.length} rooms`} />
        <Stat label="Ready to sell" value={counts("vacant")} icon={<Sparkles className="size-4" />} tone="ok" foot="Vacant & clean" />
        <Stat label="Awaiting housekeeping" value={counts("checkout")} icon={<LogOut className="size-4" />} tone="warn" foot="Checked out" />
        <Stat label="Being cleaned" value={counts("cleaning")} icon={<BrushCleaning className="size-4" />} tone="violet" />
        <Stat label="Maintenance" value={counts("maintenance")} icon={<Wrench className="size-4" />} tone="err" foot={`${guestRooms.flatMap((r) => devicesByRoom.get(r.id) ?? []).filter((d) => !d.online).length} room devices offline`} />
      </div>

      <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <Segmented label="Filter rooms" value={filter} onChange={setFilter} options={[{ value: "all", label: "All rooms" }, ...(Object.keys(STATUS) as HotelRoomStatus[]).map((s) => ({ value: s, label: STATUS[s].label.split(" ·")[0] }))]} />
      </div>

      <div className="space-y-6">
        {byFloor.map(({ floor, rooms }) => (
          <div key={floor.id}>
            <div className="text-eyebrow mb-2.5">{floor.name}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
              {rooms.map((r) => {
                const st = STATUS[r.hotel?.status ?? "vacant"];
                const devs = devicesByRoom.get(r.id) ?? [];
                const ac = devs.find((d) => d.type === "ac");
                const offline = devs.filter((d) => !d.online).length;
                return (
                  <button key={r.id} onClick={() => setOpenId(r.id)} className="focus-ring card relative overflow-hidden p-4 text-left transition hover:border-line-strong">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: st.color }} />
                    <div className="flex items-start justify-between">
                      <span className="num font-display text-[22px] font-bold">{r.hotel?.number ?? r.name}</span>
                      {offline > 0 && <Badge tone="err">{offline} offline</Badge>}
                    </div>
                    <div className="mt-1 text-[12px] font-medium" style={{ color: st.color }}>{st.label}</div>
                    <div className="mt-3 truncate text-[12.5px] text-text-2">{r.hotel?.guestName ?? "—"}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11.5px] text-faint">
                      <Thermometer className="size-3" /> {ac?.online ? (ac.state.on ? `${ac.state.targetTemp}°C` : "AC off") : "AC offline"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open ? `Room ${open.hotel?.number ?? open.name}` : ""}>
        {open && <RoomOps room={open} canOperate={can("hotel.operate")} onDone={() => setOpenId(null)} />}
      </Sheet>
    </div>
  );
}

function RoomOps({ room, canOperate, onDone }: { room: Room; canOperate: boolean; onDone: () => void }) {
  const { devicesByRoom } = useBootstrap();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();
  const [guest, setGuest] = useState("");
  const [temp, setTemp] = useState(23);
  const [busy, setBusy] = useState<string | null>(null);
  const status = room.hotel?.status ?? "vacant";
  const devs = devicesByRoom.get(room.id) ?? [];

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const r = await api<{ failed: number; results: { device: string; ok: boolean; detail?: string }[] }>(`/api/hotel/rooms/${room.id}`, { body: { action, ...body } });
      await mutate(BOOT_KEY);
      toast({ tone: r.failed ? "warning" : "success", title: { checkin: "Guest checked in", checkout: "Guest checked out", housekeeping: "Housekeeping started", clean: "Room marked clean", maintenance: "Maintenance updated" }[action] ?? "Done", body: r.failed ? `${r.failed} device(s) didn't respond: ${r.results.filter((x) => !x.ok).map((x) => x.device).join(", ")}` : r.results.length ? `${r.results.length} device actions confirmed.` : undefined });
      onDone();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't update room", body: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface-2 p-4">
        <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
        {room.hotel?.guestName && <div className="mt-2 text-[15px] font-semibold">{room.hotel.guestName}</div>}
        {room.hotel?.checkInAt && <div className="text-[12px] text-faint">Checked in {relTime(room.hotel.checkInAt)}</div>}
      </div>

      {!canOperate && <p className="text-[13px] text-muted">Your role can view rooms but not operate them.</p>}

      {canOperate && status === "vacant" && (
        <div className="space-y-3">
          <h3 className="text-[14px] font-semibold">Check in</h3>
          <Field label="Guest name">{(id) => <Input id={id} value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Full name" />}</Field>
          <Field label="Welcome temperature (°C)">{(id) => <Input id={id} type="number" min={18} max={28} value={temp} onChange={(e) => setTemp(Number(e.target.value))} />}</Field>
          <p className="text-[12px] text-faint">Runs Guest Welcome: warm lights at 70%, curtains open to 60%, AC to {temp}°C.</p>
          <Button variant="primary" className="w-full" icon={<LogIn className="size-4" />} loading={busy === "checkin"} disabled={guest.trim().length < 2} onClick={() => act("checkin", { guestName: guest, welcomeTemp: temp })}>
            Check in & welcome
          </Button>
        </div>
      )}
      {canOperate && status === "occupied" && (
        <Button
          variant="primary"
          className="w-full"
          icon={<LogOut className="size-4" />}
          loading={busy === "checkout"}
          onClick={async () => {
            if (await confirm({ title: `Check out ${room.hotel?.guestName ?? "guest"}?`, body: "Non-essential loads switch off, curtains close and housekeeping is notified. Locks, minibar and safety systems stay on.", confirmLabel: "Check out" })) void act("checkout");
          }}
        >
          Check out
        </Button>
      )}
      {canOperate && (status === "checkout" || status === "vacant") && (
        <Button variant="secondary" className="w-full" icon={<BrushCleaning className="size-4" />} loading={busy === "housekeeping"} onClick={() => act("housekeeping")}>
          Start housekeeping mode
        </Button>
      )}
      {canOperate && (status === "cleaning" || status === "checkout") && (
        <Button variant="secondary" className="w-full" icon={<Sparkles className="size-4" />} loading={busy === "clean"} onClick={() => act("clean")}>
          Mark clean & ready
        </Button>
      )}
      {canOperate && status !== "occupied" && (
        <Button variant={status === "maintenance" ? "secondary" : "danger"} className="w-full" icon={<Wrench className="size-4" />} loading={busy === "maintenance"} onClick={() => act("maintenance", { on: status !== "maintenance" })}>
          {status === "maintenance" ? "End maintenance" : "Put under maintenance"}
        </Button>
      )}

      <div>
        <h3 className="mb-2 text-[14px] font-semibold">Room devices</h3>
        <ul className="divide-y divide-[var(--line)] rounded-2xl border border-line">
          {devs.map((d) => (
            <li key={d.id}>
              <Link href={`/devices/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] hover:bg-surface-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cx("size-2 shrink-0 rounded-full", !d.online ? "bg-err" : d.state.on || d.state.locked === false ? "bg-mint" : "bg-idle")} />
                  <span className="truncate">{d.name}</span>
                  {d.essential && <ShieldCheck className="size-3.5 shrink-0 text-warn" aria-label="Protected essential load" />}
                </span>
                <span className="shrink-0 text-[12px] text-faint">{d.online ? "Online" : "Offline"}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href={`/rooms/${room.id}`} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-mint">
          <DoorOpen className="size-4" /> Open room controls (manual override)
        </Link>
      </div>
    </div>
  );
}
