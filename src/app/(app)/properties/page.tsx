"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ArrowRight, Building2, Check, Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui/surface";
import { BOOT_KEY, useBootstrap, type Bootstrap } from "@/hooks/useNexora";
import { api } from "@/lib/api";
import { capitalize } from "@/lib/devices";
import { cx } from "@/lib/format";

type Prop = Bootstrap["properties"][number];

export default function PropertiesPage() {
  const { data, can } = useBootstrap();
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<Prop | null>(null);

  if (!data) return <Skeleton className="h-96" />;
  const manage = can("properties.manage");

  const open = async (p: Prop) => {
    if (p.id !== data.propertyId) {
      await api("/api/properties/select", { body: { propertyId: p.id } });
      await mutate(() => true, undefined, { revalidate: true });
    }
    router.push("/overview");
  };

  const remove = async (p: Prop) => {
    if (!(await confirm({ title: `Delete ${p.name}?`, body: `This permanently removes ${p.deviceCount} devices, all rooms, scenes and automations of this property from Nexora. Physical devices are not reset.`, confirmLabel: "Delete property", danger: true }))) return;
    try {
      await api(`/api/properties/${p.id}`, { method: "DELETE" });
      await mutate(BOOT_KEY);
      toast({ tone: "success", title: `${p.name} deleted` });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't delete", body: (e as Error).message });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={data.org.name}
        title="Properties"
        description="Every property is managed independently — its own timezone, tariff, floors, devices and routines."
        actions={manage && <Link href="/properties/new"><Button variant="primary" icon={<Plus className="size-4" />}>Add property</Button></Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {data.properties.map((p) => {
          const active = p.id === data.propertyId;
          const health = p.deviceCount ? Math.round((p.onlineCount / p.deviceCount) * 100) : 100;
          return (
            <Card key={p.id} className={cx("flex flex-col p-5", active && "border-[color-mix(in_srgb,var(--mint)_45%,transparent)]")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--mint)_22%,transparent),color-mix(in_srgb,var(--cyan)_14%,transparent))] text-mint">
                  <Building2 className="size-5" />
                </div>
                <div className="flex items-center gap-1">
                  {active && <Badge tone="mint"><Check className="size-3" /> Current</Badge>}
                  {manage && (
                    <>
                      <IconButton label={`Edit ${p.name}`} onClick={() => setEdit(p)}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label={`Delete ${p.name}`} onClick={() => remove(p)} className="hover:text-err">
                        <Trash2 className="size-4" />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
              <h3 className="mt-4 text-[17px] font-semibold">{p.name}</h3>
              <div className="mt-1 space-y-1 text-[12.5px] text-muted">
                <div className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {p.address || "No address"}</div>
                <div className="flex items-center gap-1.5"><Clock className="size-3.5" /> {p.timezone.replace(/_/g, " ")} · {capitalize(p.kind)} · {capitalize(p.mode)} mode</div>
              </div>
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-[12px]">
                  <span className="text-faint">Device health</span>
                  <span className="num font-semibold">{p.onlineCount}/{p.deviceCount} online</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${health}%`, background: health > 90 ? "var(--ok)" : health > 70 ? "var(--warn)" : "var(--err)" }} />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="num text-[12px] text-faint">{p.currency} {p.tariffPerKwh}/kWh</span>
                <Button size="sm" variant={active ? "secondary" : "primary"} onClick={() => open(p)}>
                  {active ? "Open dashboard" : "Switch to property"} <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      {edit && <EditProperty p={edit} onClose={() => setEdit(null)} onSaved={() => mutate(BOOT_KEY)} />}
    </div>
  );
}

function EditProperty({ p, onClose, onSaved }: { p: Prop; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const [f, setF] = useState({ name: p.name, address: p.address, timezone: p.timezone, tariffPerKwh: p.tariffPerKwh, lat: p.lat, lng: p.lng });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/properties/${p.id}`, { method: "PATCH", body: f });
      await onSaved();
      toast({ tone: "success", title: "Property updated" });
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Edit ${p.name}`} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Address" className="sm:col-span-2">{(id) => <Input id={id} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />}</Field>
        <Field label="Timezone" hint="IANA name, e.g. Asia/Kolkata">{(id) => <Input id={id} value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} />}</Field>
        <Field label="Tariff per kWh">{(id) => <Input id={id} type="number" step="0.1" value={f.tariffPerKwh} onChange={(e) => setF({ ...f, tariffPerKwh: Number(e.target.value) })} />}</Field>
        <Field label="Latitude">{(id) => <Input id={id} type="number" step="0.0001" value={f.lat} onChange={(e) => setF({ ...f, lat: Number(e.target.value) })} />}</Field>
        <Field label="Longitude">{(id) => <Input id={id} type="number" step="0.0001" value={f.lng} onChange={(e) => setF({ ...f, lng: Number(e.target.value) })} />}</Field>
      </div>
    </Modal>
  );
}
