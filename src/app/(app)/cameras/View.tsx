"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, ArrowRight, Camera, Cctv, ChevronLeft, ChevronRight, Expand, Pause, Pencil, Play, Plus, Radar, Settings2, Trash2, Video, WifiOff } from "lucide-react";
import { CameraFeed, type CameraFeedHandle } from "@/components/cctv/CameraFeed";
import { CameraTile, downloadSnapshot, EmptySlot, lightsOnIn, NoStream } from "@/components/cctv/CameraTile";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Segmented, Select, Switch } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { Badge, Card, DemoBadge, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { useBootstrap, useDeviceCommand } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import { cx, relTime } from "@/lib/format";
import { appHref } from "@/lib/routes";
import type { CameraLayout, CameraView, Device } from "@/lib/types";

const VIEWS_KEY = "/api/camera-views";
const LAYOUTS: CameraLayout[] = [1, 4, 9, 16];
const GRID: Record<CameraLayout, string> = {
  1: "grid-cols-1",
  4: "grid-cols-1 sm:grid-cols-2",
  9: "grid-cols-2 sm:grid-cols-3",
  16: "grid-cols-2 sm:grid-cols-4",
};
const fitLayout = (n: number): CameraLayout => (n <= 1 ? 1 : n <= 4 ? 4 : n <= 9 ? 9 : 16);

/** A wall the user can switch to: built-in (all cameras, one per floor) or saved by the team. */
interface WallView {
  key: string;
  name: string;
  layout: CameraLayout;
  cameraIds: string[];
  saved?: CameraView;
}

function readPref(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export default function CamerasView() {
  const { data, property, can, roomById, floorById, devicesByRoom } = useBootstrap();
  const allowed = can("cameras.view");
  const views = useSWR<{ views: CameraView[] }>(data && allowed ? VIEWS_KEY : null, fetcher);
  const search = useSearchParams();
  const toast = useToast();

  const cameras = useMemo(() => (data?.devices ?? []).filter((d) => d.type === "camera"), [data]);
  const camById = useMemo(() => new Map(cameras.map((c) => [c.id, c])), [cameras]);

  const walls = useMemo<WallView[]>(() => {
    if (!data) return [];
    const floorOrder = (c: Device) => floorById.get(roomById.get(c.roomId)?.floorId ?? "")?.order ?? 99;
    const sorted = [...cameras].sort((a, b) => floorOrder(a) - floorOrder(b));
    const out: WallView[] = [{ key: "all", name: "All cameras", layout: fitLayout(sorted.length), cameraIds: sorted.map((c) => c.id) }];
    for (const f of data.floors) {
      const ids = sorted.filter((c) => roomById.get(c.roomId)?.floorId === f.id).map((c) => c.id);
      if (ids.length && ids.length < sorted.length) out.push({ key: `floor:${f.id}`, name: f.name, layout: fitLayout(ids.length), cameraIds: ids });
    }
    for (const v of views.data?.views ?? []) out.push({ key: v.id, name: v.name, layout: v.layout, cameraIds: v.cameraIds, saved: v });
    return out;
  }, [data, cameras, views.data, roomById, floorById]);

  const prefKey = `nx-cctv-view:${data?.propertyId ?? ""}`;
  const [viewKey, setViewKey] = useState<string | null>(null);
  const [layoutOverride, setLayoutOverride] = useState<Record<string, CameraLayout>>({});
  const [page, setPage] = useState(0);
  const [tour, setTour] = useState(0); // seconds per page, 0 = off
  const [focusId, setFocusId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CameraView | "new" | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);

  // Restore the last view this viewer used on this property, or open a camera from ?camera=.
  useEffect(() => {
    if (!data) return;
    setViewKey((k) => k ?? readPref(prefKey) ?? "all");
    const cam = search.get("camera");
    if (cam) setFocusId(cam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.propertyId]);

  const wall = walls.find((w) => w.key === viewKey) ?? walls[0];
  const layout = (wall && layoutOverride[wall.key]) ?? wall?.layout ?? 4;
  const ids = (wall?.cameraIds ?? []).filter((x) => camById.has(x));
  const pages = Math.max(1, Math.ceil(ids.length / layout));
  const pageIds = ids.slice(page * layout, page * layout + layout);
  const slots: (string | null)[] = [...pageIds, ...Array(Math.max(0, layout - pageIds.length)).fill(null)];

  const selectView = useCallback(
    (key: string) => {
      setViewKey(key);
      setPage(0);
      writePref(prefKey, key);
    },
    [prefKey],
  );

  useEffect(() => {
    if (page >= pages) setPage(0);
  }, [page, pages]);

  // Tour: step through pages, then on to the next view.
  useEffect(() => {
    if (!tour || focusId || !wall) return;
    const t = setInterval(() => {
      if (page < pages - 1) setPage(page + 1);
      else {
        const i = walls.findIndex((w) => w.key === wall.key);
        const next = walls[(i + 1) % walls.length];
        setViewKey(next.key);
        setPage(0);
      }
    }, tour * 1000);
    return () => clearInterval(t);
  }, [tour, focusId, wall, page, pages, walls]);

  // Keyboard: 1–9 switch views, ←/→ switch pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (focusId || editing || el.closest("input,textarea,select,[contenteditable]")) return;
      if (/^[1-9]$/.test(e.key) && walls[Number(e.key) - 1]) selectView(walls[Number(e.key) - 1].key);
      else if (e.key === "ArrowRight" && pages > 1) setPage((p) => (p + 1) % pages);
      else if (e.key === "ArrowLeft" && pages > 1) setPage((p) => (p - 1 + pages) % pages);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [walls, pages, focusId, editing, selectView]);

  useEffect(() => {
    const on = () => setIsFull(document.fullscreenElement === wallRef.current && !!wallRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  if (!data || !property) return <Skeleton className="h-96" />;
  if (!allowed)
    return (
      <>
        <PageHeader eyebrow="Security" title="CCTV" />
        <EmptyState icon={<Cctv className="size-6" />} title="CCTV isn't available for your role" body="Ask an owner or manager for access to camera feeds." />
      </>
    );

  const manage = can("devices.control");
  const recording = cameras.filter((c) => c.online && c.state.recording && !c.state.privacy).length;
  const motionNow = cameras.filter((c) => c.online && c.state.motion && !c.state.privacy).length;
  const offline = cameras.filter((c) => !c.online).length;
  const timezone = property.timezone;
  const focused = focusId ? camById.get(focusId) : undefined;

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wallRef.current?.requestFullscreen();
    } catch {
      toast({ tone: "warning", title: "Full screen isn't available here" });
    }
  };

  if (!cameras.length)
    return (
      <>
        <PageHeader eyebrow="Security" title="CCTV" description={`Live camera views for ${property.name}.`} />
        <EmptyState
          icon={<Cctv className="size-6" />}
          title="No cameras yet"
          body="Pair a camera from Devices and it will appear here. Cameras from the Nexora Simulator show a simulated picture."
          action={
            can("integrations.manage") ? (
              <Link href="/devices/pair">
                <Button variant="primary" icon={<Plus className="size-4" />}>
                  Pair a camera
                </Button>
              </Link>
            ) : undefined
          }
        />
      </>
    );

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="CCTV"
        description={
          <>
            {cameras.length} cameras at {property.name} · {recording} recording
            {motionNow > 0 && <span className="text-warn"> · motion on {motionNow}</span>}
            {offline > 0 && <span className="text-err"> · {offline} offline</span>}
          </>
        }
        actions={
          <>
            {cameras.some((c) => c.provider === "simulated") && <DemoBadge label="Simulated feeds" />}
            {manage && (
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>
                New view
              </Button>
            )}
          </>
        }
      />

      {focused ? (
        <FocusMode
          camera={focused}
          list={ids.length ? ids.map((x) => camById.get(x)!).filter(Boolean) : cameras}
          onSelect={setFocusId}
          onClose={() => setFocusId(null)}
          timezone={timezone}
          canControl={manage}
        />
      ) : (
        <>
          {/* View switcher */}
          <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div role="tablist" aria-label="Camera views" className="flex w-max gap-1.5">
              {walls.map((w, i) => {
                const active = w.key === wall?.key;
                return (
                  <button
                    key={w.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectView(w.key)}
                    className={cx(
                      "focus-ring inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                      active ? "border-[var(--mint)] bg-[color-mix(in_srgb,var(--mint)_14%,transparent)] text-text" : "border-line bg-surface-2 text-muted hover:text-text",
                    )}
                    title={i < 9 ? `Press ${i + 1}` : undefined}
                  >
                    {w.saved ? <Video className="size-3.5" /> : <Cctv className="size-3.5" />}
                    {w.name}
                    <span className="num text-[11px] text-faint">{w.cameraIds.filter((x) => camById.has(x)).length}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              label="Grid layout"
              value={layout}
              onChange={(v) => {
                if (!wall) return;
                setLayoutOverride((o) => ({ ...o, [wall.key]: v }));
                setPage(0);
              }}
              options={LAYOUTS.map((l) => ({ value: l, label: l === 1 ? "1" : `${Math.sqrt(l)}×${Math.sqrt(l)}` }))}
            />
            {pages > 1 && (
              <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2 p-1">
                <IconButton label="Previous page" className="size-7" onClick={() => setPage((p) => (p - 1 + pages) % pages)}>
                  <ChevronLeft className="size-4" />
                </IconButton>
                <span className="num px-1 text-xs text-muted">
                  {page + 1} / {pages}
                </span>
                <IconButton label="Next page" className="size-7" onClick={() => setPage((p) => (p + 1) % pages)}>
                  <ChevronRight className="size-4" />
                </IconButton>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant={tour ? "primary" : "secondary"} icon={tour ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} onClick={() => setTour(tour ? 0 : 10)}>
                {tour ? "Stop tour" : "Tour"}
              </Button>
              {tour > 0 && (
                <Select aria-label="Tour interval" className="h-8 w-[84px] text-xs" value={tour} onChange={(e) => setTour(Number(e.target.value))}>
                  {[5, 10, 20, 30].map((s) => (
                    <option key={s} value={s}>
                      every {s}s
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {wall?.saved && manage && (
                <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(wall.saved!)}>
                  Edit view
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<Expand className="size-3.5" />} onClick={toggleFull}>
                Full screen
              </Button>
            </div>
          </div>

          {/* Wall */}
          <div ref={wallRef} className={cx(isFull && "flex flex-col justify-center bg-black p-3")}>
            {isFull && (
              <div className="mb-2 flex items-center justify-between text-[13px] text-white/80">
                <span className="font-semibold">
                  {property.name} · {wall?.name}
                  {pages > 1 && ` · ${page + 1}/${pages}`}
                </span>
                <span className="flex gap-2">
                  {pages > 1 && (
                    <button className="focus-ring rounded-lg bg-white/10 px-2 py-1" onClick={() => setPage((p) => (p + 1) % pages)}>
                      Next page
                    </button>
                  )}
                  <button className="focus-ring rounded-lg bg-white/10 px-2 py-1" onClick={toggleFull}>
                    Exit full screen
                  </button>
                </span>
              </div>
            )}
            <div className={cx("grid gap-2", GRID[layout], isFull && layout === 1 && "mx-auto w-full max-w-[min(100%,calc((100dvh-4rem)*16/9))]")}>
              {slots.map((cid, i) => {
                const cam = cid ? camById.get(cid) : undefined;
                if (!cam)
                  return (
                    <EmptySlot key={`empty-${i}`}>
                      {wall?.saved && manage && !isFull ? (
                        <button className="focus-ring rounded text-mint underline-offset-2 hover:underline" onClick={() => setEditing(wall.saved!)}>
                          Add a camera
                        </button>
                      ) : undefined}
                    </EmptySlot>
                  );
                const room = roomById.get(cam.roomId);
                return <CameraTile key={cam.id} device={cam} room={room} lightsOn={lightsOnIn(devicesByRoom.get(cam.roomId))} timezone={timezone} onOpen={() => setFocusId(cam.id)} compact={layout === 16} />;
              })}
            </div>
          </div>
          <p className="mt-3 hidden text-[12px] text-faint sm:block">
            Tip: press <kbd className="rounded border border-line px-1">1</kbd>–<kbd className="rounded border border-line px-1">9</kbd> to switch views and <kbd className="rounded border border-line px-1">←</kbd> <kbd className="rounded border border-line px-1">→</kbd> to change pages. Click a camera to open it.
          </p>
        </>
      )}

      <ViewEditor
        open={editing !== null}
        view={editing === "new" ? null : editing}
        cameras={cameras}
        roomName={(c) => roomById.get(c.roomId)?.name ?? "Unassigned"}
        onClose={() => setEditing(null)}
        onSaved={async (v) => {
          await views.mutate();
          setEditing(null);
          if (v) selectView(v.id);
          else selectView("all");
        }}
      />
    </>
  );
}

function FocusMode({ camera, list, onSelect, onClose, timezone, canControl }: { camera: Device; list: Device[]; onSelect: (id: string) => void; onClose: () => void; timezone: string; canControl: boolean }) {
  const { roomById, floorById, devicesByRoom } = useBootstrap();
  const send = useDeviceCommand();
  const confirm = useConfirm();
  const toast = useToast();
  const feed = useRef<CameraFeedHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const room = roomById.get(camera.roomId);
  const floor = room ? floorById.get(room.floorId) : undefined;
  const idx = Math.max(0, list.findIndex((c) => c.id === camera.id));
  const step = useCallback((d: number) => list.length && onSelect(list[(idx + d + list.length) % list.length].id), [list, idx, onSelect]);
  const s = camera.state;
  const disabled = !canControl || !camera.online;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select,[role=dialog]")) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  const setRecording = async (v: boolean) => {
    if (!v && !(await confirm({ title: `Stop recording on ${camera.name}?`, body: "Nothing from this camera is saved until recording is turned back on. Automations can't turn it back off later — only a person can.", confirmLabel: "Stop recording", danger: true }))) return;
    send(camera, { recording: v });
  };
  const setPrivacy = async (v: boolean) => {
    if (v && !(await confirm({ title: `Turn on privacy mode for ${camera.name}?`, body: "The picture is paused and nothing is recorded until privacy mode is turned off.", confirmLabel: "Turn on privacy mode", danger: true }))) return;
    send(camera, { privacy: v });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onClose}>
            Back to wall
          </Button>
          <span className="ml-auto flex gap-1">
            <IconButton label="Previous camera" onClick={() => step(-1)}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton label="Next camera" onClick={() => step(1)}>
              <ChevronRight className="size-4" />
            </IconButton>
          </span>
        </div>
        <div ref={box} className={cx("relative aspect-video overflow-hidden rounded-2xl border bg-black", s.motion && camera.online && !s.privacy ? "border-[var(--warn)]" : "border-line")}>
          <CameraFeed ref={feed} device={camera} room={room} lightsOn={lightsOnIn(devicesByRoom.get(camera.roomId))} timezone={timezone} hd className="absolute inset-0 size-full" />
          {camera.provider !== "simulated" && <NoStream device={camera} />}
        </div>
        {list.length > 1 && (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex w-max gap-2">
              {list.map((c) => (
                <div key={c.id} className="w-36 shrink-0 sm:w-44">
                  <CameraTile device={c} room={roomById.get(c.roomId)} lightsOn={lightsOnIn(devicesByRoom.get(c.roomId))} timezone={timezone} onOpen={() => onSelect(c.id)} active={c.id === camera.id} compact />
                  <div className={cx("mt-1 truncate text-[12px]", c.id === camera.id ? "font-semibold text-text" : "text-muted")}>{c.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Card className="h-fit space-y-5 p-5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[17px] font-semibold">{camera.name}</h2>
            {camera.provider === "simulated" && <DemoBadge label="SIM" />}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {room?.name ?? "Unassigned"}
            {floor && ` · ${floor.name}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {!camera.online ? (
              <Badge tone="err" dot>
                Offline · seen {relTime(camera.lastSeenAt)}
              </Badge>
            ) : s.privacy ? (
              <Badge tone="idle" dot>
                Privacy mode
              </Badge>
            ) : (
              <>
                <Badge tone={s.recording ? "err" : "idle"} dot>
                  {s.recording ? "Recording" : "Not recording"}
                </Badge>
                {s.motion && (
                  <Badge tone="warn" dot>
                    Motion
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">Recording</div>
              <div className="text-[12px] text-muted">Save footage from this camera</div>
            </div>
            <Switch label="Recording" checked={!!s.recording} disabled={disabled || !!s.privacy} onChange={setRecording} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-medium">Privacy mode</div>
              <div className="text-[12px] text-muted">Pause the picture entirely</div>
            </div>
            <Switch label="Privacy mode" checked={!!s.privacy} disabled={disabled} onChange={setPrivacy} />
          </div>
          {!canControl && <p className="text-[12px] text-faint">Your role can watch but not change cameras.</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            icon={<Camera className="size-4" />}
            disabled={camera.provider !== "simulated" || !camera.online || !!s.privacy}
            onClick={() => downloadSnapshot(feed.current, camera) || toast({ tone: "info", title: "No picture to save" })}
          >
            Snapshot
          </Button>
          <Button
            size="sm"
            icon={<Expand className="size-4" />}
            onClick={() => box.current?.requestFullscreen().catch(() => toast({ tone: "warning", title: "Full screen isn't available here" }))}
          >
            Full screen
          </Button>
          <Link href={appHref(`/devices/${camera.id}`)} className="col-span-2">
            <Button size="sm" variant="outline" className="w-full" icon={<Settings2 className="size-4" />}>
              Camera details
            </Button>
          </Link>
        </div>

        <dl className="space-y-1.5 border-t border-line pt-4 text-[12.5px]">
          {[
            ["Model", camera.model],
            ["Manufacturer", camera.manufacturer],
            ["Firmware", camera.firmware],
            ["Last seen", relTime(camera.lastSeenAt)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-faint">{k}</dt>
              <dd className="truncate text-right text-text-2">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-start gap-1.5 text-[12px] text-faint">
          {camera.online ? <Radar className="mt-0.5 size-3.5 shrink-0" /> : <WifiOff className="mt-0.5 size-3.5 shrink-0" />}
          {camera.provider === "simulated"
            ? "Simulated camera: the picture is generated from the room's state, and motion comes from the simulator."
            : "Live video from this integration isn't available yet."}
        </p>
        <p className="hidden text-[12px] text-faint sm:block">
          <ArrowLeft className="inline size-3" /> <ArrowRight className="inline size-3" /> switch camera · Esc back to the wall
        </p>
      </Card>
    </div>
  );
}

function ViewEditor({ open, view, cameras, roomName, onClose, onSaved }: { open: boolean; view: CameraView | null; cameras: Device[]; roomName: (c: Device) => string; onClose: () => void; onSaved: (v: CameraView | null) => Promise<void> }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [layout, setLayout] = useState<CameraLayout>(4);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(view?.name ?? "");
    setLayout(view?.layout ?? 4);
    setPicked(view?.cameraIds ?? []);
  }, [open, view]);

  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? (p.length >= 16 ? p : [...p, id]) : p.filter((x) => x !== id)));
  const move = (id: string, d: number) =>
    setPicked((p) => {
      const i = p.indexOf(id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: name.trim(), layout, cameraIds: picked };
      const v = view ? await api<CameraView>(`/api/camera-views/${view.id}`, { method: "PATCH", body }) : await api<CameraView>(VIEWS_KEY, { body });
      toast({ tone: "success", title: view ? `${v.name} updated` : `${v.name} created` });
      await onSaved(v);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save the view", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!view || !(await confirm({ title: `Delete ${view.name}?`, body: "The view is removed for everyone at this property. Cameras and recordings aren't affected.", confirmLabel: "Delete view", danger: true }))) return;
    try {
      await api(`/api/camera-views/${view.id}`, { method: "DELETE" });
      toast({ tone: "success", title: `${view.name} deleted` });
      await onSaved(null);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't delete the view", body: (e as Error).message });
    }
  };

  const ordered = [...picked.map((id) => cameras.find((c) => c.id === id)).filter((c): c is Device => !!c), ...cameras.filter((c) => !picked.includes(c.id))];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={view ? "Edit camera view" : "New camera view"}
      description="Views are shared with everyone at this property who can watch CCTV."
      footer={
        <div className="flex w-full items-center gap-2">
          {view && (
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={remove}>
              Delete
            </Button>
          )}
          <span className="ml-auto" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!name.trim() || !picked.length} onClick={save}>
            {view ? "Save view" : "Create view"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Name">{(id) => <Input id={id} value={name} maxLength={40} placeholder="e.g. Entrances" onChange={(e) => setName(e.target.value)} />}</Field>
        <div className="space-y-2">
          <div className="text-[13px] font-medium text-text-2">Grid</div>
          <Segmented value={layout} onChange={setLayout} label="Grid layout" options={LAYOUTS.map((l) => ({ value: l, label: l === 1 ? "Single" : `${Math.sqrt(l)}×${Math.sqrt(l)}` }))} />
          {picked.length > layout && <p className="text-[12px] text-muted">{picked.length} cameras on a {layout}-slot grid: the view will have {Math.ceil(picked.length / layout)} pages.</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-text-2">Cameras, in slot order</span>
            <span className="num text-faint">{picked.length} / 16</span>
          </div>
          <ul className="max-h-[42vh] space-y-1 overflow-y-auto rounded-xl border border-line p-1.5">
            {ordered.map((c) => {
              const i = picked.indexOf(c.id);
              return (
                <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <Checkbox label={`Include ${c.name}`} checked={i >= 0} onChange={(v) => toggle(c.id, v)} />
                  <span className={cx("num w-5 text-center text-[12px]", i >= 0 ? "text-mint" : "text-faint")}>{i >= 0 ? i + 1 : "–"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{c.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {roomName(c)}
                      {!c.online && " · offline"}
                    </span>
                  </span>
                  {i >= 0 && (
                    <span className="flex">
                      <IconButton label={`Move ${c.name} up`} className="size-7" disabled={i === 0} onClick={() => move(c.id, -1)}>
                        <ChevronLeft className="size-3.5 rotate-90" />
                      </IconButton>
                      <IconButton label={`Move ${c.name} down`} className="size-7" disabled={i === picked.length - 1} onClick={() => move(c.id, 1)}>
                        <ChevronRight className="size-3.5 rotate-90" />
                      </IconButton>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
