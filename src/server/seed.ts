import type {
  Automation,
  Device,
  DeviceType,
  Execution,
  Floor,
  Membership,
  Notification,
  Organization,
  Property,
  Room,
  RoomKind,
  Scene,
  ActivityLog,
} from "@/lib/types";
import { DEVICE_CATALOG } from "@/lib/devices";
import type { Database, StoredUser } from "./db";
import { hashPassword, id } from "./util";

/** Demo credentials — also documented in README and .env.example. */
export const DEMO_EMAIL = "demo@nexora.app";
export const DEMO_PASSWORD = "NexoraDemo#2026";

const MANUFACTURERS: Partial<Record<DeviceType, [string, string]>> = {
  switch: ["Nexora Labs", "NX-SW2 Touch Switch"],
  plug: ["Nexora Labs", "NX-PL16 Smart Plug"],
  relay: ["Nexora Labs", "NX-R1 DIN Relay"],
  bulb: ["Nexora Labs", "Lumen A60 Tunable"],
  led_strip: ["Nexora Labs", "Lumen Flex RGB"],
  fan: ["Nexora Labs", "Aero BLDC 1200"],
  ac: ["Nexora Labs", "Climate IR Bridge"],
  thermostat: ["Nexora Labs", "Therma T2"],
  ventilation: ["Nexora Labs", "Aero Vent 150"],
  curtain: ["Nexora Labs", "Glide Curtain Motor"],
  blind: ["Nexora Labs", "Glide Roller Blind"],
  lock: ["Nexora Labs", "Vault Deadbolt"],
  motion_sensor: ["Nexora Labs", "Sense PIR"],
  door_sensor: ["Nexora Labs", "Sense Contact"],
  temp_sensor: ["Nexora Labs", "Sense Climate"],
  appliance: ["Nexora Labs", "Appliance Link"],
};

export function createSeed(): Database {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const ago = (min: number) => iso(new Date(now.getTime() - min * 60_000));

  const users: StoredUser[] = [];
  const addUser = (name: string, email: string, password: string, extra: Partial<StoredUser> = {}) => {
    const { hash, salt } = hashPassword(password);
    const u: StoredUser = { id: id("usr_"), name, email, passwordHash: hash, salt, createdAt: ago(60 * 24 * 90), mfaEnabled: false, ...extra };
    users.push(u);
    return u;
  };
  const demo = addUser("Aarav Mehta", DEMO_EMAIL, DEMO_PASSWORD, { isSuperAdmin: true });
  const ananya = addUser("Ananya Mehta", "ananya@mehta.family", "ResidentPass#1");
  const kabir = addUser("Kabir Rao", "kabir.rao@aureliahotels.com", "StaffPass#1");
  const leena = addUser("Leena D'Souza", "leena@aureliahotels.com", "ManagerPass#1");
  const vikram = addUser("Vikram Shah", "vikram.shah@helix.tech", "FacilityPass#1");

  const orgs: Organization[] = [];
  const memberships: Membership[] = [];
  const properties: Property[] = [];
  const buildings: Database["buildings"] = [];
  const floors: Floor[] = [];
  const rooms: Room[] = [];
  const devices: Device[] = [];
  const automations: Automation[] = [];
  const scenes: Scene[] = [];
  const executions: Execution[] = [];
  const notifications: Notification[] = [];
  const activity: ActivityLog[] = [];

  const org = (name: string, type: Organization["type"], plan: Organization["plan"]) => {
    const o: Organization = { id: id("org_"), name, type, plan, createdAt: ago(60 * 24 * 120) };
    orgs.push(o);
    return o;
  };
  const member = (o: Organization, u: StoredUser, role: Membership["role"], propertyIds: string[] | null = null) =>
    memberships.push({ id: id("mem_"), orgId: o.id, userId: u.id, role, propertyIds, createdAt: ago(60 * 24 * 60) });

  const property = (o: Organization, p: Omit<Property, "id" | "orgId" | "createdAt" | "mode">) => {
    const prop: Property = { ...p, id: id("prp_"), orgId: o.id, mode: "home", createdAt: ago(60 * 24 * 100) };
    properties.push(prop);
    const b = { id: id("bld_"), orgId: o.id, propertyId: prop.id, name: "Main building" };
    buildings.push(b);
    return { prop, building: b };
  };

  const floor = (prop: Property, buildingId: string, name: string, order: number) => {
    const f: Floor = { id: id("flr_"), orgId: prop.orgId, propertyId: prop.id, buildingId, name, order };
    floors.push(f);
    return f;
  };

  const room = (f: Floor, name: string, kind: RoomKind, plan: Room["plan"], extra: Partial<Room> = {}) => {
    const r: Room = {
      id: id("rm_"),
      orgId: f.orgId,
      propertyId: f.propertyId,
      floorId: f.id,
      name,
      kind,
      order: rooms.filter((x) => x.floorId === f.id).length,
      occupied: false,
      plan,
      ...extra,
    };
    rooms.push(r);
    return r;
  };

  const device = (r: Room, name: string, type: DeviceType, extra: Partial<Device> = {}) => {
    const cat = DEVICE_CATALOG[type];
    const [manufacturer, model] = MANUFACTURERS[type] ?? ["Nexora Labs", "Generic"];
    const d: Device = {
      id: id("dev_"),
      orgId: r.orgId,
      propertyId: r.propertyId,
      roomId: r.id,
      name,
      type,
      provider: "simulated",
      externalId: "sim-" + id(),
      integrationId: null,
      capabilities: [...cat.capabilities],
      state: { ...cat.defaults },
      online: true,
      essential: false,
      ratedWatts: cat.watts,
      lastSeenAt: ago(Math.round(Math.random() * 3)),
      firmware: "2.4." + Math.floor(Math.random() * 9),
      model,
      manufacturer,
      createdAt: ago(60 * 24 * 80),
      marker: { x: 0.2 + Math.random() * 0.6, y: 0.25 + Math.random() * 0.5 },
      ...extra,
    };
    if (extra.state) d.state = { ...cat.defaults, ...extra.state };
    devices.push(d);
    return d;
  };

  // ─── 1. Residential ────────────────────────────────────────
  const mehta = org("Mehta Family", "residential", "residential");
  member(mehta, demo, "owner");
  member(mehta, ananya, "resident");
  const { prop: residence, building: resB } = property(mehta, {
    name: "Nexora Residence",
    kind: "villa",
    address: "14 Palm Grove Road, Indiranagar, Bengaluru",
    timezone: "Asia/Kolkata",
    lat: 12.9784,
    lng: 77.6408,
    tariffPerKwh: 8.5,
    currency: "INR",
  });
  const gf = floor(residence, resB.id, "Ground Floor", 0);
  const ff = floor(residence, resB.id, "First Floor", 1);
  const living = room(gf, "Living Room", "living", { x: 0, y: 0, w: 7, h: 5 }, { occupied: true });
  const kitchen = room(gf, "Kitchen", "kitchen", { x: 7, y: 0, w: 5, h: 4 });
  const dining = room(gf, "Dining Room", "dining", { x: 7, y: 4, w: 5, h: 4 });
  const guestBed = room(gf, "Guest Bedroom", "bedroom", { x: 0, y: 5, w: 7, h: 3 });
  const master = room(ff, "Master Bedroom", "bedroom", { x: 0, y: 0, w: 6, h: 5 });
  const bed2 = room(ff, "Bedroom 2", "bedroom", { x: 6, y: 0, w: 6, h: 4 });
  const study = room(ff, "Study Room", "study", { x: 6, y: 4, w: 6, h: 4 }, { occupied: true });
  const balcony = room(ff, "Balcony", "balcony", { x: 0, y: 5, w: 6, h: 3 });

  const lvMain = device(living, "Ceiling Lights", "bulb", { state: { on: true, brightness: 85, colorTemp: 3500 }, ratedWatts: 36 });
  const lvAmbient = device(living, "Ambient Cove Strip", "led_strip", { state: { on: true, brightness: 40, color: "#7DD9F2" } });
  const lvFan = device(living, "Living Room Fan", "fan", { state: { on: true, speed: 2 } });
  const lvAc = device(living, "Living Room AC", "ac", { state: { on: false, targetTemp: 24, mode: "cool" } });
  const lvCurtain = device(living, "Bay Window Curtains", "curtain", { state: { position: 70 } });
  const lvTv = device(living, "TV & Soundbar", "plug", { state: { on: true }, ratedWatts: 140 });
  const lvMotion = device(living, "Living Motion Sensor", "motion_sensor");
  device(living, "Living Climate Sensor", "temp_sensor", { state: { temperature: 27.4 } });
  device(kitchen, "Kitchen Downlights", "bulb", { state: { on: false, brightness: 100, colorTemp: 4000 }, ratedWatts: 24 });
  device(kitchen, "Chimney Exhaust", "ventilation");
  device(kitchen, "Refrigerator", "appliance", { state: { on: true }, ratedWatts: 160, essential: true });
  device(kitchen, "Water Purifier", "plug", { state: { on: true }, ratedWatts: 40, essential: true });
  device(dining, "Dining Chandelier", "bulb", { state: { on: false, brightness: 70, colorTemp: 2700 }, ratedWatts: 40 });
  device(dining, "Dining Fan", "fan");
  const mainDoor = device(gf.order === 0 ? living : living, "Main Door Lock", "lock", { essential: true });
  const doorSensor = device(living, "Main Door Sensor", "door_sensor", { essential: true });
  device(guestBed, "Guest Room Light", "bulb", { state: { on: false } });
  device(guestBed, "Guest Room AC", "ac", { online: false, lastSeenAt: ago(190) });
  const msLight = device(master, "Master Bedroom Lights", "bulb", { state: { on: false, brightness: 60, colorTemp: 2700 } });
  const msLamp = device(master, "Bedside Lamp", "bulb", { state: { on: false, brightness: 30, colorTemp: 2700 }, ratedWatts: 7 });
  const msAc = device(master, "Master Bedroom AC", "ac", { state: { on: false, targetTemp: 23 } });
  const msFan = device(master, "Master Bedroom Fan", "fan");
  const msBlind = device(master, "Blackout Blinds", "blind", { state: { position: 100 } });
  device(bed2, "Bedroom 2 Lights", "bulb");
  device(bed2, "Bedroom 2 Fan", "fan");
  device(bed2, "Bedroom 2 AC", "ac");
  const stLamp = device(study, "Study Desk Lamp", "bulb", { state: { on: true, brightness: 90, colorTemp: 5000 }, ratedWatts: 10 });
  device(study, "Workstation Plug", "plug", { state: { on: true }, ratedWatts: 220 });
  device(study, "Study Fan", "fan", { state: { on: true, speed: 3 } });
  device(balcony, "Balcony Lights", "switch", { ratedWatts: 30 });
  device(balcony, "Planter Irrigation", "relay", { ratedWatts: 45 });
  device(balcony, "Balcony Fairy Lights", "plug", { online: false, lastSeenAt: ago(60 * 26), ratedWatts: 12 });

  const { prop: villa, building: villaB } = property(mehta, {
    name: "Goa Beach Villa",
    kind: "villa",
    address: "Vagator Beach Road, North Goa",
    timezone: "Asia/Kolkata",
    lat: 15.5994,
    lng: 73.7445,
    tariffPerKwh: 7.2,
    currency: "INR",
  });
  const vf = floor(villa, villaB.id, "Ground Floor", 0);
  const vLiving = room(vf, "Sea View Lounge", "living", { x: 0, y: 0, w: 8, h: 5 });
  const vBed = room(vf, "Villa Bedroom", "bedroom", { x: 8, y: 0, w: 4, h: 5 });
  const vDeck = room(vf, "Pool Deck", "balcony", { x: 0, y: 5, w: 12, h: 3 });
  device(vLiving, "Lounge Lights", "bulb");
  device(vLiving, "Lounge AC", "ac");
  device(vLiving, "Lounge Fan", "fan");
  device(vBed, "Bedroom Lights", "bulb");
  device(vBed, "Bedroom AC", "ac");
  device(vDeck, "Pool Pump", "relay", { ratedWatts: 750 });
  device(vDeck, "Deck Lights", "led_strip", { state: { on: false, color: "#69E3C0", brightness: 70 } });
  device(vLiving, "Villa Front Door", "lock", { essential: true });

  // Residential scenes
  const scene = (p: Property, s: Omit<Scene, "id" | "orgId" | "propertyId" | "createdAt" | "lastActivatedAt">, last?: number) => {
    const sc: Scene = { ...s, id: id("scn_"), orgId: p.orgId, propertyId: p.id, createdAt: ago(60 * 24 * 30), lastActivatedAt: last ? ago(last) : null };
    scenes.push(sc);
    return sc;
  };
  const movie = scene(
    residence,
    {
      name: "Movie Time",
      icon: "clapperboard",
      description: "Dim the living room, close curtains, keep the cove glowing",
      accent: "#8B7CF6",
      actions: [
        { deviceId: lvCurtain.id, command: { position: 0 } },
        { deviceId: lvMain.id, command: { on: false } },
        { deviceId: lvAmbient.id, command: { on: true, brightness: 20, color: "#5B6CFF" } },
        { deviceId: lvTv.id, command: { on: true } },
        { deviceId: lvAc.id, command: { on: true, targetTemp: 24, mode: "cool" } },
      ],
    },
    60 * 20,
  );
  scene(residence, {
    name: "Good Morning",
    icon: "sunrise",
    description: "Open blinds, soft daylight and fresh air",
    accent: "#F2B66D",
    actions: [
      { deviceId: msBlind.id, command: { position: 100 } },
      { deviceId: msLight.id, command: { on: true, brightness: 50, colorTemp: 4500 } },
      { deviceId: lvCurtain.id, command: { position: 100 } },
      { deviceId: msAc.id, command: { on: false } },
    ],
  }, 60 * 9);
  const goodNight = scene(residence, {
    name: "Good Night",
    icon: "moon",
    description: "Everything off downstairs, bedroom at 23°C, door locked",
    accent: "#7DD9F2",
    actions: [
      { deviceId: lvMain.id, command: { on: false } },
      { deviceId: lvAmbient.id, command: { on: false } },
      { deviceId: lvTv.id, command: { on: false } },
      { deviceId: lvFan.id, command: { on: false } },
      { deviceId: mainDoor.id, command: { locked: true } },
      { deviceId: msLamp.id, command: { on: true, brightness: 10 } },
      { deviceId: msAc.id, command: { on: true, targetTemp: 23, mode: "cool" } },
    ],
  }, 60 * 14);
  scene(residence, {
    name: "Reading Mode",
    icon: "book-open",
    description: "Focused neutral light in the study",
    accent: "#69E3C0",
    actions: [
      { deviceId: stLamp.id, command: { on: true, brightness: 100, colorTemp: 5000 } },
    ],
  });
  scene(residence, {
    name: "Away Mode",
    icon: "plane",
    description: "Switch off non-essential loads and lock up",
    accent: "#8BA8C4",
    actions: [
      { deviceId: lvMain.id, command: { on: false } },
      { deviceId: lvAmbient.id, command: { on: false } },
      { deviceId: lvFan.id, command: { on: false } },
      { deviceId: lvAc.id, command: { on: false } },
      { deviceId: lvTv.id, command: { on: false } },
      { deviceId: stLamp.id, command: { on: false } },
      { deviceId: mainDoor.id, command: { locked: true } },
    ],
  });
  scene(residence, {
    name: "Dinner Mode",
    icon: "utensils",
    description: "Warm dining light and a quieter living room",
    accent: "#F2B66D",
    actions: [
      { deviceId: lvMain.id, command: { on: true, brightness: 45, colorTemp: 2700 } },
      { deviceId: lvAmbient.id, command: { on: true, brightness: 35, color: "#F2B66D" } },
    ],
  });

  const automation = (p: Property, a: Partial<Automation> & Pick<Automation, "name" | "trigger" | "actions">) => {
    const au: Automation = {
      id: id("aut_"),
      orgId: p.orgId,
      propertyId: p.id,
      description: "",
      enabled: true,
      conditions: [],
      end: null,
      onUnreachable: "retry_then_notify",
      createdAt: ago(60 * 24 * 20),
      updatedAt: ago(60 * 24 * 2),
      lastRunAt: null,
      lastStatus: null,
      ...a,
    };
    automations.push(au);
    return au;
  };

  const evening = automation(residence, {
    name: "Evening Comfort",
    description: "Welcoming living room every evening, cooled only when someone is home",
    trigger: { type: "time", time: "18:30", days: [0, 1, 2, 3, 4, 5, 6] },
    actions: [
      { type: "device", deviceId: lvMain.id, command: { on: true, brightness: 80 } },
      { type: "device", deviceId: lvFan.id, command: { on: true, speed: 2 } },
      { type: "device", deviceId: lvAmbient.id, command: { on: true, brightness: 40 } },
      { type: "device", deviceId: lvAc.id, command: { on: true, targetTemp: 24, mode: "cool" }, conditions: [{ type: "room_occupied", roomId: living.id }] },
    ],
    end: { time: "23:00" },
    lastRunAt: ago(60 * 20),
    lastStatus: "success",
  });
  automation(residence, {
    name: "Sunset Curtains",
    description: "Close the bay window curtains 15 minutes after sunset",
    trigger: { type: "sunset", offsetMin: 15, days: [0, 1, 2, 3, 4, 5, 6] },
    actions: [{ type: "device", deviceId: lvCurtain.id, command: { position: 0 } }],
    lastRunAt: ago(60 * 19),
    lastStatus: "success",
  });
  automation(residence, {
    name: "Night Lock-up",
    description: "Run Good Night at 11:30 PM on weeknights",
    trigger: { type: "time", time: "23:30", days: [0, 1, 2, 3, 4] },
    actions: [{ type: "scene", sceneId: goodNight.id }, { type: "notify", message: "Good Night scene ran — main door locked." }],
    lastRunAt: ago(60 * 14),
    lastStatus: "partial",
  });
  automation(residence, {
    name: "Motion Hallway Light",
    description: "When motion is detected in the living room after dark, bring the cove strip up",
    trigger: { type: "device_state", deviceId: lvMotion.id, key: "motion", equals: true },
    conditions: [{ type: "property_mode", mode: "home" }],
    actions: [{ type: "device", deviceId: lvAmbient.id, command: { on: true, brightness: 30 } }],
  });
  automation(residence, {
    name: "Door Left Open Alert",
    description: "Notify when the main door opens while the home is set to Away",
    trigger: { type: "device_state", deviceId: doorSensor.id, key: "contact", equals: "open" },
    conditions: [{ type: "property_mode", mode: "away" }],
    actions: [{ type: "notify", message: "Main door opened while Nexora Residence is in Away mode." }],
    enabled: true,
  });
  automation(residence, {
    name: "Weekend Movie Night",
    description: "Saturday 8:30 PM — trigger Movie Time",
    trigger: { type: "time", time: "20:30", days: [6] },
    actions: [{ type: "scene", sceneId: movie.id }],
    enabled: false,
  });

  // ─── 2. Hospitality ────────────────────────────────────────
  const aurelia = org("Aurelia Hotels", "hospitality", "enterprise");
  member(aurelia, demo, "owner");
  member(aurelia, leena, "hotel_manager");
  member(aurelia, kabir, "staff");
  const { prop: grand, building: grandB } = property(aurelia, {
    name: "Aurelia Grand Mumbai",
    kind: "hotel",
    address: "Marine Drive, Churchgate, Mumbai",
    timezone: "Asia/Kolkata",
    lat: 18.9432,
    lng: 72.8236,
    tariffPerKwh: 11.2,
    currency: "INR",
  });
  const lobbyF = floor(grand, grandB.id, "Lobby Level", 0);
  const lobby = room(lobbyF, "Grand Lobby", "lobby", { x: 0, y: 0, w: 8, h: 8 }, { occupied: true });
  const restaurant = room(lobbyF, "Saffron Restaurant", "dining", { x: 8, y: 0, w: 4, h: 8 }, { occupied: true });
  device(lobby, "Lobby Chandeliers", "bulb", { state: { on: true, brightness: 90, colorTemp: 3000 }, ratedWatts: 240 });
  device(lobby, "Lobby HVAC Zone", "ac", { state: { on: true, targetTemp: 23 }, ratedWatts: 4500 });
  device(lobby, "Entrance Access Control", "lock", { essential: true, state: { locked: false } });
  device(lobby, "Fire Panel Monitor", "relay", { essential: true, state: { on: true }, ratedWatts: 25 });
  device(restaurant, "Restaurant Pendants", "bulb", { state: { on: true, brightness: 70, colorTemp: 2700 }, ratedWatts: 180 });
  device(restaurant, "Kitchen Exhaust", "ventilation", { state: { on: true, speed: 3 }, ratedWatts: 900 });

  const guestNames = ["Priya Natarajan", "James Whitfield", "Sofia Marín", "Hiro Tanaka"];
  for (const lvl of [2, 3]) {
    const f = floor(grand, grandB.id, `Floor ${lvl}`, lvl - 1);
    for (let n = 1; n <= 4; n++) {
      const number = `${lvl}0${n}`;
      const status: Room["hotel"] = lvl === 2 && n <= 2
        ? { status: "occupied", number, guestName: guestNames[n - 1], checkInAt: ago(60 * 30) }
        : lvl === 3 && n === 1
          ? { status: "cleaning", number }
          : lvl === 3 && n === 4
            ? { status: "maintenance", number }
            : { status: "vacant", number };
      const r = room(f, `Room ${number}`, "guest_room", { x: (n - 1) * 3, y: 0, w: 3, h: 5 }, { hotel: status, occupied: status.status === "occupied" });
      const occ = status.status === "occupied";
      device(r, `${number} Main Light`, "bulb", { state: { on: occ, brightness: 70, colorTemp: 3000 } });
      device(r, `${number} Bedside Lamps`, "bulb", { state: { on: occ, brightness: 40, colorTemp: 2700 }, ratedWatts: 14 });
      device(r, `${number} AC`, "ac", { state: { on: occ, targetTemp: 23 }, online: !(lvl === 3 && n === 4), lastSeenAt: lvl === 3 && n === 4 ? ago(300) : ago(1) });
      device(r, `${number} Curtains`, "curtain", { state: { position: occ ? 60 : 0 } });
      device(r, `${number} Door Lock`, "lock", { essential: true });
      device(r, `${number} Minibar`, "appliance", { state: { on: true }, ratedWatts: 80, essential: true });
    }
  }
  const corr = floors.filter((f) => f.propertyId === grand.id && f.order > 0);
  for (const f of corr) {
    const c = room(f, `${f.name} Corridor`, "corridor", { x: 0, y: 5, w: 12, h: 3 });
    device(c, `${f.name} Corridor Lights`, "switch", { state: { on: true }, ratedWatts: 120 });
    device(c, `${f.name} Emergency Lighting`, "relay", { essential: true, state: { on: true }, ratedWatts: 40 });
  }
  scene(grand, { name: "Hotel Welcome", icon: "concierge-bell", description: "Warm lobby lighting for evening arrivals", accent: "#F2B66D", actions: devices.filter((d) => d.roomId === lobby.id && d.type === "bulb").map((d) => ({ deviceId: d.id, command: { on: true, brightness: 100, colorTemp: 3000 } })) });
  scene(grand, { name: "Energy Saving Mode", icon: "leaf", description: "Dim public areas and relax HVAC set-points", accent: "#69E3C0", actions: devices.filter((d) => d.propertyId === grand.id && (d.roomId === lobby.id || d.roomId === restaurant.id) && !d.essential && d.type !== "lock").map((d) => ({ deviceId: d.id, command: d.type === "ac" ? { targetTemp: 25 } : d.type === "bulb" ? { brightness: 55 } : { speed: 2 } })) });
  automation(grand, {
    name: "Late Night Lobby Dimming",
    description: "Lower lobby lights after midnight",
    trigger: { type: "time", time: "00:30", days: [0, 1, 2, 3, 4, 5, 6] },
    actions: devices.filter((d) => d.roomId === lobby.id && d.type === "bulb").map((d) => ({ type: "device" as const, deviceId: d.id, command: { brightness: 45 } })),
    lastRunAt: ago(60 * 12),
    lastStatus: "success",
  });

  // ─── 3. Commercial ─────────────────────────────────────────
  const helix = org("Helix Technologies", "commercial", "business");
  member(helix, demo, "owner");
  member(helix, vikram, "facility_manager");
  const { prop: hq, building: hqB } = property(helix, {
    name: "Helix HQ Pune",
    kind: "office",
    address: "Tower B, EON Free Zone, Kharadi, Pune",
    timezone: "Asia/Kolkata",
    lat: 18.5515,
    lng: 73.9476,
    tariffPerKwh: 9.8,
    currency: "INR",
  });
  const hg = floor(hq, hqB.id, "Ground Floor", 0);
  const h1 = floor(hq, hqB.id, "Floor 1", 1);
  const reception = room(hg, "Reception", "lobby", { x: 0, y: 0, w: 5, h: 8 }, { department: "Admin", occupied: true });
  const cafe = room(hg, "Cafeteria", "dining", { x: 5, y: 0, w: 7, h: 8 }, { department: "Admin" });
  const eng = room(h1, "Engineering Bay", "office", { x: 0, y: 0, w: 7, h: 8 }, { department: "Engineering", occupied: true });
  const orion = room(h1, "Orion Meeting Room", "meeting", { x: 7, y: 0, w: 5, h: 3 }, { department: "Shared", occupied: true });
  const vega = room(h1, "Vega Meeting Room", "meeting", { x: 7, y: 3, w: 5, h: 3 }, { department: "Shared" });
  const server = room(h1, "Server Room", "server", { x: 7, y: 6, w: 5, h: 2 }, { department: "IT" });
  const recLights = device(reception, "Reception Lights", "bulb", { state: { on: true, brightness: 90, colorTemp: 4000 }, ratedWatts: 120 });
  const recAc = device(reception, "Reception AC", "ac", { state: { on: true, targetTemp: 24 }, ratedWatts: 2200 });
  device(reception, "Main Entrance Access", "lock", { essential: true, state: { locked: false } });
  device(cafe, "Cafeteria Lights", "bulb", { ratedWatts: 160 });
  device(cafe, "Coffee Machine", "appliance", { state: { on: true }, ratedWatts: 1400 });
  device(cafe, "Cafeteria AC", "ac", { ratedWatts: 3000 });
  const engLights = device(eng, "Engineering Bay Lights", "bulb", { state: { on: true, brightness: 100, colorTemp: 5000 }, ratedWatts: 400 });
  const engAc = device(eng, "Engineering Bay AC", "ac", { state: { on: true, targetTemp: 23 }, ratedWatts: 5000 });
  const engPlugs = device(eng, "Desk Power Rail", "relay", { state: { on: true }, ratedWatts: 1800 });
  const orLights = device(orion, "Orion Lights", "bulb", { state: { on: true, brightness: 80, colorTemp: 4500 }, ratedWatts: 60 });
  const orAc = device(orion, "Orion AC", "ac", { state: { on: true, targetTemp: 23 } });
  const orProj = device(orion, "Orion Projector", "plug", { state: { on: true }, ratedWatts: 280 });
  const orBlind = device(orion, "Orion Blinds", "blind", { state: { position: 30 } });
  const vgLights = device(vega, "Vega Lights", "bulb", { ratedWatts: 60 });
  const vgAc = device(vega, "Vega AC", "ac");
  device(vega, "Vega Display", "plug", { ratedWatts: 180 });
  device(server, "Server Room Precision AC", "ac", { essential: true, state: { on: true, targetTemp: 19 }, ratedWatts: 3500 });
  device(server, "Server Rack PDU", "relay", { essential: true, state: { on: true }, ratedWatts: 2600 });
  scene(hq, {
    name: "Presentation Mode",
    icon: "presentation",
    description: "Orion: projector on, blinds down, lights dimmed",
    accent: "#7DD9F2",
    actions: [
      { deviceId: orBlind.id, command: { position: 0 } },
      { deviceId: orLights.id, command: { on: true, brightness: 25 } },
      { deviceId: orProj.id, command: { on: true } },
    ],
  });
  scene(hq, {
    name: "Meeting Mode",
    icon: "users",
    description: "Vega ready for a meeting",
    accent: "#69E3C0",
    actions: [
      { deviceId: vgLights.id, command: { on: true, brightness: 85, colorTemp: 4500 } },
      { deviceId: vgAc.id, command: { on: true, targetTemp: 23 } },
    ],
  });
  automation(hq, {
    name: "Workday Start",
    description: "Weekdays 9:00 AM — office lights and designated AC on",
    trigger: { type: "time", time: "09:00", days: [1, 2, 3, 4, 5] },
    actions: [
      { type: "device", deviceId: recLights.id, command: { on: true, brightness: 90 } },
      { type: "device", deviceId: recAc.id, command: { on: true, targetTemp: 24 } },
      { type: "device", deviceId: engLights.id, command: { on: true, brightness: 100 } },
      { type: "device", deviceId: engAc.id, command: { on: true, targetTemp: 23 } },
      { type: "device", deviceId: engPlugs.id, command: { on: true } },
    ],
    end: { time: "19:00" },
    lastRunAt: ago(60 * 6),
    lastStatus: "success",
  });
  automation(hq, {
    name: "Saturday Half Day",
    description: "Saturdays — reduced zone from 10 AM to 2 PM",
    trigger: { type: "time", time: "10:00", days: [6] },
    actions: [{ type: "device", deviceId: engLights.id, command: { on: true, brightness: 70 } }],
    end: { time: "14:00" },
  });
  automation(hq, {
    name: "Orion Idle Shutdown",
    description: "Weeknights 8 PM — switch off meeting room loads",
    trigger: { type: "time", time: "20:00", days: [1, 2, 3, 4, 5] },
    actions: [
      { type: "device", deviceId: orProj.id, command: { on: false } },
      { type: "device", deviceId: orAc.id, command: { on: false } },
      { type: "device", deviceId: orLights.id, command: { on: false } },
    ],
  });

  // ─── History, notifications, activity ──────────────────────
  executions.push(
    { id: id("exe_"), orgId: mehta.id, propertyId: residence.id, automationId: evening.id, sceneId: null, name: "Evening Comfort", phase: "start", status: "success", source: "scheduler", startedAt: ago(60 * 20), finishedAt: ago(60 * 20 - 0.1), steps: [{ label: "Ceiling Lights → Turn on, brightness 80%", status: "success" }, { label: "Living Room Fan → Turn on, speed 2", status: "success" }, { label: "Ambient Cove Strip → Turn on, brightness 40%", status: "success" }, { label: "Living Room AC → Turn on, 24°C, cool mode", status: "skipped", detail: "Condition not met: Living Room is not occupied" }], dedupeKey: "seed-1", userId: null },
    { id: id("exe_"), orgId: mehta.id, propertyId: residence.id, automationId: null, sceneId: goodNight.id, name: "Good Night", phase: "scene", status: "partial", source: "scheduler", startedAt: ago(60 * 14), finishedAt: ago(60 * 14 - 0.1), steps: [{ label: "Ceiling Lights → Turn off", status: "success" }, { label: "Main Door Lock → Lock", status: "success" }, { label: "Guest Room AC → Turn off", status: "failed", detail: "Device unreachable after 3 attempts", attempts: 3 }], dedupeKey: "seed-2", userId: null },
  );

  const notif = (o: Organization, p: Property | null, n: Omit<Notification, "id" | "orgId" | "propertyId" | "read" | "createdAt">, minAgo: number, read = false) =>
    notifications.push({ ...n, id: id("ntf_"), orgId: o.id, propertyId: p?.id ?? null, read, createdAt: ago(minAgo) });
  notif(mehta, residence, { type: "device_offline", severity: "error", title: "Guest Room AC went offline", body: "No response from the IR bridge for 3 hours. Check power or Wi-Fi.", link: "/devices" }, 190);
  notif(mehta, residence, { type: "automation_failed", severity: "warning", title: "Night Lock-up partially failed", body: "1 of 7 actions could not reach Guest Room AC.", link: "/automations" }, 60 * 14);
  notif(mehta, residence, { type: "energy_anomaly", severity: "warning", title: "Workstation Plug drawing more than usual", body: "Study workstation used 38% more energy than its 7-day average.", link: "/energy" }, 60 * 5, true);
  notif(mehta, residence, { type: "automation_executed", severity: "success", title: "Evening Comfort ran", body: "3 actions succeeded, 1 skipped (room not occupied).", link: "/automations" }, 60 * 20, true);
  notif(aurelia, grand, { type: "hotel", severity: "info", title: "Room 301 awaiting housekeeping", body: "Checked out at 11:04 AM. Non-essential loads switched off.", link: "/hotel" }, 95);
  notif(aurelia, grand, { type: "device_offline", severity: "error", title: "304 AC offline", body: "Room 304 is under maintenance. AC controller unreachable.", link: "/hotel" }, 300);
  notif(helix, hq, { type: "integration_disconnected", severity: "warning", title: "Home Assistant not configured", body: "Connect your Home Assistant instance to import real devices.", link: "/integrations" }, 60 * 30, true);

  const act = (o: Organization, p: Property, d: Device, action: string, prev: string, next: string, source: ActivityLog["source"], minAgo: number, user: StoredUser | null = demo) =>
    activity.push({ id: id("act_"), orgId: o.id, propertyId: p.id, userId: user?.id ?? null, userName: user?.name ?? null, deviceId: d.id, deviceName: d.name, action, previous: prev, next, source, automationId: null, at: ago(minAgo) });
  act(mehta, residence, stLamp, "Turned on", "Off", "On · 90%", "user", 42);
  act(mehta, residence, lvTv, "Turned on", "Off", "On", "user", 75, ananya);
  act(mehta, residence, lvAmbient, "Brightness set", "On · 80%", "On · 40%", "automation", 60 * 20, null);
  act(mehta, residence, lvMain, "Turned on", "Off", "On · 80%", "automation", 60 * 20, null);
  act(mehta, residence, mainDoor, "Locked", "Unlocked", "Locked", "scene", 60 * 14, null);
  act(mehta, residence, lvCurtain, "Position set", "Closed", "70% open", "user", 60 * 3);
  act(mehta, residence, msAc, "Turned off", "Cool · 23°C", "Off", "scene", 60 * 9, null);

  return {
    version: 1,
    users,
    sessions: [],
    orgs,
    memberships,
    invitations: [
      { id: id("inv_"), orgId: mehta.id, email: "rohan.mehta@gmail.com", role: "resident", propertyIds: [villa.id], status: "pending", invitedBy: demo.id, createdAt: ago(60 * 24 * 2), token: id("tok_") },
    ],
    properties,
    buildings,
    floors,
    rooms,
    devices,
    stateHistory: [],
    automations,
    executions,
    scenes,
    notifications,
    activity,
    integrations: [
      { id: id("int_"), orgId: mehta.id, provider: "simulated", label: "Nexora Simulator", status: "connected", lastSyncAt: ago(1), createdAt: ago(60 * 24 * 80) },
      { id: id("int_"), orgId: aurelia.id, provider: "simulated", label: "Nexora Simulator", status: "connected", lastSyncAt: ago(1), createdAt: ago(60 * 24 * 80) },
      { id: id("int_"), orgId: helix.id, provider: "simulated", label: "Nexora Simulator", status: "connected", lastSyncAt: ago(1), createdAt: ago(60 * 24 * 80) },
    ],
    meta: { schedulerLastTick: null, seededAt: iso(now) },
  };
}
