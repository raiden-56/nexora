import type { Capability, Device, DeviceCommand, DeviceState, DeviceType, IntegrationAccount, ProviderKey } from "@/lib/types";

export interface DiscoveredDevice {
  externalId: string;
  name: string;
  type: DeviceType;
  capabilities: Capability[];
  manufacturer: string;
  model: string;
  firmware: string;
  ratedWatts: number;
  state: DeviceState;
  /** e.g. signal strength or protocol details shown in the pairing wizard */
  details?: string;
}

export type CommandResult =
  | { ok: true; state: DeviceState; confirmed: boolean }
  | { ok: false; error: string; retryable: boolean; offline?: boolean };

/**
 * Every manufacturer / protocol implements this adapter. Device management, automations and
 * scenes only ever talk to this interface, so new ecosystems plug in without touching them.
 */
export interface DeviceProvider {
  key: ProviderKey;
  label: string;
  /** true when the provider talks to real hardware */
  real: boolean;
  discover(integration: IntegrationAccount | null): Promise<DiscoveredDevice[]>;
  sendCommand(device: Device, command: DeviceCommand, integration: IntegrationAccount | null): Promise<CommandResult>;
  testConnection(device: Device, integration: IntegrationAccount | null): Promise<{ ok: boolean; latencyMs: number; message: string }>;
  testIntegration(integration: IntegrationAccount): Promise<{ ok: boolean; message: string }>;
}

export class ProviderUnavailable extends Error {}
