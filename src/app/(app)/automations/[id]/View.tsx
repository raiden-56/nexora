"use client";
import { useRouteId } from "@/lib/routes";
import { AutomationEditor } from "@/components/automation/AutomationEditor";

export default function AutomationPageView() {
  const id = useRouteId();
  return <AutomationEditor key={id} id={id} />;
}
