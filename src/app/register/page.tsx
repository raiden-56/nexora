"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rules = [
    { ok: form.password.length >= 10, label: "10+ characters" },
    { ok: /[A-Za-z]/.test(form.password), label: "A letter" },
    { ok: /\d/.test(form.password), label: "A number" },
  ];

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ hasOrg: boolean }>("/api/auth/register", { body: form });
      router.push(r.hasOrg ? "/overview" : "/onboarding");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Create your account" subtitle="Start with one room or a hundred buildings.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Full name">{(id) => <Input id={id} autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Priya Sharma" />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />}</Field>
        <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="new-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}</Field>
        <div className="flex flex-wrap gap-2">
          {rules.map((r) => (
            <span key={r.label} className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] transition", r.ok ? "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok" : "bg-surface-2 text-faint")}>
              <Check className="size-3" /> {r.label}
            </span>
          ))}
        </div>
        {error && <div className="rounded-xl bg-[color-mix(in_srgb,var(--err)_12%,transparent)] px-3.5 py-2.5 text-[13px] text-err">{error}</div>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} disabled={!rules.every((r) => r.ok)} icon={!loading ? <ArrowRight className="size-4" /> : undefined}>
          Create account
        </Button>
        <p className="text-center text-[11.5px] text-faint">If you were invited, your organization access is added automatically.</p>
      </form>
      <p className="mt-8 text-center text-[13px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-mint hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
