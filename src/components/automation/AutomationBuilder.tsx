"use client";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Bell, Clock, Cpu, Filter, Hourglass, Play, Plus, Sparkles, Sunrise, Trash2, Zap } from "lucide-react";
import { DEVICE_CATALOG, describeCommand, has } from "@/lib/devices";
import { cx } from "@/lib/format";
import type { Action, Automation, Condition, Device, PropertyMode, Room, Scene, Trigger, UnreachablePolicy } from "@/lib/types";
import { Button, IconButton } from "../ui/button";
import { DayPicker, Field, Input, Select, Switch, Textarea } from "../ui/controls";
import { MenuItem, Popover } from "../ui/overlay";
import { CommandEditor } from "./CommandEditor";

export type Draft = Pick<Automation, "name" | "description" | "propertyId" | "enabled" | "trigger" | "conditions" | "actions" | "end" | "onUnreachable">;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const TRIGGERS: { value: string; label: string }[] = [
  { value: "time", label: "At a specific time" },
  { value: "sunrise", label: "At sunrise" },
  { value: "sunset", label: "At sunset" },
  { value: "motion", label: "Motion detected" },
  { value: "door", label: "Door opens" },
  { value: "device_state", label: "Device turns on / off" },
  { value: "temperature_change", label: "Temperature rises above" },
  { value: "manual", label: "Manually (run button)" },
];

function triggerKind(t: Trigger, devices: Map<string, Device>): string {
  if (t.type === "device_state") {
    const d = devices.get(t.deviceId);
    if (d?.type === "motion_sensor" && t.key === "motion") return "motion";
    if (d?.type === "door_sensor" && t.key === "contact") return "door";
  }
  return t.type;
}

function Block({ tag, color, title, subtitle, children, icon }: { tag: string; color: string; title: string; subtitle: string; children: ReactNode; icon: ReactNode }) {
  return (
    <motion.section layout className="card relative overflow-visible">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="rounded-md px-2 py-0.5 font-display text-[11px] font-extrabold tracking-[0.14em]" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
          {tag}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{title}</div>
          <div className="truncate text-[12px] text-faint">{subtitle}</div>
        </div>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="space-y-3 p-4 sm:p-5">{children}</div>
    </motion.section>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <div className="h-6 w-px bg-[linear-gradient(var(--line-strong),var(--mint))]" />
    </div>
  );
}

export function AutomationBuilder({ draft, setDraft, devices, rooms, scenes }: { draft: Draft; setDraft: (d: Draft) => void; devices: Device[]; rooms: Room[]; scenes: Scene[] }) {
  const devMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "";
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const kind = triggerKind(draft.trigger, devMap);
  const scheduled = draft.trigger.type === "time" || draft.trigger.type === "sunrise" || draft.trigger.type === "sunset";
  const motionSensors = devices.filter((d) => d.type === "motion_sensor");
  const doorSensors = devices.filter((d) => d.type === "door_sensor");
  const switchables = devices.filter((d) => has(d, "onoff"));
  const tempSensors = devices.filter((d) => has(d, "temperature"));
  const controllable = devices.filter((d) => d.capabilities.some((c) => !["motion", "contact", "temperature", "power_meter"].includes(c)));
  const [showDescription, setShowDescription] = useState(!!draft.description);

  const setTriggerKind = (k: string) => {
    const days = "days" in draft.trigger ? draft.trigger.days : ALL_DAYS;
    let t: Trigger;
    if (k === "time") t = { type: "time", time: "18:30", days };
    else if (k === "sunrise" || k === "sunset") t = { type: k, offsetMin: 0, days };
    else if (k === "motion") t = { type: "device_state", deviceId: motionSensors[0]?.id ?? "", key: "motion", equals: true };
    else if (k === "door") t = { type: "device_state", deviceId: doorSensors[0]?.id ?? "", key: "contact", equals: "open" };
    else if (k === "device_state") t = { type: "device_state", deviceId: switchables[0]?.id ?? "", key: "on", equals: true };
    else if (k === "temperature_change") t = { type: "temperature_change", deviceId: tempSensors[0]?.id ?? "", above: 28 };
    else t = { type: "manual" };
    set({ trigger: t, end: k === "time" || k === "sunrise" || k === "sunset" ? draft.end : null });
  };

  const updateCondition = (i: number, c: Condition) => set({ conditions: draft.conditions.map((x, j) => (j === i ? c : x)) });
  const updateAction = (i: number, a: Action) => set({ actions: draft.actions.map((x, j) => (j === i ? a : x)) });
  const moveAction = (i: number, dir: -1 | 1) => {
    const a = [...draft.actions];
    const j = i + dir;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ actions: a });
  };

  const deviceOptions = (list: Device[]) =>
    list.map((d) => (
      <option key={d.id} value={d.id}>
        {d.name} — {roomName(d.roomId)}
      </option>
    ));

  return (
    <div className="space-y-0">
      {/* Identity */}
      <div className="card mb-4 space-y-4 p-4 sm:p-5">
        <Field label="Automation name">{(id) => <Input id={id} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Evening Comfort" className="text-[15px] font-semibold" />}</Field>
        {showDescription ? (
          <Field label="Description">{(id) => <Textarea id={id} rows={2} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What this routine is for" />}</Field>
        ) : (
          <button className="text-[12.5px] font-medium text-mint" onClick={() => setShowDescription(true)}>
            + Add description
          </button>
        )}
      </div>

      {/* WHEN */}
      <Block tag="WHEN" color="var(--cyan)" title="Trigger" subtitle="What starts this automation" icon={<Zap className="size-4" />}>
        <Select aria-label="Trigger type" value={kind} onChange={(e) => setTriggerKind(e.target.value)}>
          {TRIGGERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>

        {draft.trigger.type === "time" && (
          <div className="grid gap-3 sm:grid-cols-[160px_1fr] sm:items-end">
            <Field label="Start time">{(id) => <Input id={id} type="time" value={draft.trigger.type === "time" ? draft.trigger.time : ""} onChange={(e) => draft.trigger.type === "time" && set({ trigger: { ...draft.trigger, time: e.target.value } })} />}</Field>
            <RepeatPicker days={draft.trigger.days} onChange={(days) => draft.trigger.type === "time" && set({ trigger: { ...draft.trigger, days } })} />
          </div>
        )}
        {(draft.trigger.type === "sunrise" || draft.trigger.type === "sunset") && (
          <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
            <Field label="Offset (minutes)" hint="Negative = before">
              {(id) => <Input id={id} type="number" min={-180} max={180} value={(draft.trigger as { offsetMin: number }).offsetMin} onChange={(e) => set({ trigger: { ...(draft.trigger as Extract<Trigger, { offsetMin: number }>), offsetMin: Number(e.target.value) } })} />}
            </Field>
            <RepeatPicker days={(draft.trigger as { days: number[] }).days} onChange={(days) => set({ trigger: { ...(draft.trigger as Extract<Trigger, { offsetMin: number }>), days } })} />
          </div>
        )}
        {draft.trigger.type === "device_state" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select aria-label="Trigger device" value={draft.trigger.deviceId} onChange={(e) => set({ trigger: { ...(draft.trigger as Extract<Trigger, { type: "device_state" }>), deviceId: e.target.value } })}>
              <option value="">Choose device</option>
              {deviceOptions(kind === "motion" ? motionSensors : kind === "door" ? doorSensors : switchables)}
            </Select>
            {kind === "device_state" && (
              <Select aria-label="Trigger state" value={String(draft.trigger.equals)} onChange={(e) => set({ trigger: { ...(draft.trigger as Extract<Trigger, { type: "device_state" }>), equals: e.target.value === "true" } })}>
                <option value="true">turns on</option>
                <option value="false">turns off</option>
              </Select>
            )}
          </div>
        )}
        {draft.trigger.type === "temperature_change" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select aria-label="Sensor" value={draft.trigger.deviceId} onChange={(e) => set({ trigger: { ...(draft.trigger as Extract<Trigger, { type: "temperature_change" }>), deviceId: e.target.value } })}>
              <option value="">Choose sensor</option>
              {deviceOptions(tempSensors)}
            </Select>
            <Input aria-label="Threshold" type="number" value={draft.trigger.above} onChange={(e) => set({ trigger: { ...(draft.trigger as Extract<Trigger, { type: "temperature_change" }>), above: Number(e.target.value) } })} />
          </div>
        )}
        {draft.trigger.type === "manual" && <p className="text-[12.5px] text-muted">Runs only when someone presses “Run now”, or from another automation.</p>}

        {scheduled && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3">
            <div>
              <div className="text-[13px] font-medium">End time</div>
              <div className="text-[12px] text-faint">Switch off the devices this routine turned on (essential loads untouched)</div>
            </div>
            <div className="flex items-center gap-2">
              {draft.end && <Input aria-label="End time" type="time" className="h-9 w-32" value={draft.end.time} onChange={(e) => set({ end: { time: e.target.value } })} />}
              <Switch label="Enable end time" checked={!!draft.end} onChange={(v) => set({ end: v ? { time: "23:00" } : null })} />
            </div>
          </div>
        )}
      </Block>

      <Connector />

      {/* IF */}
      <Block tag="IF" color="var(--violet)" title="Conditions" subtitle={draft.conditions.length ? "All must be true at run time" : "Optional — always runs when triggered"} icon={<Filter className="size-4" />}>
        {draft.conditions.map((c, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:flex-row sm:items-center">
            <span className="w-28 shrink-0 text-[12.5px] font-medium text-text-2">
              {{ device_online: "Device online", device_on: "Device is on", room_occupied: "Room occupied", temperature_above: "Temp above", day_of_week: "Day of week", property_mode: "Property mode" }[c.type]}
            </span>
            <div className="min-w-0 flex-1">
              {(c.type === "device_online" || c.type === "device_on") && (
                <Select aria-label="Device" className="h-9" value={c.deviceId} onChange={(e) => updateCondition(i, { ...c, deviceId: e.target.value })}>
                  {deviceOptions(c.type === "device_on" ? switchables : devices)}
                </Select>
              )}
              {c.type === "room_occupied" && (
                <Select aria-label="Room" className="h-9" value={c.roomId} onChange={(e) => updateCondition(i, { ...c, roomId: e.target.value })}>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              )}
              {c.type === "temperature_above" && (
                <div className="flex gap-2">
                  <Select aria-label="Sensor" className="h-9" value={c.deviceId} onChange={(e) => updateCondition(i, { ...c, deviceId: e.target.value })}>
                    {deviceOptions(tempSensors)}
                  </Select>
                  <Input aria-label="Degrees" type="number" className="h-9 w-24" value={c.value} onChange={(e) => updateCondition(i, { ...c, value: Number(e.target.value) })} />
                </div>
              )}
              {c.type === "day_of_week" && <DayPicker value={c.days} onChange={(days) => updateCondition(i, { ...c, days })} />}
              {c.type === "property_mode" && (
                <Select aria-label="Mode" className="h-9" value={c.mode} onChange={(e) => updateCondition(i, { ...c, mode: e.target.value as PropertyMode })}>
                  {["home", "away", "night", "vacation"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              )}
            </div>
            <IconButton label="Remove condition" onClick={() => set({ conditions: draft.conditions.filter((_, j) => j !== i) })} className="self-end sm:self-auto">
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        ))}
        <Popover
          align="start"
          className="w-60"
          trigger={({ toggle }) => (
            <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={toggle}>
              Add condition
            </Button>
          )}
        >
          {(close) => (
            <div className="py-1">
              {[
                ["Device is online", (): Condition => ({ type: "device_online", deviceId: devices[0]?.id ?? "" })],
                ["Another device is on", (): Condition => ({ type: "device_on", deviceId: switchables[0]?.id ?? "" })],
                ["Room is occupied", (): Condition => ({ type: "room_occupied", roomId: rooms[0]?.id ?? "" })],
                ["Temperature is above", (): Condition => ({ type: "temperature_above", deviceId: tempSensors[0]?.id ?? "", value: 27 })],
                ["Specific days of week", (): Condition => ({ type: "day_of_week", days: [1, 2, 3, 4, 5] })],
                ["Property is in a mode", (): Condition => ({ type: "property_mode", mode: "home" })],
              ].map(([label, make]) => (
                <MenuItem key={label as string} onClick={() => (close(), set({ conditions: [...draft.conditions, (make as () => Condition)()] }))}>
                  {label as string}
                </MenuItem>
              ))}
            </div>
          )}
        </Popover>
      </Block>

      <Connector />

      {/* THEN */}
      <Block tag="THEN" color="var(--mint)" title="Actions" subtitle="Run in order, top to bottom" icon={<Play className="size-4" />}>
        {draft.actions.map((a, i) => {
          const dev = a.type === "device" ? devMap.get(a.deviceId) : undefined;
          const occCond = a.type === "device" ? a.conditions?.find((c) => c.type === "room_occupied") : undefined;
          return (
            <motion.div layout key={i} className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="num flex size-6 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold">{i + 1}</span>
                <span className="flex-1 text-[12.5px] font-medium text-text-2">
                  {a.type === "device" ? (a.command && Object.keys(a.command).length ? describeCommand(a.command) : "Choose what to do") : a.type === "scene" ? "Run scene" : a.type === "notify" ? "Send notification" : "Wait"}
                </span>
                <IconButton label="Move up" className="size-8" disabled={i === 0} onClick={() => moveAction(i, -1)}><ArrowUp className="size-3.5" /></IconButton>
                <IconButton label="Move down" className="size-8" disabled={i === draft.actions.length - 1} onClick={() => moveAction(i, 1)}><ArrowDown className="size-3.5" /></IconButton>
                <IconButton label="Remove action" className="size-8" onClick={() => set({ actions: draft.actions.filter((_, j) => j !== i) })}><Trash2 className="size-3.5" /></IconButton>
              </div>
              {a.type === "device" && (
                <div className="space-y-2.5">
                  <Select aria-label="Device" className="h-9" value={a.deviceId} onChange={(e) => updateAction(i, { ...a, deviceId: e.target.value, command: {} })}>
                    <option value="">Choose device</option>
                    {deviceOptions(controllable)}
                  </Select>
                  <CommandEditor device={dev} value={a.command} onChange={(command) => updateAction(i, { ...a, command })} />
                  {dev && (
                    <label className="flex items-center justify-between gap-3 pt-1 text-[12.5px] text-muted">
                      <span>Only if {roomName(dev.roomId)} is occupied</span>
                      <Switch size="sm" label="Only if occupied" checked={!!occCond} onChange={(v) => updateAction(i, { ...a, conditions: v ? [{ type: "room_occupied", roomId: dev.roomId }] : [] })} />
                    </label>
                  )}
                </div>
              )}
              {a.type === "scene" && (
                <Select aria-label="Scene" className="h-9" value={a.sceneId} onChange={(e) => updateAction(i, { ...a, sceneId: e.target.value })}>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              )}
              {a.type === "notify" && <Input aria-label="Message" className="h-9" value={a.message} onChange={(e) => updateAction(i, { ...a, message: e.target.value })} />}
              {a.type === "delay" && (
                <div className="flex items-center gap-2">
                  <Input aria-label="Seconds" type="number" min={1} max={300} className="h-9 w-28" value={a.seconds} onChange={(e) => updateAction(i, { ...a, seconds: Number(e.target.value) })} />
                  <span className="text-[12.5px] text-faint">seconds (max 300)</span>
                </div>
              )}
            </motion.div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Cpu className="size-3.5" />} onClick={() => set({ actions: [...draft.actions, { type: "device", deviceId: "", command: {} }] })}>Device</Button>
          <Button size="sm" variant="secondary" icon={<Sparkles className="size-3.5" />} disabled={!scenes.length} onClick={() => set({ actions: [...draft.actions, { type: "scene", sceneId: scenes[0]?.id ?? "" }] })}>Scene</Button>
          <Button size="sm" variant="secondary" icon={<Bell className="size-3.5" />} onClick={() => set({ actions: [...draft.actions, { type: "notify", message: `${draft.name || "Automation"} ran` }] })}>Notify</Button>
          <Button size="sm" variant="secondary" icon={<Hourglass className="size-3.5" />} onClick={() => set({ actions: [...draft.actions, { type: "delay", seconds: 30 }] })}>Wait</Button>
        </div>
      </Block>

      <div className="card mt-4 grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <Field label="If a device can't be reached" hint="Offline devices never block the rest of the routine unless you choose abort.">
          {(id) => (
            <Select id={id} value={draft.onUnreachable} onChange={(e) => set({ onUnreachable: e.target.value as UnreachablePolicy })}>
              <option value="retry_then_notify">Retry 3× then notify me</option>
              <option value="skip">Skip it silently</option>
              <option value="abort">Stop the remaining actions</option>
            </Select>
          )}
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3.5">
          <div>
            <div className="text-[13px] font-medium">Enabled</div>
            <div className="text-[12px] text-faint">Paused routines never fire</div>
          </div>
          <Switch label="Enabled" checked={draft.enabled} onChange={(enabled) => set({ enabled })} />
        </div>
      </div>
    </div>
  );
}

function RepeatPicker({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  const preset = days.length === 7 ? "daily" : days.join() === "1,2,3,4,5" ? "weekdays" : days.join() === "0,6" ? "weekends" : "custom";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {[
          ["daily", "Every day", ALL_DAYS],
          ["weekdays", "Weekdays", [1, 2, 3, 4, 5]],
          ["weekends", "Weekends", [0, 6]],
        ].map(([k, l, d]) => (
          <button key={k as string} type="button" onClick={() => onChange(d as number[])} className={cx("h-8 rounded-full px-3 text-[12px] font-medium transition", preset === k ? "bg-text text-bg" : "bg-surface-3 text-muted hover:text-text")}>
            {l as string}
          </button>
        ))}
        <span className={cx("flex h-8 items-center rounded-full px-3 text-[12px]", preset === "custom" ? "bg-text text-bg" : "text-faint")}>
          <Clock className="mr-1 size-3" /> Custom
        </span>
      </div>
      <DayPicker value={days} onChange={onChange} />
    </div>
  );
}

export function emptyDraft(propertyId: string): Draft {
  return { name: "", description: "", propertyId, enabled: true, trigger: { type: "time", time: "18:30", days: ALL_DAYS }, conditions: [], actions: [], end: null, onUnreachable: "retry_then_notify" };
}

export function triggerSummary(t: Trigger, devices: Device[]): string {
  const name = (id: string) => devices.find((d) => d.id === id)?.name ?? "a device";
  const days = (d: number[]) => (d.length === 7 ? "every day" : d.join() === "1,2,3,4,5" ? "weekdays" : d.join() === "0,6" ? "weekends" : d.map((x) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x]).join(", "));
  switch (t.type) {
    case "time": {
      const [h, m] = t.time.split(":").map(Number);
      return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"} · ${days(t.days)}`;
    }
    case "sunrise":
    case "sunset":
      return `${t.offsetMin ? `${Math.abs(t.offsetMin)} min ${t.offsetMin > 0 ? "after" : "before"} ` : "At "}${t.type} · ${days(t.days)}`;
    case "device_state":
      return t.key === "motion" ? `Motion at ${name(t.deviceId)}` : t.key === "contact" ? `${name(t.deviceId)} opens` : `${name(t.deviceId)} turns ${t.equals ? "on" : "off"}`;
    case "temperature_change":
      return `${name(t.deviceId)} above ${t.above}°C`;
    case "manual":
      return "Manual";
  }
}

export const TriggerIcon = ({ t }: { t: Trigger }) => (t.type === "time" ? <Clock className="size-4" /> : t.type === "sunrise" || t.type === "sunset" ? <Sunrise className="size-4" /> : t.type === "manual" ? <Play className="size-4" /> : <Zap className="size-4" />);

export function validateDraft(d: Draft, devices: Device[]): string | null {
  if (d.name.trim().length < 2) return "Give the automation a name.";
  if (!d.actions.length) return "Add at least one action.";
  for (const a of d.actions) {
    if (a.type === "device") {
      if (!a.deviceId) return "Choose a device for every device action.";
      if (!Object.keys(a.command).length) return `Choose what ${devices.find((x) => x.id === a.deviceId)?.name ?? "the device"} should do.`;
    }
  }
  if ((d.trigger.type === "device_state" || d.trigger.type === "temperature_change") && !d.trigger.deviceId) return "Choose the trigger device.";
  if ("days" in d.trigger && !d.trigger.days.length) return "Pick at least one day.";
  return null;
}

export { DEVICE_CATALOG };
