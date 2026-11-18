"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import { OrgTypePicker, PropertyWizard, type PropertyDraft } from "@/components/property/PropertyWizard";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/controls";
import { useToast } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import type { OrgType } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [stage, setStage] = useState<"org" | "property">("org");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("residential");
  const [submitting, setSubmitting] = useState(false);

  const create = async (property: PropertyDraft) => {
    setSubmitting(true);
    try {
      await api("/api/onboarding", { body: { orgName, orgType, property } });
      toast({ tone: "success", title: `${orgName} is ready`, body: `${property.name} was created with ${property.floors.length} floors.` });
      router.push("/overview");
      router.refresh();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't finish setup", body: (e as Error).message });
      setSubmitting(false);
    }
  };

  return (
    <div className="ambient min-h-dvh px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <Link href="/overview" className="text-[13px] text-muted hover:text-text">
          Skip for now
        </Link>
      </div>
      <div className="mx-auto mt-10 max-w-3xl sm:mt-16">
        <div className="text-eyebrow">{stage === "org" ? "Step 1 of 2" : "Step 2 of 2"}</div>
        <h1 className="text-display mt-2 text-[28px] sm:text-[34px]">{stage === "org" ? "Set up your organization" : "Add your first property"}</h1>
        <p className="mt-2 text-[14px] text-muted">
          {stage === "org" ? "Each organization is an isolated workspace with its own properties, members, integrations and automation policies." : "Properties hold buildings, floors, rooms and devices."}
        </p>
        <div className="card mt-8 p-5 sm:p-8">
          {stage === "org" ? (
            <div className="space-y-6">
              <Field label="Organization name">{(id) => <Input id={id} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Sharma Family, Orbit Hotels, Atlas Corp…" />}</Field>
              <div>
                <div className="mb-2 text-[13px] font-medium text-text-2">What will you manage?</div>
                <OrgTypePicker value={orgType} onChange={setOrgType} />
              </div>
              <div className="flex justify-end">
                <Button variant="primary" disabled={orgName.trim().length < 2} onClick={() => setStage("property")}>
                  Continue <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : (
            <PropertyWizard key={orgType} orgType={orgType} onSubmit={create} submitting={submitting} onBackFromFirst={() => setStage("org")} />
          )}
        </div>
      </div>
    </div>
  );
}
