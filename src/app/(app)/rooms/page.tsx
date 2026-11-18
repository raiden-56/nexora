"use client";
import { appHref } from "@/lib/routes";
import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ArrowDown, ArrowUp, LayoutGrid, Layers, Map as MapIcon, MoreHorizontal, Pencil, Plus, Power, PowerOff, Trash2, Users } from "lucide-react";
import { FloorPlan, roomStats } from "@/components/property/FloorPlan";
import { ROOM_KIND_LABEL } from "@/components/property/PropertyWizard";
import { RoomArt } from "@/components/property/RoomArt";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Segmented, Select } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { MenuItem, Modal, Popover } from "@/components/ui/overlay";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import type { AutomationView } from "@/lib/apiTypes";
import { isSwitchable } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Floor, Room, RoomKind } from "@/lib/types";

export default function RoomsPage() {
  const { data, devicesByRoom, can, property } = useBootstrap();
  const { data: autos } = useSWR<{ automations: AutomationView[] }>("/api/automations", fetcher);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [view, setView] = useState<"rooms" | "plan">("rooms");
  const [floorModal, setFloorModal] = useState<{ floor?: Floor } | null>(null);
  const [roomModal, setRoomModal] = useState<{ room?: Room } | null>(null);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();

  if (!data || !property) return <Skeleton className="h-[600px]" />;
  const manage = can("properties.manage");
  const floor = data.floors.find((f) => f.id === floorId) ?? data.floors[0];
  const rooms = data.rooms.filter((r) => r.floorId === floor?.id).sort((a, b) => a.order - b.order);
  const refresh = () => mutate(BOOT_KEY);

  const call = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      await refresh();
      if (ok) toast({ tone: "success", title: ok });
    } catch (e) {
      toast({ tone: "error", title: "Action failed", body: (e as Error).message });
    }
  };

  const moveFloor = (f: Floor, dir: -1 | 1) => {
    const ids = data.floors.map((x) => x.id);
    const i = ids.indexOf(f.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void call(() => api("/api/floors/reorder", { body: { propertyId: property.id, ids } }));
  };
  const moveRoom = (r: Room, dir: -1 | 1) => {
    const ids = rooms.map((x) => x.id);
    const i = ids.indexOf(r.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void call(() => api("/api/rooms/reorder", { body: { floorId: floor.id, ids } }));
  };
  const roomPower = async (r: Room, on: boolean) => {
    const ids = (devicesByRoom.get(r.id) ?? []).filter((d) => isSwitchable(d) && d.online && (on || !d.essential)).map((d) => d.id);
    if (!ids.length) return toast({ tone: "info", title: "No switchable devices online in this room" });
    if (!on && !(await confirm({ title: `Turn off ${r.name}?`, body: `${ids.length} devices will be switched off. Essential loads are skipped.`, confirmLabel: "Turn off", danger: true }))) return;
    void call(() => api("/api/devices/bulk", { body: { deviceIds: ids, command: { on } } }), `${r.name}: ${ids.length} devices turned ${on ? "on" : "off"}`);
  };

  return (
    <div>
      <PageHeader
        eyebrow={property.name}
        title="Rooms & Floors"
        description="Organise the building the way people walk it. Rooms hold devices, occupancy and room-specific automations."
        actions={
          manage && (
            <>
              <Button variant="outline" icon={<Layers className="size-4" />} onClick={() => setFloorModal({})}>
                Add floor
              </Button>
              <Button variant="primary" icon={<Plus className="size-4" />} disabled={!floor} onClick={() => setRoomModal({})}>
                Add room
              </Button>
            </>
          )
        }
      />

      {data.floors.length === 0 ? (
        <EmptyState icon={<Layers className="size-5" />} title="No floors yet" body="Add a floor to start placing rooms and devices." action={manage && <Button variant="primary" onClick={() => setFloorModal({})}>Add floor</Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Floor list */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0 lg:flex-col lg:overflow-visible">
            {data.floors.map((f, i) => {
              const fr = data.rooms.filter((r) => r.floorId === f.id);
              const s = roomStats(fr.flatMap((r) => devicesByRoom.get(r.id) ?? []));
              const active = f.id === floor.id;
              return (
                <div key={f.id} className={cx("group flex shrink-0 items-center gap-2 rounded-2xl border p-3 transition lg:shrink", active ? "border-[var(--mint)] bg-[color-mix(in_srgb,var(--mint)_6%,var(--surface))]" : "border-line bg-surface hover:border-line-strong")}>
                  <button onClick={() => setFloorId(f.id)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[14px] font-semibold">{f.name}</div>
                    <div className="num text-[12px] text-faint">
                      {fr.length} rooms · {s.active}/{s.total} on{s.offline ? ` · ${s.offline} offline` : ""}
                    </div>
                  </button>
                  {manage && (
                    <Popover
                      trigger={({ toggle }) => (
                        <IconButton label={`${f.name} options`} onClick={toggle} className="size-8">
                          <MoreHorizontal className="size-4" />
                        </IconButton>
                      )}
                      className="w-48"
                    >
                      {(close) => (
                        <div className="py-1">
                          <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), setFloorModal({ floor: f }))}>Rename</MenuItem>
                          <MenuItem icon={<ArrowUp className="size-4" />} onClick={() => (close(), moveFloor(f, -1))}>Move up</MenuItem>
                          <MenuItem icon={<ArrowDown className="size-4" />} onClick={() => (close(), moveFloor(f, 1))}>Move down</MenuItem>
                          <MenuItem
                            danger
                            icon={<Trash2 className="size-4" />}
                            onClick={async () => {
                              close();
                              if (await confirm({ title: `Delete ${f.name}?`, body: "Its empty rooms are deleted too. Floors that still contain devices can't be deleted.", confirmLabel: "Delete floor", danger: true })) void call(() => api(`/api/floors/${f.id}`, { method: "DELETE" }), `${f.name} deleted`);
                            }}
                          >
                            Delete
                          </MenuItem>
                        </div>
                      )}
                    </Popover>
                  )}
                  <span className="sr-only">{i}</span>
                </div>
              );
            })}
          </div>

          {/* Rooms */}
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold">{floor.name}</h2>
              <Segmented label="View" size="sm" value={view} onChange={setView} options={[{ value: "rooms", label: <><LayoutGrid className="size-3.5" /> Rooms</> }, { value: "plan", label: <><MapIcon className="size-3.5" /> Floor plan</> }]} />
            </div>
            {view === "plan" ? (
              <Card className="p-4 sm:p-5">
                <FloorPlan rooms={rooms} devicesByRoom={devicesByRoom} />
                <p className="mt-3 text-[12px] text-faint">Dots are device markers; glowing markers are active. Tap a room to open its controls.</p>
              </Card>
            ) : rooms.length === 0 ? (
              <EmptyState icon={<Plus className="size-5" />} title="No rooms on this floor" body="Add the rooms on this floor to assign devices to them." action={manage && <Button variant="primary" onClick={() => setRoomModal({})}>Add room</Button>} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {rooms.map((r) => {
                  const devs = devicesByRoom.get(r.id) ?? [];
                  const s = roomStats(devs);
                  const roomAutos = (autos?.automations ?? []).filter((a) => a.actions.some((x) => x.type === "device" && devs.some((d) => d.id === x.deviceId)) || a.conditions.some((c) => c.type === "room_occupied" && c.roomId === r.id));
                  return (
                    <Card key={r.id} className="overflow-hidden">
                      <Link href={appHref(`/rooms/${r.id}`)} className="block">
                        <RoomArt kind={r.kind} lit={s.active > 0} className="h-28" />
                      </Link>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={appHref(`/rooms/${r.id}`)} className="min-w-0">
                            <div className="truncate text-[15px] font-semibold hover:underline">{r.name}</div>
                            <div className="text-[12px] text-faint">
                              {ROOM_KIND_LABEL[r.kind]}
                              {r.department ? ` · ${r.department}` : ""}
                            </div>
                          </Link>
                          <div className="flex items-center gap-1">
                            {r.occupied && <Users className="size-4 text-cyan" aria-label="Occupied" />}
                            {manage && (
                              <Popover
                                trigger={({ toggle }) => (
                                  <IconButton label={`${r.name} options`} onClick={toggle} className="size-8">
                                    <MoreHorizontal className="size-4" />
                                  </IconButton>
                                )}
                                className="w-48"
                              >
                                {(close) => (
                                  <div className="py-1">
                                    <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), setRoomModal({ room: r }))}>Edit</MenuItem>
                                    <MenuItem icon={<ArrowUp className="size-4" />} onClick={() => (close(), moveRoom(r, -1))}>Move earlier</MenuItem>
                                    <MenuItem icon={<ArrowDown className="size-4" />} onClick={() => (close(), moveRoom(r, 1))}>Move later</MenuItem>
                                    <MenuItem
                                      danger
                                      icon={<Trash2 className="size-4" />}
                                      onClick={async () => {
                                        close();
                                        if (await confirm({ title: `Delete ${r.name}?`, body: "Rooms with devices can't be deleted — move the devices first.", confirmLabel: "Delete room", danger: true })) void call(() => api(`/api/rooms/${r.id}`, { method: "DELETE" }), `${r.name} deleted`);
                                      }}
                                    >
                                      Delete
                                    </MenuItem>
                                  </div>
                                )}
                              </Popover>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          {[
                            ["Devices", s.total, "text-text"],
                            ["Active", s.active, "text-mint"],
                            ["Offline", s.offline, s.offline ? "text-err" : "text-faint"],
                          ].map(([l, v, c]) => (
                            <div key={l as string} className="rounded-xl bg-surface-2 py-2">
                              <div className={cx("num font-display text-[18px] font-bold", c as string)}>{v}</div>
                              <div className="text-[11px] text-faint">{l}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] text-faint">{roomAutos.length ? `${roomAutos.length} automation${roomAutos.length > 1 ? "s" : ""}` : "No automations"}</span>
                          {can("devices.control") && devs.length > 0 && (
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="secondary" icon={<Power className="size-3.5" />} onClick={() => roomPower(r, true)}>
                                On
                              </Button>
                              <Button size="sm" variant="secondary" icon={<PowerOff className="size-3.5" />} onClick={() => roomPower(r, false)}>
                                Off
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <FloorModal key={floorModal?.floor?.id ?? "new-floor"} state={floorModal} onClose={() => setFloorModal(null)} propertyId={property.id} onDone={refresh} />
      <RoomModal key={roomModal?.room?.id ?? `new-room-${floor?.id}`} state={roomModal} onClose={() => setRoomModal(null)} floors={data.floors} defaultFloorId={floor?.id} onDone={refresh} />
    </div>
  );
}

function FloorModal({ state, onClose, propertyId, onDone }: { state: { floor?: Floor } | null; onClose: () => void; propertyId: string; onDone: () => Promise<unknown> }) {
  const [name, setName] = useState(state?.floor?.name ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const save = async () => {
    setSaving(true);
    try {
      if (state?.floor) await api(`/api/floors/${state.floor.id}`, { method: "PATCH", body: { name } });
      else await api("/api/floors", { body: { propertyId, name } });
      await onDone();
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save floor", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={!!state} onClose={onClose} title={state?.floor ? "Rename floor" : "Add floor"} size="sm" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!name.trim()} onClick={save}>Save</Button></>}>
      <Field label="Floor name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Second Floor" onKeyDown={(e) => e.key === "Enter" && name.trim() && save()} />}</Field>
    </Modal>
  );
}

function RoomModal({ state, onClose, floors, defaultFloorId, onDone }: { state: { room?: Room } | null; onClose: () => void; floors: Floor[]; defaultFloorId?: string; onDone: () => Promise<unknown> }) {
  const r = state?.room;
  const [name, setName] = useState(r?.name ?? "");
  const [kind, setKind] = useState<RoomKind>(r?.kind ?? "living");
  const [floorId, setFloorId] = useState(r?.floorId ?? defaultFloorId ?? floors[0]?.id);
  const [department, setDepartment] = useState(r?.department ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const save = async () => {
    setSaving(true);
    try {
      const body = { name, kind, floorId, department: department || undefined };
      if (r) await api(`/api/rooms/${r.id}`, { method: "PATCH", body });
      else await api("/api/rooms", { body });
      await onDone();
      toast({ tone: "success", title: r ? "Room updated" : `${name} added` });
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save room", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={!!state} onClose={onClose} title={r ? "Edit room" : "Add room"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!name.trim()} onClick={save}>Save room</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room name" className="sm:col-span-2">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Home Office" />}</Field>
        <Field label="Room type">
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as RoomKind)}>
              {Object.entries(ROOM_KIND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Floor">
          {(id) => (
            <Select id={id} value={floorId} onChange={(e) => setFloorId(e.target.value)}>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Department (optional)" hint="Used for department-level energy reporting in offices" className="sm:col-span-2">{(id) => <Input id={id} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />}</Field>
      </div>
    </Modal>
  );
}
