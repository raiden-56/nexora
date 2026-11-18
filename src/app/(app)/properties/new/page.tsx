"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { ArrowLeft } from "lucide-react";
import { PropertyWizard, type PropertyDraft } from "@/components/property/PropertyWizard";
import { useToast } from "@/components/ui/feedback";
import { Card, PageHeader, Skeleton } from "@/components/ui/surface";
import { useBootstrap } from "@/hooks/useNexora";
import { api } from "@/lib/api";

export default function NewPropertyPage() {
  const { data, can } = useBootstrap();
  const router = useRouter();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  if (!data) return <Skeleton className="h-96" />;
  if (!can("properties.manage")) return <p className="text-muted">Your role can&apos;t create properties.</p>;

  const create = async (d: PropertyDraft) => {
    setSubmitting(true);
    try {
      await api("/api/properties", { body: d });
      await mutate(() => true, undefined, { revalidate: true });
      toast({ tone: "success", title: `${d.name} created`, body: "It's now your active property." });
      router.push("/rooms");
    } catch (e) {
      toast({ tone: "error", title: "Couldn't create property", body: (e as Error).message });
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/properties" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-text">
        <ArrowLeft className="size-4" /> Properties
      </Link>
      <PageHeader eyebrow={data.org.name} title="Add a property" description="Set the timezone carefully — every schedule for this property runs on its local time." />
      <Card className="p-5 sm:p-8">
        <PropertyWizard orgType={data.org.type} onSubmit={create} submitting={submitting} />
      </Card>
    </div>
  );
}
