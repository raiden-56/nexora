"use client";
import { useState } from "react";
import useSWR from "swr";
import { Check, Mail, Minus, Trash2, UserPlus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/controls";
import { useConfirm, useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, PageHeader, Skeleton } from "@/components/ui/surface";
import { useSession } from "@/components/shell/SessionContext";
import { useBootstrap } from "@/hooks/useNexora";
import { api, fetcher } from "@/lib/api";
import type { MembersView } from "@/lib/apiTypes";
import { relTime } from "@/lib/format";
import { ALL_PERMISSIONS, assignableRoles, ROLES } from "@/lib/rbac";
import type { RoleKey } from "@/lib/types";

export default function UsersPage() {
  const { data: boot, can } = useBootstrap();
  const session = useSession();
  const { data, mutate } = useSWR<MembersView>("/api/members", fetcher);
  const [inviting, setInviting] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  if (!data || !boot) return <Skeleton className="h-96" />;
  const canInvite = can("users.invite");
  const roles = assignableRoles(boot.role);
  const propName = (ids: string[] | null) => (ids === null ? "All properties" : ids.map((id) => boot.properties.find((p) => p.id === id)?.name ?? "Other property").join(", ") || "No properties");

  const changeRole = async (memberId: string, role: RoleKey) => {
    try {
      await api(`/api/members/${memberId}`, { method: "PATCH", body: { role } });
      await mutate();
      toast({ tone: "success", title: `Role changed to ${ROLES[role].label}` });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't change role", body: (e as Error).message });
      void mutate();
    }
  };
  const remove = async (memberId: string, name: string) => {
    if (!(await confirm({ title: `Remove ${name}?`, body: "They immediately lose access to this organization and its devices.", confirmLabel: "Remove member", danger: true }))) return;
    try {
      await api(`/api/members/${memberId}`, { method: "DELETE" });
      await mutate();
      toast({ tone: "success", title: `${name} removed` });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't remove", body: (e as Error).message });
    }
  };
  const revoke = async (id: string, email: string) => {
    try {
      await api(`/api/invitations/${id}`, { method: "DELETE" });
      await mutate();
      toast({ tone: "success", title: `Invitation to ${email} revoked` });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't revoke", body: (e as Error).message });
    }
  };

  return (
    <div>
      <PageHeader eyebrow={boot.org.name} title="Users & Permissions" description="Role-based access, scoped per property. Every change is written to the audit log." actions={canInvite && <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>Invite member</Button>} />

      <Card className="mb-6 overflow-hidden">
        <CardHeader title={`Members · ${data.members.length}`} />
        <div className="mt-3 hidden border-t border-line md:block">
          <table className="w-full text-left text-[13px]">
            <thead className="text-eyebrow">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-semibold">Member</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Access</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {data.members.map((m) => {
                const self = m.userId === session.user.id;
                const editable = canInvite && !self && roles.includes(m.role);
                return (
                  <tr key={m.id}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-[12px] font-bold">{m.user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                        <div>
                          <div className="font-medium">{m.user?.name} {self && <span className="text-faint">(you)</span>}</div>
                          <div className="text-[12px] text-faint">{m.user?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {editable ? (
                        <Select aria-label="Role" className="h-9 w-52" value={m.role} onChange={(e) => changeRole(m.id, e.target.value as RoleKey)}>
                          {roles.map((r) => (
                            <option key={r} value={r}>{ROLES[r].label}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone={m.role === "owner" ? "mint" : "neutral"}>{ROLES[m.role].label}</Badge>
                      )}
                    </td>
                    <td className="max-w-[240px] truncate px-5 py-3.5 text-text-2">{propName(m.propertyIds)}</td>
                    <td className="px-5 py-3.5 text-faint">{relTime(m.createdAt)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {editable && (
                        <IconButton label={`Remove ${m.user?.name}`} className="hover:text-err" onClick={() => remove(m.id, m.user?.name ?? "member")}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 divide-y divide-[var(--line)] border-t border-line md:hidden">
          {data.members.map((m) => {
            const self = m.userId === session.user.id;
            const editable = canInvite && !self && roles.includes(m.role);
            return (
              <li key={m.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-[12px] font-bold">{m.user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{m.user?.name} {self && <span className="text-faint">(you)</span>}</div>
                    <div className="truncate text-[12px] text-faint">{m.user?.email} · {propName(m.propertyIds)}</div>
                  </div>
                  {editable && (
                    <IconButton label="Remove" onClick={() => remove(m.id, m.user?.name ?? "member")}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>
                {editable ? (
                  <Select aria-label="Role" className="h-10" value={m.role} onChange={(e) => changeRole(m.id, e.target.value as RoleKey)}>
                    {roles.map((r) => (
                      <option key={r} value={r}>{ROLES[r].label}</option>
                    ))}
                  </Select>
                ) : (
                  <Badge tone={m.role === "owner" ? "mint" : "neutral"}>{ROLES[m.role].label}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {data.invitations.length > 0 && (
        <Card className="mb-6">
          <CardHeader title={`Pending invitations · ${data.invitations.length}`} subtitle="Accepted automatically when the person registers with this email" />
          <ul className="divide-y divide-[var(--line)] p-2">
            {data.invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-3">
                <Mail className="size-4 shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium">{i.email}</div>
                  <div className="truncate text-[12px] text-faint">{ROLES[i.role].label} · {propName(i.propertyIds)} · sent {relTime(i.createdAt)}</div>
                </div>
                {canInvite && <Button size="sm" variant="ghost" onClick={() => revoke(i.id, i.email)}>Revoke</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Role permissions" subtitle="What each role can do. Access can additionally be limited to specific properties." />
        <div className="mt-3 overflow-x-auto border-t border-line">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line">
                <th className="sticky left-0 bg-surface px-5 py-3 text-left font-semibold text-text-2">Permission</th>
                {(Object.keys(ROLES) as RoleKey[]).map((r) => (
                  <th key={r} className="px-2 py-3 text-center text-[11.5px] font-semibold text-muted">{ROLES[r].label.replace("Organization ", "")}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {ALL_PERMISSIONS.map((p) => (
                <tr key={p.key}>
                  <td className="sticky left-0 bg-surface px-5 py-2.5">
                    <div className="font-medium">{p.label}</div>
                    <div className="text-[11.5px] text-faint">{p.description}</div>
                  </td>
                  {(Object.keys(ROLES) as RoleKey[]).map((r) => (
                    <td key={r} className="px-2 py-2.5 text-center">
                      {ROLES[r].permissions.includes(p.key) ? <Check className="mx-auto size-4 text-mint" /> : <Minus className="mx-auto size-4 text-faint opacity-40" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {inviting && <InviteModal onClose={() => setInviting(false)} roles={roles} properties={boot.properties} onDone={() => mutate()} />}
    </div>
  );
}

function InviteModal({ onClose, roles, properties, onDone }: { onClose: () => void; roles: RoleKey[]; properties: { id: string; name: string }[]; onDone: () => Promise<unknown> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleKey>(roles.includes("resident") ? "resident" : roles[0]);
  const [all, setAll] = useState(true);
  const [props, setProps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const send = async () => {
    setSaving(true);
    try {
      await api("/api/invitations", { body: { email, role, propertyIds: all ? null : props } });
      await onDone();
      toast({ tone: "success", title: `Invitation created for ${email}`, body: "They get access when they sign up with this email." });
      onClose();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't invite", body: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Invite a member" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!email.includes("@") || (!all && !props.length)} onClick={send}>Send invitation</Button></>}>
      <div className="space-y-4">
        <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />}</Field>
        <Field label="Role" hint={ROLES[role].description}>
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as RoleKey)}>
              {roles.map((r) => (
                <option key={r} value={r}>{ROLES[r].label}</option>
              ))}
            </Select>
          )}
        </Field>
        <div className="space-y-2">
          <div className="text-[13px] font-medium text-text-2">Property access</div>
          <label className="flex items-center gap-2.5 text-[13px]">
            <Checkbox label="All properties" checked={all} onChange={setAll} /> All properties (including future ones)
          </label>
          {!all &&
            properties.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5 pl-1 text-[13px]">
                <Checkbox label={p.name} checked={props.includes(p.id)} onChange={(v) => setProps(v ? [...props, p.id] : props.filter((x) => x !== p.id))} /> {p.name}
              </label>
            ))}
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-[12px] text-muted">
          <X className="mt-0.5 size-3.5 shrink-0 text-faint" /> Email delivery isn&apos;t configured in this environment — share the sign-up link with them directly.
        </div>
      </div>
    </Modal>
  );
}
