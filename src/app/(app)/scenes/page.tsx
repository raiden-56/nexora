"use client";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { CommandEditor } from "@/components/automation/CommandEditor";
import { SCENE_ICONS, SceneTile } from "@/components/scenes/SceneTile";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap } from "@/hooks/useNexora";
import { api } from "@/lib/api";
import { describeCommand, has } from "@/lib/devices";
import { cx, relTime } from "@/lib/format";
import type { Device, Room, Scene, SceneAction } from "@/lib/types";

interface Template {
  name: string;
  icon: string;
  accent: string;
  description: string;
  build: (devices: Device[], rooms: Room[]) => SceneAction[];
}

const lights = (ds: Device[]) => ds.filter((d) => d.type === "bulb" || d.type === "led_strip");
const inKind = (ds: Device[], rooms: Room[], kinds: string[]) => ds.filter((d) => kinds.includes(rooms.find((r) => r.id === d.roomId)?.kind ?? ""));
const nonEssentialSwitchables = (ds: Device[]) => ds.filter((d) => has(d, "onoff") && !d.essential);

const TEMPLATES: Template[] = [
  { name: "Welcome Home", icon: "sparkles", accent: "#69E3C0", description: "Living areas lit and cooled", build: (d, r) => [...lights(inKind(d, r, ["living", "lobby"])).map((x) => ({ deviceId: x.id, command: { on: true, brightness: 80 } })), ...inKind(d, r, ["living"]).filter((x) => x.type === "ac").map((x) => ({ deviceId: x.id, command: { on: true, targetTemp: 24 } }))] },
  { name: "Good Morning", icon: "sunrise", accent: "#F2B66D", description: "Open curtains and blinds, soft light", build: (d) => [...d.filter((x) => has(x, "position")).map((x) => ({ deviceId: x.id, command: { position: 100 } })), ...lights(d).slice(0, 4).map((x) => ({ deviceId: x.id, command: { on: true, brightness: 50, ...(has(x, "color_temp") ? { colorTemp: 4500 } : {}) } }))] },
  { name: "Good Night", icon: "moon", accent: "#7DD9F2", description: "Lights off, doors locked", build: (d) => [...lights(d).map((x) => ({ deviceId: x.id, command: { on: false } })), ...d.filter((x) => x.type === "lock").map((x) => ({ deviceId: x.id, command: { locked: true } }))] },
  { name: "Movie Time", icon: "clapperboard", accent: "#9C8CF6", description: "Dim lights, close curtains", build: (d, r) => [...inKind(d, r, ["living"]).filter((x) => has(x, "position")).map((x) => ({ deviceId: x.id, command: { position: 0 } })), ...lights(inKind(d, r, ["living"])).map((x) => ({ deviceId: x.id, command: { on: true, brightness: 15 } }))] },
  { name: "Reading Mode", icon: "book-open", accent: "#69E3C0", description: "Bright neutral light where you read", build: (d, r) => lights(inKind(d, r, ["study", "bedroom"])).slice(0, 3).map((x) => ({ deviceId: x.id, command: { on: true, brightness: 100, ...(has(x, "color_temp") ? { colorTemp: 5000 } : {}) } })) },
  { name: "Dinner Mode", icon: "utensils", accent: "#F2B66D", description: "Warm dining light", build: (d, r) => lights(inKind(d, r, ["dining", "kitchen"])).map((x) => ({ deviceId: x.id, command: { on: true, brightness: 60, ...(has(x, "color_temp") ? { colorTemp: 2700 } : {}) } })) },
  { name: "Away Mode", icon: "plane", accent: "#8BA8C4", description: "Non-essential loads off, doors locked", build: (d) => [...nonEssentialSwitchables(d).map((x) => ({ deviceId: x.id, command: { on: false } })), ...d.filter((x) => x.type === "lock").map((x) => ({ deviceId: x.id, command: { locked: true } }))] },
  { name: "Vacation Mode", icon: "plane", accent: "#8BA8C4", description: "Everything non-essential off, blinds closed", build: (d) => [...nonEssentialSwitchables(d).map((x) => ({ deviceId: x.id, command: { on: false } })), ...d.filter((x) => has(x, "position")).map((x) => ({ deviceId: x.id, command: { position: 0 } }))] },
  { name: "Meeting Mode", icon: "users", accent: "#69E3C0", description: "Meeting rooms lit and cooled", build: (d, r) => inKind(d, r, ["meeting"]).filter((x) => x.type === "bulb" || x.type === "ac").map((x) => ({ deviceId: x.id, command: x.type === "ac" ? { on: true, targetTemp: 23 } : { on: true, brightness: 85 } })) },
  { name: "Presentation Mode", icon: "presentation", accent: "#7DD9F2", description: "Blinds down, lights low, display on", build: (d, r) => inKind(d, r, ["meeting"]).flatMap((x): SceneAction[] => (has(x, "position") ? [{ deviceId: x.id, command: { position: 0 } }] : x.type === "bulb" ? [{ deviceId: x.id, command: { on: true, brightness: 25 } }] : x.type === "plug" ? [{ deviceId: x.id, command: { on: true } }] : [])) },
  { name: "Hotel Welcome", icon: "concierge-bell", accent: "#F2B66D", description: "Warm lobby lighting for arrivals", build: (d, r) => lights(inKind(d, r, ["lobby"])).map((x) => ({ deviceId: x.id, command: { on: true, brightness: 100, ...(has(x, "color_temp") ? { colorTemp: 3000 } : {}) } })) },
  { name: "Housekeeping Mode", icon: "sparkles", accent: "#7DD9F2", description: "Full bright light, curtains open", build: (d, r) => inKind(d, r, ["guest_room"]).flatMap((x): SceneAction[] => (x.type === "bulb" ? [{ deviceId: x.id, command: { on: true, brightness: 100 } }] : has(x, "position") ? [{ deviceId: x.id, command: { position: 100 } }] : [])) },
  { name: "Energy Saving Mode", icon: "leaf", accent: "#69E3C0", description: "Dim lights, relax AC set-points", build: (d) => [...lights(d).filter((x) => x.state.on).map((x) => ({ deviceId: x.id, command: { brightness: 50 } })), ...d.filter((x) => x.type === "ac" && !x.essential).map((x) => ({ deviceId: x.id, command: { targetTemp: 26 } }))] },
];

interface SceneDraft {
  id?: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  actions: SceneAction[];
}

export default function ScenesPage() {
  const { data, property, can, roomById } = useBootstrap();
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<SceneDraft | null>(null);
  const [templates, setTemplates] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  if (!data || !property) return <Skeleton className="h-96" />;
  const manage = can("scenes.manage");
  const devName = (id: string) => data.devices.find((d) => d.id === id)?.name ?? "Removed device";

  const fromTemplate = (t: Template) => {
    const actions = t.build(data.devices, data.rooms);
    setTemplates(false);
    setDraft({ name: t.name, description: t.description, icon: t.icon, accent: t.accent, actions });
    if (!actions.length) toast({ tone: "info", title: "No matching devices", body: "This property has no devices that fit the template — add actions manually." });
  };

  const remove = async (s: Scene) => {
    if (!(await confirm({ title: `Delete ${s.name}?`, body: "Automations that run this scene must be updated first.", confirmLabel: "Delete scene", danger: true }))) return;
    try {
      await api(`/api/scenes/${s.id}`, { method: "DELETE" });
      await mutate(BOOT_KEY);
      toast({ tone: "success", title: `${s.name} deleted` });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't delete", body: (e as Error).message });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={property.name}
        title="Scenes"
        description="One tap, many devices, in a defined order. Each action reports whether the device actually confirmed it."
        actions={
          manage && (
            <>
              <Button variant="outline" icon={<Sparkles className="size-4" />} onClick={() => setTemplates(true)}>
                From template
              </Button>
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setDraft({ name: "", description: "", icon: "sparkles", accent: "#69E3C0", actions: [] })}>
                New scene
              </Button>
            </>
          )
        }
      />
      {data.scenes.length === 0 ? (
        <EmptyState icon={<Sparkles className="size-5" />} title="No scenes yet" body="Start from a template like Good Night or Movie Time." action={manage && <Button variant="primary" onClick={() => setTemplates(true)}>Browse templates</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.scenes.map((s) => (
            <Card key={s.id} className="flex flex-col p-4">
              <SceneTile scene={s} disabled={!can("devices.control")} />
              <p className="mt-3 line-clamp-2 min-h-[2.5em] px-1 text-[12.5px] text-muted">{s.description || "No description"}</p>
              <button onClick={() => setPreview(preview === s.id ? null : s.id)} className="mt-2 flex items-center gap-1 px-1 text-[12px] font-medium text-text-2 hover:text-text" aria-expanded={preview === s.id}>
                Preview {s.actions.length} actions <ChevronDown className={cx("size-3.5 transition", preview === s.id && "rotate-180")} />
              </button>
              {preview === s.id && (
                <ol className="mt-2 space-y-1">
                  {s.actions.map((a, i) => (
                    <li key={i} className="flex gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px]">
                      <span className="num text-faint">{i + 1}.</span>
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{devName(a.deviceId)}</span> <span className="text-muted">→ {describeCommand(a.command)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-auto flex items-center justify-between pt-4 text-[11.5px] text-faint">
                <span>{s.lastActivatedAt ? `Last run ${relTime(s.lastActivatedAt)}` : "Never run"}</span>
                {manage && (
                  <div className="flex gap-0.5">
                    <IconButton label={`Edit ${s.name}`} className="size-8" onClick={() => setDraft({ id: s.id, name: s.name, description: s.description, icon: s.icon, accent: s.accent, actions: s.actions })}>
                      <Pencil className="size-3.5" />
                    </IconButton>
                    <IconButton label={`Delete ${s.name}`} className="size-8 hover:text-err" onClick={() => remove(s)}>
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={templates} onClose={() => setTemplates(false)} title="Scene templates" description="Templates pick matching devices in this property — you can edit everything before saving." size="lg">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TEMPLATES.map((t) => {
            const Icon = SCENE_ICONS[t.icon] ?? Sparkles;
            const n = t.build(data.devices, data.rooms).length;
            return (
              <button key={t.name} onClick={() => fromTemplate(t)} className="focus-ring flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3.5 text-left transition hover:border-line-strong">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ color: t.accent, background: `color-mix(in srgb, ${t.accent} 15%, transparent)` }}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold">{t.name}</span>
                  <span className="block truncate text-[12px] text-faint">{n ? `${n} matching actions` : "No matching devices here"}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      {draft && <SceneEditor key={draft.id ?? draft.name} initial={draft} devices={data.devices} roomName={(id) => roomById.get(id)?.name ?? ""} propertyId={property.id} onClose={() => setDraft(null)} onSaved={() => mutate(BOOT_KEY)} />}
    </div>
  );
}

function SceneEditor({ initial, devices, roomName, propertyId, onClose, onSaved }: { initial: SceneDraft; devices: Device[]; roomName: (id: string) => string; propertyId: string; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const controllable = devices.filter((x) => x.capabilities.some((c) => !["motion", "contact", "temperature", "power_meter"].includes(c)));
  const setAction = (i: number, a: SceneAction) => setD({ ...d, actions: d.actions.map((x, j) => (j === i ? a : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const a = [...d.actions];
    const j = i + dir;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setD({ ...d, actions: a });
  };
  const save = async () => {
    if (d.name.trim().length < 2) return toast({ tone: "warning", title: "Name the scene" });
    const actions = d.actions.filter((a) => a.deviceId && Object.keys(a.command).length);
    if (!actions.length) return toast({ tone: "warning", title: "Add at least one device action" });
    setSaving(true);
    try {
      const body = { name: d.name, description: d.description, icon: d.icon, accent: d.accent, propertyId, actions };
      if (d.id) await api(`/api/scenes/${d.id}`, { method: "PATCH", body });
      else await api("/api/scenes", { body });
      await onSaved();
      toast({ tone: "success", title: d.id ? "Scene updated" : `${d.name} created` });
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save scene", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={d.id ? `Edit ${initial.name}` : "Build a scene"} description="Actions run top to bottom." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save scene</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px_90px]">
          <Field label="Name">{(id) => <Input id={id} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
          <Field label="Icon">
            {(id) => (
              <Select id={id} value={d.icon} onChange={(e) => setD({ ...d, icon: e.target.value })}>
                {Object.keys(SCENE_ICONS).map((k) => (
                  <option key={k} value={k}>{k.replace("-", " ")}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Accent">{(id) => <input id={id} type="color" value={d.accent} onChange={(e) => setD({ ...d, accent: e.target.value.toUpperCase() })} className="h-11 w-full cursor-pointer rounded-xl border border-line bg-surface-2" />}</Field>
          <Field label="Description" className="sm:col-span-3">{(id) => <Input id={id} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />}</Field>
        </div>
        <div className="space-y-2.5">
          {d.actions.map((a, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold">{i + 1}</span>
                <Select aria-label="Device" className="h-9" value={a.deviceId} onChange={(e) => setAction(i, { deviceId: e.target.value, command: {} })}>
                  <option value="">Choose device</option>
                  {controllable.map((x) => (
                    <option key={x.id} value={x.id}>{x.name} — {roomName(x.roomId)}</option>
                  ))}
                </Select>
                <IconButton label="Move up" className="size-8" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></IconButton>
                <IconButton label="Move down" className="size-8" disabled={i === d.actions.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></IconButton>
                <IconButton label="Remove" className="size-8" onClick={() => setD({ ...d, actions: d.actions.filter((_, j) => j !== i) })}><Trash2 className="size-3.5" /></IconButton>
              </div>
              <CommandEditor device={devices.find((x) => x.id === a.deviceId)} value={a.command} onChange={(command) => setAction(i, { ...a, command })} />
            </div>
          ))}
          <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setD({ ...d, actions: [...d.actions, { deviceId: "", command: {} }] })}>
            Add device action
          </Button>
        </div>
      </div>
    </Modal>
  );
}
