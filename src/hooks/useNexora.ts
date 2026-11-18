"use client";
import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { api, fetcher } from "@/lib/api";
import { applyLocal } from "@/lib/local";
import type { Device, DeviceCommand, Floor, Permission, Room } from "@/lib/types";
import type { bootstrap } from "@/server/services/org";
import { useToast } from "@/components/ui/feedback";

export type Bootstrap = ReturnType<typeof bootstrap>;
export const BOOT_KEY = "/api/bootstrap";

/** Live, tenant-scoped snapshot of the active property. Polls for state pushed by automations. */
export function useBootstrap() {
  const swr = useSWR<Bootstrap>(BOOT_KEY, fetcher, { refreshInterval: 4000, revalidateOnFocus: true, keepPreviousData: true });
  const data = swr.data;
  const derived = useMemo(() => {
    if (!data) return null;
    const property = data.properties.find((p) => p.id === data.propertyId) ?? null;
    const roomById = new Map(data.rooms.map((r) => [r.id, r]));
    const floorById = new Map(data.floors.map((f) => [f.id, f]));
    const devicesByRoom = new Map<string, Device[]>();
    for (const d of data.devices) devicesByRoom.set(d.roomId, [...(devicesByRoom.get(d.roomId) ?? []), d]);
    const can = (p: Permission) => data.permissions.includes(p);
    return { property, roomById, floorById, devicesByRoom, can };
  }, [data]);
  return { ...swr, data, ...(derived ?? { property: null, roomById: new Map<string, Room>(), floorById: new Map<string, Floor>(), devicesByRoom: new Map<string, Device[]>(), can: () => false }) };
}

/**
 * Sends a device command with an optimistic update. If the provider rejects the command
 * (offline, timeout, unsupported) the UI rolls back to the confirmed state and explains why.
 */
export function useDeviceCommand() {
  const { mutate } = useSWRConfig();
  const toast = useToast();
  return useCallback(
    async (device: Device, command: DeviceCommand, opts: { quiet?: boolean } = {}) => {
      const optimistic = (b: Bootstrap | undefined) => ({ ...(b as Bootstrap), devices: (b?.devices ?? []).map((d) => (d.id === device.id ? { ...d, state: applyLocal(d, command) } : d)) });
      try {
        await mutate<Bootstrap>(
          BOOT_KEY,
          async (current) => {
            const updated = await api<Device>(`/api/devices/${device.id}/command`, { body: command });
            return current ? { ...current, devices: current.devices.map((d) => (d.id === updated.id ? updated : d)) } : current;
          },
          { optimisticData: optimistic, rollbackOnError: true, revalidate: false, populateCache: true },
        );
        void mutate(`/api/devices/${device.id}`);
        return true;
      } catch (e) {
        if (!opts.quiet) toast({ tone: "error", title: `Couldn't control ${device.name}`, body: (e as Error).message });
        void mutate(BOOT_KEY);
        return false;
      }
    },
    [mutate, toast],
  );
}

export function useRefresh() {
  const { mutate } = useSWRConfig();
  return useCallback(() => mutate(() => true, undefined, { revalidate: true }), [mutate]);
}
