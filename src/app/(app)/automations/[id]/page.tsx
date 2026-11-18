"use client";
import { useParams } from "next/navigation";
import { AutomationEditor } from "@/components/automation/AutomationEditor";

export default function AutomationPage() {
  const { id } = useParams<{ id: string }>();
  return <AutomationEditor key={id} id={id} />;
}
