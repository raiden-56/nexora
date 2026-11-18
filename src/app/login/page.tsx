"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { api } from "@/lib/api";

// Demo account from the seed data (src/server/seed.ts) — documented in README.
const DEMO = { email: "demo@nexora.app", password: "NexoraDemo#2026" };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (creds = { email, password }) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ hasOrg: boolean }>("/api/auth/login", { body: creds });
      router.push(r.hasOrg ? "/overview" : "/onboarding");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to manage your connected spaces.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Work or personal email">{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />}</Field>
        <Field label="Password">
          {(id) => (
            <div className="relative">
              <Input id={id} type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-11" />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-faint hover:text-text">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        {error && <div className="rounded-xl bg-[color-mix(in_srgb,var(--err)_12%,transparent)] px-3.5 py-2.5 text-[13px] text-err">{error}</div>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading} icon={!loading ? <ArrowRight className="size-4" /> : undefined}>
          Sign in
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-[11px] text-faint">
        <span className="h-px flex-1 bg-line" /> or explore the product <span className="h-px flex-1 bg-line" />
      </div>
      <button
        onClick={() => {
          setEmail(DEMO.email);
          setPassword(DEMO.password);
          void submit(DEMO);
        }}
        disabled={loading}
        className="focus-ring group flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface/60 p-4 text-left transition hover:border-[var(--violet)] disabled:opacity-50"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--violet)_15%,transparent)] text-violet">
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">Open the demo workspace</span>
          <span className="block text-[12px] text-muted">A home, a hotel and an office — all simulated hardware</span>
        </span>
        <ArrowRight className="size-4 text-faint transition group-hover:translate-x-0.5" />
      </button>
      <p className="mt-8 text-center text-[13px] text-muted">
        New to Nexora?{" "}
        <Link href="/register" className="font-semibold text-mint hover:underline">
          Create an account
        </Link>
      </p>
    </AuthFrame>
  );
}
