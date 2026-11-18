"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Building2, KeyRound, Moon, Palette, RotateCcw, ShieldCheck, Sun, UserRound } from "lucide-react";
import { OrgTypePicker } from "@/components/property/PropertyWizard";
import { useTheme } from "@/components/providers";
import { useSession } from "@/components/shell/SessionContext";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Switch } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Badge, Card, CardHeader, PageHeader, Skeleton } from "@/components/ui/surface";
import { useBootstrap } from "@/hooks/useNexora";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/rbac";
import type { OrgType } from "@/lib/types";

export default function SettingsPage() {
  const session = useSession();
  const { data } = useBootstrap();
  const [tab, setTab] = useState<"profile" | "org" | "appearance">("profile");
  if (!data) return <Skeleton className="h-96" />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Your profile, security and organization preferences." />
      <Segmented
        label="Settings section"
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: "profile", label: <><UserRound className="size-3.5" /> Profile</> },
          { value: "org", label: <><Building2 className="size-3.5" /> Organization</> },
          { value: "appearance", label: <><Palette className="size-3.5" /> Appearance</> },
        ]}
      />
      {tab === "profile" && <Profile key={session.user.id} />}
      {tab === "org" && <Org />}
      {tab === "appearance" && <Appearance />}
    </div>
  );
}

function Profile() {
  const session = useSession();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(session.user.name);
  const [mfa, setMfa] = useState(session.user.mfaEnabled);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [saving, setSaving] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setSaving(key);
    try {
      await fn();
      toast({ tone: "success", title: ok });
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save", body: (e as Error).message });
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Profile" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Email" hint="Contact support to change your sign-in email">{(id) => <Input id={id} value={session.user.email} disabled />}</Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Badge tone="mint">{session.role ? ROLES[session.role].label : "—"}</Badge>
            {session.user.isSuperAdmin && <Badge tone="violet">Platform admin</Badge>}
            <Button className="ml-auto" variant="primary" loading={saving === "name"} disabled={name === session.user.name} onClick={() => run("name", () => api("/api/me", { method: "PATCH", body: { name } }), "Profile updated")}>
              Save
            </Button>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Security" action={<ShieldCheck className="size-4 text-ok" />} />
        <div className="space-y-5 p-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-line p-4">
            <div>
              <div className="text-[13.5px] font-medium">Two-factor authentication</div>
              <p className="mt-0.5 text-[12px] text-muted">Require an authenticator code at sign-in. Enrollment with a TOTP app is completed from the mobile app.</p>
            </div>
            <Switch label="Two-factor authentication" checked={mfa} onChange={(v) => (setMfa(v), void run("mfa", () => api("/api/me", { method: "PATCH", body: { mfaEnabled: v } }), v ? "2FA requirement enabled" : "2FA requirement disabled"))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Current password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />}</Field>
            <Field label="New password" hint="10+ characters with a letter and a number">{(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />}</Field>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-faint">Changing your password signs out all your other sessions.</p>
            <Button variant="secondary" icon={<KeyRound className="size-4" />} loading={saving === "pw"} disabled={!pw.current || pw.next.length < 10} onClick={() => run("pw", async () => (await api("/api/me/password", { body: pw }), setPw({ current: "", next: "" })), "Password changed")}>
              Change password
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Org() {
  const { data } = useBootstrap();
  const session = useSession();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const [name, setName] = useState(data!.org.name);
  const [type, setType] = useState<OrgType>(data!.org.type);
  const [saving, setSaving] = useState(false);
  const owner = data!.role === "owner";
  const save = async () => {
    setSaving(true);
    try {
      await api("/api/org", { method: "PATCH", body: { name, type } });
      await mutate(() => true, undefined, { revalidate: true });
      router.refresh();
      toast({ tone: "success", title: "Organization updated" });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Organization" subtitle={owner ? "Only owners can change these settings" : "Read-only — ask an owner to change these"} />
        <div className="space-y-5 p-5">
          <Field label="Organization name">{(id) => <Input id={id} value={name} disabled={!owner} onChange={(e) => setName(e.target.value)} />}</Field>
          <div className={owner ? "" : "pointer-events-none opacity-60"}>
            <div className="mb-2 text-[13px] font-medium text-text-2">Type</div>
            <OrgTypePicker value={type} onChange={setType} />
          </div>
          {owner && (
            <div className="flex justify-end">
              <Button variant="primary" loading={saving} disabled={name === data!.org.name && type === data!.org.type} onClick={save}>
                Save organization
              </Button>
            </div>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Plan & billing" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-[13px]">
          <div>
            <div className="font-medium capitalize">{data!.org.plan} plan</div>
            <div className="text-muted">Billing is modular and not enforced in this release — no device, property or automation limits apply.</div>
          </div>
          <Badge tone="cyan">{data!.properties.length} properties · {data!.properties.reduce((s, p) => s + p.deviceCount, 0)} devices</Badge>
        </div>
      </Card>
      {session.user.isSuperAdmin && (
        <Card className="border-dashed">
          <CardHeader title="Demo environment" subtitle="Platform administrator tools" />
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-[13px] text-muted">
            <span>Restore every organization to the seeded demonstration data.</span>
            <Button
              variant="danger"
              icon={<RotateCcw className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: "Reset all demo data?", body: "Every organization, device state, automation and log returns to the original seed. You'll be signed out.", confirmLabel: "Reset", danger: true }))) return;
                await api("/api/demo/reset", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
            >
              Reset demo data
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Saved on this device" />
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {(["dark", "light"] as const).map((t) => (
          <button key={t} onClick={() => setTheme(t)} aria-pressed={theme === t} className={`focus-ring rounded-2xl border p-4 text-left transition ${theme === t ? "border-[var(--mint)]" : "border-line hover:border-line-strong"}`}>
            <div className={`mb-3 h-20 rounded-xl border border-line ${t === "dark" ? "bg-[#0b1118]" : "bg-[#f2f5f8]"}`}>
              <div className={`m-3 h-3 w-16 rounded ${t === "dark" ? "bg-[#22323f]" : "bg-white"}`} />
              <div className="mx-3 h-3 w-10 rounded bg-[#69e3c0]" />
            </div>
            <div className="flex items-center gap-2 text-[13.5px] font-medium">
              {t === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />} {t === "dark" ? "Midnight (dark)" : "Daylight (light)"}
            </div>
          </button>
        ))}
        <p className="text-[12px] text-faint sm:col-span-2">Animations follow your system&apos;s reduced-motion setting.</p>
      </div>
    </Card>
  );
}
