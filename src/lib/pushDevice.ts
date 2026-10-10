import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { apiRequest, getSessionRevision } from "./api";

const DEVICE_ID_KEY = "battlefront-push-installation-id";
let installationIdPromise: Promise<string> | null = null;

export function getInstallationId(): Promise<string> {
  if (!installationIdPromise) {
    installationIdPromise = (async () => {
      const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored;
      const id = Crypto.randomUUID();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
      return id;
    })().catch((error) => { installationIdPromise = null; throw error; });
  }
  return installationIdPromise;
}

export async function registerPushDevice(expoPushToken: string): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const revision = getSessionRevision();
  const id = await getInstallationId();
  if (revision !== getSessionRevision()) return;
  await apiRequest(`push-devices/${id}`, {
    method: "PUT",
    body: JSON.stringify({ expo_push_token: expoPushToken, platform: Platform.OS }),
  });
}

export async function revokePushDevice(): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  const id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) return;
  await apiRequest(`push-devices/${id}`, { method: "DELETE" });
}
