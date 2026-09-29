export type PhilippineAddressFields = {
  region: string;
  regionCode: string;
  province: string;
  provinceCode: string;
  localityParentCode: string;
  city: string;
  cityCode: string;
  barangay: string;
  barangayCode: string;
  street: string;
  zipCode: string;
};

export const EMPTY_PHILIPPINE_ADDRESS: PhilippineAddressFields = {
  region: "",
  regionCode: "",
  province: "",
  provinceCode: "",
  localityParentCode: "",
  city: "",
  cityCode: "",
  barangay: "",
  barangayCode: "",
  street: "",
  zipCode: "",
};

export function toPhilippineAddressFields(
  address: Partial<PhilippineAddressFields> & { address?: string },
): PhilippineAddressFields {
  return {
    region: address.region ?? "",
    regionCode: address.regionCode ?? "",
    province: address.province ?? "",
    provinceCode: address.provinceCode ?? "",
    localityParentCode: address.localityParentCode || address.provinceCode || address.regionCode || "",
    city: address.city ?? "",
    cityCode: address.cityCode ?? "",
    barangay: address.barangay ?? "",
    barangayCode: address.barangayCode ?? "",
    street: address.street ?? address.address ?? "",
    zipCode: address.zipCode ?? "",
  };
}

export function isCompletePhilippineAddress(address: PhilippineAddressFields): boolean {
  return Boolean(
    address.region
    && address.regionCode
    && address.localityParentCode
    && address.city
    && address.cityCode
    && address.barangay
    && address.barangayCode
    && address.street.trim()
    && /^\d{4}$/.test(address.zipCode),
  );
}

export function formatPhilippineAddress(address: Partial<PhilippineAddressFields>, fallback = ""): string {
  const parts = [
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.region,
    address.zipCode,
  ].map((part) => part?.trim()).filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : fallback.trim();
}