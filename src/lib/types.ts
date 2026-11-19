// Shared domain types — used by both the server services and the web client.
// Nothing in this file may import server-only code.

export type OrgType = "residential" | "commercial" | "hospitality";

export type RoleKey =
  | "owner"
  | "property_manager"
  | "facility_manager"
  | "hotel_manager"
  | "staff"
  | "resident"
  | "guest";

export type Permission =
  | "devices.view"
  | "devices.control"
  | "automations.manage"
  | "scenes.manage"
  | "properties.manage"
  | "users.invite"
  | "analytics.view"
  | "integrations.manage"
  | "billing.manage"
  | "hotel.operate"
  | "cameras.view";

export type ProviderKey = "simulated" | "home_assistant" | "tuya" | "matter" | "mqtt" | "zigbee";

export type DeviceType =
  | "switch"
  | "plug"
  | "relay"
  | "bulb"
  | "led_strip"
  | "fan"
  | "ac"
  | "thermostat"
  | "ventilation"
  | "curtain"
  | "blind"
  | "lock"
  | "motion_sensor"
  | "door_sensor"
  | "temp_sensor"
  | "appliance"
  | "camera";

export type Capability =
  | "onoff"
  | "brightness"
  | "color"
  | "color_temp"
  | "fan_speed"
  | "oscillate"
  | "target_temp"
  | "hvac_mode"
  | "ac_fan"
  | "swing"
  | "position"
  | "lock"
  | "power_meter"
  | "motion"
  | "contact"
  | "temperature"
  | "camera"
  | "recording"
  | "privacy";

export type HvacMode = "cool" | "heat" | "dry" | "fan" | "auto";

export interface DeviceState {
  on?: boolean;
  brightness?: number; // 1-100
  color?: string; // hex
  colorTemp?: number; // kelvin 2700-6500
  speed?: number; // fan 1-5
  oscillate?: boolean;
  targetTemp?: number; // 16-30
  mode?: HvacMode;
  acFan?: "auto" | "low" | "medium" | "high";
  swing?: boolean;
  position?: number; // 0 closed – 100 open
  moving?: "opening" | "closing" | null;
  locked?: boolean;
  motion?: boolean;
  contact?: "open" | "closed";
  temperature?: number; // measured °C
  recording?: boolean; // camera is recording to storage
  privacy?: boolean; // camera lens/stream paused for privacy
}

export type DeviceCommand = Partial<Omit<DeviceState, "motion" | "contact" | "temperature" | "moving">> & {
  stop?: boolean;
};

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  plan: "trial" | "residential" | "business" | "enterprise";
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  mfaEnabled: boolean;
  isSuperAdmin?: boolean;
}

export interface Membership {
  id: string;
  orgId: string;
  userId: string;
  role: RoleKey;
  /** null = all properties in the organization */
  propertyIds: string[] | null;
  createdAt: string;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: RoleKey;
  propertyIds: string[] | null;
  status: "pending" | "accepted" | "revoked";
  invitedBy: string;
  createdAt: string;
  token: string;
}

export type PropertyKind = "home" | "villa" | "apartment" | "office" | "coworking" | "hotel" | "resort" | "warehouse" | "campus";
export type PropertyMode = "home" | "away" | "night" | "vacation";

export interface Property {
  id: string;
  orgId: string;
  name: string;
  kind: PropertyKind;
  address: string;
  timezone: string;
  lat: number;
  lng: number;
  mode: PropertyMode;
  tariffPerKwh: number;
  currency: string;
  createdAt: string;
}

export interface Building {
  id: string;
  orgId: string;
  propertyId: string;
  name: string;
}

export interface Floor {
  id: string;
  orgId: string;
  propertyId: string;
  buildingId: string;
  name: string;
  order: number;
}

export type RoomKind =
  | "living"
  | "kitchen"
  | "dining"
  | "bedroom"
  | "bathroom"
  | "study"
  | "balcony"
  | "office"
  | "meeting"
  | "lobby"
  | "guest_room"
  | "corridor"
  | "utility"
  | "server";

export type HotelRoomStatus = "vacant" | "occupied" | "checkout" | "cleaning" | "maintenance";

export interface Room {
  id: string;
  orgId: string;
  propertyId: string;
  floorId: string;
  name: string;
  kind: RoomKind;
  order: number;
  occupied: boolean;
  /** floor plan placement in a 12x8 grid */
  plan: { x: number; y: number; w: number; h: number };
  hotel?: { status: HotelRoomStatus; guestName?: string; number?: string; checkInAt?: string };
  department?: string;
}

export interface Device {
  id: string;
  orgId: string;
  propertyId: string;
  roomId: string;
  name: string;
  type: DeviceType;
  provider: ProviderKey;
  externalId: string;
  integrationId: string | null;
  capabilities: Capability[];
  state: DeviceState;
  online: boolean;
  /** essential, safety or security loads — never switched off by bulk / checkout / after-hours automation */
  essential: boolean;
  ratedWatts: number;
  lastSeenAt: string;
  firmware: string;
  model: string;
  manufacturer: string;
  createdAt: string;
  /** position on room floor plan, 0-1 */
  marker?: { x: number; y: number };
}

// ─── Automations ─────────────────────────────────────────────

export type Trigger =
  | { type: "time"; time: string; days: number[] } // days: 0=Sun..6=Sat
  | { type: "sunrise" | "sunset"; offsetMin: number; days: number[] }
  | { type: "device_state"; deviceId: string; key: keyof DeviceState; equals: string | number | boolean }
  | { type: "temperature_change"; deviceId: string; above: number }
  | { type: "manual" };

export type Condition =
  | { type: "device_online"; deviceId: string }
  | { type: "device_on"; deviceId: string }
  | { type: "room_occupied"; roomId: string }
  | { type: "temperature_above"; deviceId: string; value: number }
  | { type: "day_of_week"; days: number[] }
  | { type: "property_mode"; mode: PropertyMode };

export type Action =
  | { type: "device"; deviceId: string; command: DeviceCommand; conditions?: Condition[] }
  | { type: "scene"; sceneId: string }
  | { type: "notify"; message: string }
  | { type: "delay"; seconds: number };

export type UnreachablePolicy = "skip" | "retry_then_notify" | "abort";

export interface Automation {
  id: string;
  orgId: string;
  propertyId: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  /** optional "end" action — at this time, turn off devices that the automation switched on */
  end: { time: string } | null;
  onUnreachable: UnreachablePolicy;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  lastStatus: ExecutionStatus | null;
}

export type ExecutionStatus = "success" | "partial" | "failed" | "skipped";

export interface ExecutionStep {
  label: string;
  status: "success" | "failed" | "skipped";
  detail?: string;
  attempts?: number;
}

export interface Execution {
  id: string;
  orgId: string;
  propertyId: string;
  automationId: string | null;
  sceneId: string | null;
  name: string;
  phase: "start" | "end" | "scene" | "manual";
  status: ExecutionStatus;
  source: "scheduler" | "event" | "user" | "gateway";
  startedAt: string;
  finishedAt: string;
  steps: ExecutionStep[];
  dedupeKey: string;
  userId: string | null;
}

export interface SceneAction {
  deviceId: string;
  command: DeviceCommand;
}

export interface Scene {
  id: string;
  orgId: string;
  propertyId: string;
  name: string;
  icon: string;
  description: string;
  accent: string;
  actions: SceneAction[];
  lastActivatedAt: string | null;
  createdAt: string;
}

export type NotificationType =
  | "device_offline"
  | "device_online"
  | "automation_executed"
  | "automation_failed"
  | "energy_anomaly"
  | "device_state"
  | "property_access"
  | "integration_disconnected"
  | "hotel"
  | "system";

export interface Notification {
  id: string;
  orgId: string;
  propertyId: string | null;
  type: NotificationType;
  severity: "info" | "success" | "warning" | "error";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface ActivityLog {
  id: string;
  orgId: string;
  propertyId: string | null;
  userId: string | null;
  userName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  action: string;
  previous: string | null;
  next: string | null;
  source: "user" | "automation" | "scene" | "system" | "integration" | "gateway";
  automationId: string | null;
  at: string;
}

export interface IntegrationAccount {
  id: string;
  orgId: string;
  provider: ProviderKey;
  label: string;
  status: "connected" | "disconnected" | "error" | "not_configured";
  /** never sent to the browser — see server/serialize */
  secret?: { baseUrl?: string; token?: string; clientId?: string; clientSecret?: string; region?: string };
  lastSyncAt: string | null;
  createdAt: string;
  message?: string;
}

/** Public, browser-safe integration shape */
export type PublicIntegration = Omit<IntegrationAccount, "secret"> & { hasCredentials: boolean };

export interface SessionInfo {
  user: User;
  memberships: (Membership & { org: Organization })[];
  activeOrgId: string | null;
  role: RoleKey | null;
  permissions: Permission[];
}

// ─── CCTV ────────────────────────────────────────────────────

export type CameraLayout = 1 | 4 | 9 | 16;

/** A saved, switchable CCTV wall: which cameras to show and in what grid. Shared per property. */
export interface CameraView {
  id: string;
  orgId: string;
  propertyId: string;
  name: string;
  layout: CameraLayout;
  /** camera device ids in slot order */
  cameraIds: string[];
  createdBy: string;
  createdAt: string;
}
