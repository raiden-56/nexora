"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building, Building2, Check, Hotel, Plus, Trash2 } from "lucide-react";
import { cx } from "@/lib/format";
import type { OrgType, PropertyKind, RoomKind } from "@/lib/types";
import { Button, IconButton } from "../ui/button";
import { Field, Input, Select } from "../ui/controls";

export interface WizardFloor {
  name: string;
  rooms: { name: string; kind: RoomKind }[];
}
export interface PropertyDraft {
  name: string;
  kind: PropertyKind;
  address: string;
  timezone: string;
  lat: number;
  lng: number;
  tariffPerKwh: number;
  currency: string;
  floors: WizardFloor[];
}

const KINDS: { value: PropertyKind; label: string; for: OrgType[] }[] = [
  { value: "home", label: "House", for: ["residential"] },
  { value: "villa", label: "Villa", for: ["residential"] },
  { value: "apartment", label: "Apartment", for: ["residential", "hospitality"] },
  { value: "office", label: "Office", for: ["commercial"] },
  { value: "coworking", label: "Coworking", for: ["commercial"] },
  { value: "campus", label: "Campus / institution", for: ["commercial"] },
  { value: "warehouse", label: "Warehouse", for: ["commercial"] },
  { value: "hotel", label: "Hotel", for: ["hospitality"] },
  { value: "resort", label: "Resort", for: ["hospitality"] },
];

export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  living: "Living",
  kitchen: "Kitchen",
  dining: "Dining",
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  study: "Study",
  balcony: "Balcony / outdoor",
  office: "Workspace",
  meeting: "Meeting room",
  lobby: "Lobby / reception",
  guest_room: "Guest room",
  corridor: "Corridor",
  utility: "Utility",
  server: "Server / IT",
};

function template(kind: PropertyKind): WizardFloor[] {
  if (kind === "office" || kind === "coworking" || kind === "campus")
    return [
      { name: "Ground Floor", rooms: [{ name: "Reception", kind: "lobby" }, { name: "Cafeteria", kind: "dining" }] },
      { name: "Floor 1", rooms: [{ name: "Open Workspace", kind: "office" }, { name: "Meeting Room A", kind: "meeting" }, { name: "Meeting Room B", kind: "meeting" }] },
    ];
  if (kind === "hotel" || kind === "resort")
    return [
      { name: "Lobby Level", rooms: [{ name: "Lobby", kind: "lobby" }, { name: "Restaurant", kind: "dining" }] },
      { name: "Floor 1", rooms: ["101", "102", "103", "104"].map((n) => ({ name: `Room ${n}`, kind: "guest_room" as RoomKind })) },
    ];
  if (kind === "warehouse") return [{ name: "Ground Floor", rooms: [{ name: "Loading Bay", kind: "utility" }, { name: "Site Office", kind: "office" }] }];
  if (kind === "apartment") return [{ name: "Apartment", rooms: [{ name: "Living Room", kind: "living" }, { name: "Kitchen", kind: "kitchen" }, { name: "Bedroom", kind: "bedroom" }, { name: "Balcony", kind: "balcony" }] }];
  return [
    { name: "Ground Floor", rooms: [{ name: "Living Room", kind: "living" }, { name: "Kitchen", kind: "kitchen" }, { name: "Dining Room", kind: "dining" }, { name: "Guest Bedroom", kind: "bedroom" }] },
    { name: "First Floor", rooms: [{ name: "Master Bedroom", kind: "bedroom" }, { name: "Bedroom 2", kind: "bedroom" }, { name: "Study Room", kind: "study" }, { name: "Balcony", kind: "balcony" }] },
  ];
}

export const ORG_TYPES: { value: OrgType; label: string; body: string; icon: typeof Building }[] = [
  { value: "residential", label: "Residential", body: "Homes, villas and apartments with family access", icon: Building },
  { value: "commercial", label: "Commercial", body: "Offices, campuses, retail and warehouses", icon: Building2 },
  { value: "hospitality", label: "Hospitality", body: "Hotels, resorts and serviced apartments", icon: Hotel },
];

function useTimezones() {
  return useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York", "UTC"];
    }
  }, []);
}

export function OrgTypePicker({ value, onChange }: { value: OrgType; onChange: (v: OrgType) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ORG_TYPES.map((t) => (
        <button
          type="button"
          key={t.value}
          onClick={() => onChange(t.value)}
          aria-pressed={value === t.value}
          className={cx("focus-ring rounded-2xl border p-4 text-left transition", value === t.value ? "border-[var(--mint)] bg-[color-mix(in_srgb,var(--mint)_7%,transparent)]" : "border-line bg-surface-2 hover:border-line-strong")}
        >
          <t.icon className={cx("size-5", value === t.value ? "text-mint" : "text-muted")} />
          <div className="mt-3 text-[14px] font-semibold">{t.label}</div>
          <div className="mt-1 text-[12px] text-muted">{t.body}</div>
        </button>
      ))}
    </div>
  );
}

/** Steps: details → floors & rooms → review. Used by onboarding and "Add property". */
export function PropertyWizard({ orgType, onSubmit, submitting, leading, onBackFromFirst }: { orgType: OrgType; onSubmit: (d: PropertyDraft) => void; submitting: boolean; leading?: React.ReactNode; onBackFromFirst?: () => void }) {
  const kinds = KINDS.filter((k) => k.for.includes(orgType));
  const tzs = useTimezones();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PropertyDraft>(() => ({ name: "", kind: kinds[0].value, address: "", timezone: "Asia/Kolkata", lat: 12.97, lng: 77.59, tariffPerKwh: 8, currency: "INR", floors: template(kinds[0].value) }));
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setDraft((d) => ({ ...d, timezone: tz }));
    } catch {
      /* ignore */
    }
  }, []);
  const set = (p: Partial<PropertyDraft>) => setDraft((d) => ({ ...d, ...p }));
  const steps = ["Property details", "Floors & rooms", "Review"];
  const valid0 = draft.name.trim().length >= 2;
  const totalRooms = draft.floors.reduce((s, f) => s + f.rooms.length, 0);

  return (
    <div>
      {leading}
      <ol className="mb-8 flex items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition", i < step ? "bg-mint text-mint-ink" : i === step ? "bg-surface-3 text-text ring-2 ring-[var(--mint)]" : "bg-surface-2 text-faint")}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
            <span className={cx("hidden truncate text-[12.5px] font-medium sm:block", i === step ? "text-text" : "text-faint")}>{s}</span>
            {i < steps.length - 1 && <span className="h-px min-w-4 flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Property name" className="sm:col-span-2">
                {(id) => <Input id={id} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder={orgType === "hospitality" ? "Aurelia Bay Resort" : orgType === "commercial" ? "Tower One Headquarters" : "Lakeview Residence"} />}
              </Field>
              <Field label="Type">
                {(id) => (
                  <Select id={id} value={draft.kind} onChange={(e) => set({ kind: e.target.value as PropertyKind, floors: template(e.target.value as PropertyKind) })}>
                    {kinds.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Timezone" hint="Schedules run in this timezone, including daylight-saving changes.">
                {(id) => (
                  <Select id={id} value={draft.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                    {tzs.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Address" className="sm:col-span-2">
                {(id) => <Input id={id} value={draft.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street, city" />}
              </Field>
              <Field label="Latitude" hint="Used for sunrise / sunset triggers">
                {(id) => <Input id={id} type="number" step="0.0001" value={draft.lat} onChange={(e) => set({ lat: Number(e.target.value) })} />}
              </Field>
              <Field label="Longitude">{(id) => <Input id={id} type="number" step="0.0001" value={draft.lng} onChange={(e) => set({ lng: Number(e.target.value) })} />}</Field>
              <Field label="Electricity tariff (per kWh)">{(id) => <Input id={id} type="number" step="0.1" min={0} value={draft.tariffPerKwh} onChange={(e) => set({ tariffPerKwh: Number(e.target.value) })} />}</Field>
              <Field label="Currency">
                {(id) => (
                  <Select id={id} value={draft.currency} onChange={(e) => set({ currency: e.target.value })}>
                    {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-[13px] text-muted">We&apos;ve suggested a layout for a {KINDS.find((k) => k.value === draft.kind)?.label.toLowerCase()}. Rename, add or remove anything — you can change it later.</p>
              {draft.floors.map((f, fi) => (
                <div key={fi} className="rounded-2xl border border-line bg-surface-2 p-4">
                  <div className="flex items-center gap-2">
                    <Input aria-label="Floor name" value={f.name} onChange={(e) => set({ floors: draft.floors.map((x, i) => (i === fi ? { ...x, name: e.target.value } : x)) })} className="h-10 font-semibold" />
                    <IconButton label="Remove floor" disabled={draft.floors.length <= 1} onClick={() => set({ floors: draft.floors.filter((_, i) => i !== fi) })}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                  <div className="mt-3 space-y-2">
                    {f.rooms.map((r, ri) => (
                      <div key={ri} className="flex items-center gap-2">
                        <Input aria-label="Room name" value={r.name} onChange={(e) => set({ floors: draft.floors.map((x, i) => (i === fi ? { ...x, rooms: x.rooms.map((y, j) => (j === ri ? { ...y, name: e.target.value } : y)) } : x)) })} className="h-10" />
                        <div className="w-40 shrink-0 sm:w-48">
                          <Select aria-label="Room type" value={r.kind} onChange={(e) => set({ floors: draft.floors.map((x, i) => (i === fi ? { ...x, rooms: x.rooms.map((y, j) => (j === ri ? { ...y, kind: e.target.value as RoomKind } : y)) } : x)) })} className="h-10">
                            {Object.entries(ROOM_KIND_LABEL).map(([k, l]) => (
                              <option key={k} value={k}>
                                {l}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <IconButton label="Remove room" onClick={() => set({ floors: draft.floors.map((x, i) => (i === fi ? { ...x, rooms: x.rooms.filter((_, j) => j !== ri) } : x)) })}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => set({ floors: draft.floors.map((x, i) => (i === fi ? { ...x, rooms: [...x.rooms, { name: `Room ${x.rooms.length + 1}`, kind: "living" }] } : x)) })}>
                      Add room
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => set({ floors: [...draft.floors, { name: `Floor ${draft.floors.length}`, rooms: [] }] })}>
                Add floor
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-surface-2 p-5">
                <div className="text-eyebrow">Property</div>
                <div className="mt-1 font-display text-[20px] font-bold">{draft.name}</div>
                <div className="mt-1 text-[13px] text-muted">
                  {KINDS.find((k) => k.value === draft.kind)?.label} · {draft.timezone.replace(/_/g, " ")} · {draft.currency} {draft.tariffPerKwh}/kWh
                </div>
                {draft.address && <div className="mt-1 text-[13px] text-faint">{draft.address}</div>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {draft.floors.map((f, i) => (
                  <div key={i} className="rounded-2xl border border-line p-4">
                    <div className="text-[13.5px] font-semibold">{f.name}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.rooms.map((r, j) => (
                        <span key={j} className="rounded-full bg-surface-3 px-2.5 py-1 text-[12px] text-text-2">
                          {r.name}
                        </span>
                      ))}
                      {!f.rooms.length && <span className="text-[12px] text-faint">No rooms yet</span>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[12.5px] text-faint">
                {draft.floors.length} floors · {totalRooms} rooms. After creation, pair real devices through an integration or add simulated devices to try things out.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => (step === 0 ? onBackFromFirst?.() : setStep(step - 1))} disabled={step === 0 && !onBackFromFirst}>
          Back
        </Button>
        {step < 2 ? (
          <Button variant="primary" onClick={() => setStep(step + 1)} disabled={step === 0 && !valid0}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button variant="primary" loading={submitting} onClick={() => onSubmit(draft)}>
            Create property
          </Button>
        )}
      </div>
    </div>
  );
}
