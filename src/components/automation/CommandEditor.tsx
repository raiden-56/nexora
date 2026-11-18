"use client";
import { has } from "@/lib/devices";
import type { Device, DeviceCommand, HvacMode } from "@/lib/types";
import { Input, Select } from "../ui/controls";

/** Edits a partial device command, exposing only fields the device's capabilities allow. */
export function CommandEditor({ device, value, onChange }: { device: Device | undefined; value: DeviceCommand; onChange: (c: DeviceCommand) => void }) {
  if (!device) return null;
  const set = (k: keyof DeviceCommand, v: unknown) => {
    const next = { ...value } as Record<string, unknown>;
    if (v === "" || v === undefined || Number.isNaN(v)) delete next[k];
    else next[k] = v;
    onChange(next as DeviceCommand);
  };
  const cell = "space-y-1";
  const lbl = "block text-[11.5px] font-medium text-faint";
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {has(device, "onoff") && (
        <label className={cell}>
          <span className={lbl}>Power</span>
          <Select className="h-9" value={value.on === undefined ? "" : value.on ? "on" : "off"} onChange={(e) => set("on", e.target.value === "" ? undefined : e.target.value === "on")}>
            <option value="">No change</option>
            <option value="on">Turn on</option>
            <option value="off">Turn off</option>
          </Select>
        </label>
      )}
      {has(device, "brightness") && (
        <label className={cell}>
          <span className={lbl}>Brightness %</span>
          <Input className="h-9" type="number" min={1} max={100} placeholder="—" value={value.brightness ?? ""} onChange={(e) => set("brightness", e.target.value === "" ? undefined : Math.min(100, Math.max(1, Number(e.target.value))))} />
        </label>
      )}
      {has(device, "color_temp") && (
        <label className={cell}>
          <span className={lbl}>Colour temp (K)</span>
          <Select className="h-9" value={value.colorTemp ?? ""} onChange={(e) => set("colorTemp", e.target.value === "" ? undefined : Number(e.target.value))}>
            <option value="">No change</option>
            {[2700, 3000, 3500, 4000, 4500, 5000, 6500].map((k) => (
              <option key={k} value={k}>{k}K</option>
            ))}
          </Select>
        </label>
      )}
      {has(device, "color") && (
        <label className={cell}>
          <span className={lbl}>Colour</span>
          <div className="flex h-9 items-center gap-2">
            <input type="color" aria-label="Colour" value={value.color ?? "#69e3c0"} onChange={(e) => set("color", e.target.value)} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface-2" />
            {value.color && <button type="button" className="text-[11.5px] text-faint hover:text-text" onClick={() => set("color", undefined)}>Clear</button>}
          </div>
        </label>
      )}
      {has(device, "fan_speed") && (
        <label className={cell}>
          <span className={lbl}>Speed</span>
          <Select className="h-9" value={value.speed ?? ""} onChange={(e) => set("speed", e.target.value === "" ? undefined : Number(e.target.value))}>
            <option value="">No change</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>Speed {n}</option>
            ))}
          </Select>
        </label>
      )}
      {has(device, "target_temp") && (
        <label className={cell}>
          <span className={lbl}>Temperature °C</span>
          <Input className="h-9" type="number" min={16} max={30} step={0.5} placeholder="—" value={value.targetTemp ?? ""} onChange={(e) => set("targetTemp", e.target.value === "" ? undefined : Math.round(Math.min(30, Math.max(16, Number(e.target.value))) * 2) / 2)} />
        </label>
      )}
      {has(device, "hvac_mode") && (
        <label className={cell}>
          <span className={lbl}>Mode</span>
          <Select className="h-9" value={value.mode ?? ""} onChange={(e) => set("mode", (e.target.value || undefined) as HvacMode | undefined)}>
            <option value="">No change</option>
            {["cool", "heat", "dry", "fan", "auto"].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </label>
      )}
      {has(device, "position") && (
        <label className={cell}>
          <span className={lbl}>Position</span>
          <Select className="h-9" value={value.position ?? ""} onChange={(e) => set("position", e.target.value === "" ? undefined : Number(e.target.value))}>
            <option value="">No change</option>
            <option value={100}>Open</option>
            <option value={50}>Half</option>
            <option value={0}>Close</option>
          </Select>
        </label>
      )}
      {has(device, "lock") && (
        <label className={cell}>
          <span className={lbl}>Lock</span>
          <Select className="h-9" value={value.locked === undefined ? "" : value.locked ? "lock" : "unlock"} onChange={(e) => set("locked", e.target.value === "" ? undefined : e.target.value === "lock")}>
            <option value="">No change</option>
            <option value="lock">Lock</option>
            <option value="unlock">Unlock</option>
          </Select>
        </label>
      )}
    </div>
  );
}
