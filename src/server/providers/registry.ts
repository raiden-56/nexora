import "@/server/guard";
import type { ProviderKey } from "@/lib/types";
import { homeAssistantProvider } from "./homeAssistant";
import { pendingProvider } from "./pending";
import { simulatedProvider } from "./simulated";
import type { DeviceProvider } from "./types";

const providers: Record<ProviderKey, DeviceProvider> = {
  simulated: simulatedProvider,
  home_assistant: homeAssistantProvider,
  matter: pendingProvider("matter"),
  tuya: pendingProvider("tuya"),
  mqtt: pendingProvider("mqtt"),
  zigbee: pendingProvider("zigbee"),
};

export function getProvider(key: ProviderKey): DeviceProvider {
  return providers[key];
}
