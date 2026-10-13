import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocalUserId } from "@/lib/api";
import type { DeliveryAddress } from "@/lib/deliveryAddress";

export type SavedAddress = {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  address: string;
} & Partial<DeliveryAddress>;

const SAVED_ADDRESSES_STORAGE_KEY = "battlefront-saved-addresses";

export const DEFAULT_SAVED_ADDRESSES: SavedAddress[] = [];

export async function loadSavedAddresses(): Promise<SavedAddress[]> {
  try {
    const storedAddresses = await AsyncStorage.getItem(`${SAVED_ADDRESSES_STORAGE_KEY}-api-${getLocalUserId()}`);
    if (!storedAddresses) return DEFAULT_SAVED_ADDRESSES;
    const parsed: unknown = JSON.parse(storedAddresses);
    if (!Array.isArray(parsed)) return DEFAULT_SAVED_ADDRESSES;
    return parsed.filter(isSavedAddress);
  } catch {
    return DEFAULT_SAVED_ADDRESSES;
  }
}

export async function persistSavedAddresses(addresses: SavedAddress[]): Promise<void> {
  await AsyncStorage.setItem(`${SAVED_ADDRESSES_STORAGE_KEY}-api-${getLocalUserId()}`, JSON.stringify(addresses));
}

function isSavedAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Partial<SavedAddress>;
  const hasValidLocationFields = ["delivery_destination", "delivery_barangay_code", "delivery_address_details"]
    .every((field) => address[field as keyof DeliveryAddress] === undefined
      || typeof address[field as keyof DeliveryAddress] === "string");
  return typeof address.id === "string"
    && typeof address.label === "string"
    && typeof address.recipient === "string"
    && typeof address.phone === "string"
    && typeof address.address === "string"
    && hasValidLocationFields;
}
