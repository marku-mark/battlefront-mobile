export type DeliveryBarangay = { code: string; name: string };
export type DeliveryLocation = {
  destination: string;
  code: string;
  name: string;
  type: "city" | "municipality";
  city_class: "CC" | "HUC" | null;
  province: { code: string; name: string } | null;
  barangays: DeliveryBarangay[];
};
export type DeliveryAddress = {
  delivery_destination: string;
  delivery_barangay_code: string;
  delivery_address_details: string;
};

export const EMPTY_DELIVERY_ADDRESS: DeliveryAddress = {
  delivery_destination: "",
  delivery_barangay_code: "",
  delivery_address_details: "",
};

export function formatDeliveryAddress(address: DeliveryAddress, locations: DeliveryLocation[]): string {
  const location = locations.find((item) => item.destination === address.delivery_destination);
  const barangay = location?.barangays.find((item) => item.code === address.delivery_barangay_code);
  return [address.delivery_address_details.trim(), barangay?.name, location?.destination].filter(Boolean).join(", ");
}

export function isCompleteDeliveryAddress(address: DeliveryAddress, locations: DeliveryLocation[]): boolean {
  const location = locations.find((item) => item.destination === address.delivery_destination);
  return Boolean(location?.barangays.some((barangay) => barangay.code === address.delivery_barangay_code)
    && address.delivery_address_details.trim()
    && address.delivery_address_details.trim().length <= 255);
}
