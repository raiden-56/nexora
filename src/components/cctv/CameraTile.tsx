"use client";
import { useRef } from "react";
import Link from "next/link";
import { Camera, Cctv, Maximize2, VideoOff } from "lucide-react";
import { Switch } from "@/components/ui/controls";
import { useConfirm } from "@/components/ui/feedback";
import { useBootstrap, useDeviceCommand } from "@/hooks/useNexora";
import { PROVIDER_LABEL } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Device, Room } from "@/lib/types";
import { CameraFeed, type CameraFeedHandle } from "./CameraFeed";

/** Saves the current frame of a feed as a PNG, named after the camera and time. */
export function downloadSnapshot(handle: CameraFeedHandle | null, device: Device) {
  const url = handle?.snapshot();
  if (!url) return false;
  const a = document.createElement("a");
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `${device.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ts}.png`;
  a.click();
  return true;
}

export function lightsOnIn(devices: Device[] | undefined) {
  return !!devices?.some((d) => d.online && d.state.on && (d.type === "bulb" || d.type === "led_strip" || d.type === "switch"));
}

/** Shown instead of a picture for cameras whose integration doesn't stream video into Nexora. */
export function NoStream({ device, compact }: { device: Device; compact?: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#0b1118] p-3 text-center text-white/80">
      <VideoOff className={compact ? "size-5" : "size-7"} />
      <div className={cx("font-semibold", compact ? "text-[12px]" : "text-sm")}>No video stream</div>
      {!compact && <div className="max-w-xs text-[12px] text-white/55">{PROVIDER_LABEL[device.provider] ?? device.provider} cameras don&apos;t stream video into Nexora yet. Status and recording controls still work.</div>}
    </div>
  );
}

export function CameraTile({
  device,
  room,
  lightsOn,
  timezone,
  onOpen,
  active,
  compact,
}: {
  device: Device;
  room: Room | undefined;
  lightsOn: boolean;
  timezone: string;
  onOpen: () => void;
  active?: boolean;
  compact?: boolean;
}) {
  const feed = useRef<CameraFeedHandle>(null);
  const motion = device.online && !device.state.privacy && !!device.state.motion;
  return (
    <div
      className={cx(
        "group relative aspect-video overflow-hidden rounded-xl border bg-black transition-colors",
        motion ? "border-[var(--warn)] ring-1 ring-[var(--warn)]" : active ? "border-[var(--mint)] ring-1 ring-[var(--mint)]" : "border-line",
      )}
    >
      <button type="button" onClick={onOpen} className="focus-ring absolute inset-0 z-[1] rounded-xl" aria-label={`Open ${device.name}`} />
      <CameraFeed ref={feed} device={device} room={room} lightsOn={lightsOn} timezone={timezone} className="absolute inset-0 size-full" />
      {device.provider !== "simulated" && <NoStream device={device} compact={compact} />}
      {motion && (
        <span className="pointer-events-none absolute left-1/2 top-2 z-[2] -translate-x-1/2 rounded-md bg-[var(--warn)] px-1.5 py-0.5 text-[10.5px] font-bold tracking-wide text-black uppercase">Motion</span>
      )}
      {!compact && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="min-w-0 truncate text-[12px] font-medium text-white/85">{room?.name ?? "Unassigned"}</span>
          <span className="pointer-events-auto flex gap-1">
            <button
              type="button"
              onClick={() => downloadSnapshot(feed.current, device)}
              disabled={device.provider !== "simulated" || !device.online || !!device.state.privacy}
              className="focus-ring flex size-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur hover:bg-white/25 disabled:opacity-40"
              aria-label={`Snapshot of ${device.name}`}
              title="Save snapshot"
            >
              <Camera className="size-3.5" />
            </button>
            <button type="button" onClick={onOpen} className="focus-ring flex size-7 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur hover:bg-white/25" aria-label={`Expand ${device.name}`} title="Expand">
              <Maximize2 className="size-3.5" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

export function EmptySlot({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong bg-surface-2/50 text-[12px] text-faint">
      <VideoOff className="size-4" />
      {children ?? "Empty slot"}
    </div>
  );
}

/** Live preview + recording controls on a camera's device page. */
export function CameraPanel({ device, canControl }: { device: Device; canControl: boolean }) {
  const { property, roomById, devicesByRoom } = useBootstrap();
  const send = useDeviceCommand();
  const confirm = useConfirm();
  const s = device.state;
  const disabled = !canControl || !device.online;
  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black">
        <CameraFeed device={device} room={roomById.get(device.roomId)} lightsOn={lightsOnIn(devicesByRoom.get(device.roomId))} timezone={property?.timezone ?? "UTC"} className="absolute inset-0 size-full" />
        {device.provider !== "simulated" && <NoStream device={device} />}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <span className="text-[13px] font-medium">Recording</span>
          <Switch
            label="Recording"
            checked={!!s.recording}
            disabled={disabled || !!s.privacy}
            onChange={async (v) => {
              if (!v && !(await confirm({ title: `Stop recording on ${device.name}?`, body: "Nothing from this camera is saved until recording is turned back on.", confirmLabel: "Stop recording", danger: true }))) return;
              send(device, { recording: v });
            }}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-4">
          <span className="text-[13px] font-medium">Privacy mode</span>
          <Switch
            label="Privacy mode"
            checked={!!s.privacy}
            disabled={disabled}
            onChange={async (v) => {
              if (v && !(await confirm({ title: `Turn on privacy mode for ${device.name}?`, body: "The picture is paused and nothing is recorded until privacy mode is turned off.", confirmLabel: "Turn on privacy mode", danger: true }))) return;
              send(device, { privacy: v });
            }}
          />
        </label>
      </div>
      <Link href={`/cameras?camera=${encodeURIComponent(device.id)}`} className="focus-ring inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-mint hover:underline">
        <Cctv className="size-4" /> Open in CCTV view
      </Link>
    </div>
  );
}
