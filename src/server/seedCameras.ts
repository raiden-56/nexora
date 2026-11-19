import { DEVICE_CATALOG } from "@/lib/devices";
import type { CameraLayout, Device } from "@/lib/types";
import type { Database } from "./db";
import { id } from "./util";

/**
 * Simulated CCTV cameras for the demo properties, plus a few saved camera views.
 * Used by the seed and by the v1 → v2 data migration, so existing demo data gains cameras too.
 * Properties that aren't part of the demo (or already have cameras) are left alone.
 */
const PLAN: Record<string, { cameras: [room: string, name: string, extra?: Partial<Device>][]; views: [name: string, layout: CameraLayout, cameras: string[]][] }> = {
  "Nexora Residence": {
    cameras: [
      ["Living Room", "Front Door Camera"],
      ["Living Room", "Living Room Camera"],
      ["Kitchen", "Kitchen Camera"],
      ["Balcony", "Balcony Camera"],
    ],
    views: [["Entrances", 4, ["Front Door Camera", "Balcony Camera"]]],
  },
  "Goa Beach Villa": {
    cameras: [
      ["Sea View Lounge", "Villa Entrance Camera"],
      ["Sea View Lounge", "Lounge Camera"],
      ["Pool Deck", "Pool Deck Camera"],
    ],
    views: [],
  },
  "Aurelia Grand Mumbai": {
    cameras: [
      ["Grand Lobby", "Porte-Cochère Entrance"],
      ["Grand Lobby", "Lobby Reception Desk"],
      ["Grand Lobby", "Lobby Lounge"],
      ["Saffron Restaurant", "Restaurant Floor"],
      ["Floor 2 Corridor", "Floor 2 Corridor Camera"],
      ["Floor 3 Corridor", "Floor 3 Corridor Camera"],
    ],
    views: [
      ["Lobby & dining", 4, ["Porte-Cochère Entrance", "Lobby Reception Desk", "Lobby Lounge", "Restaurant Floor"]],
      ["Guest floors", 4, ["Floor 2 Corridor Camera", "Floor 3 Corridor Camera"]],
    ],
  },
  "Helix HQ Pune": {
    cameras: [
      ["Reception", "Main Entrance Camera"],
      ["Reception", "Reception Camera"],
      ["Cafeteria", "Cafeteria Camera", { online: false }],
      ["Engineering Bay", "Engineering Bay Camera"],
      ["Server Room", "Server Room Camera"],
    ],
    views: [["Security desk", 4, ["Main Entrance Camera", "Server Room Camera", "Reception Camera", "Engineering Bay Camera"]]],
  },
};

export function addDemoCameras(d: Database) {
  const now = Date.now();
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const cat = DEVICE_CATALOG.camera;
  for (const property of d.properties) {
    const plan = PLAN[property.name];
    if (!plan || d.devices.some((x) => x.propertyId === property.id && x.type === "camera")) continue;
    const byName = new Map<string, Device>();
    plan.cameras.forEach(([roomName, name, extra], i) => {
      const room = d.rooms.find((r) => r.propertyId === property.id && r.name === roomName);
      if (!room) return;
      const cam: Device = {
        id: id("dev_"),
        orgId: property.orgId,
        propertyId: property.id,
        roomId: room.id,
        name,
        type: "camera",
        provider: "simulated",
        externalId: "sim-" + id(),
        integrationId: null,
        capabilities: [...cat.capabilities],
        state: { ...cat.defaults },
        online: true,
        // Security system: protected from bulk actions and automatic switch-off.
        essential: true,
        ratedWatts: cat.watts,
        lastSeenAt: ago(extra?.online === false ? 140 : 0),
        firmware: "5.7." + (i % 4),
        model: i % 2 ? "Sentinel Dome 4MP" : "Sentinel Bullet 4MP",
        manufacturer: "Nexora Labs (simulated)",
        createdAt: ago(60 * 24 * 60),
        marker: { x: 0.15 + ((i * 0.37) % 0.7), y: 0.2 },
        ...extra,
      };
      d.devices.push(cam);
      byName.set(name, cam);
    });
    const owner = d.memberships.find((m) => m.orgId === property.orgId && m.role === "owner");
    for (const [name, layout, cams] of plan.views) {
      d.cameraViews.push({
        id: id("cvw_"),
        orgId: property.orgId,
        propertyId: property.id,
        name,
        layout,
        cameraIds: cams.map((n) => byName.get(n)?.id).filter((x): x is string => !!x),
        createdBy: owner?.userId ?? "",
        createdAt: ago(60 * 24 * 20),
      });
    }
  }
}
