import { createReadCache } from "./readCache.ts";
import type { DeliveryBarangay, DeliveryLocation } from "./deliveryAddress.ts";

export type DeliveryCity = { code: string; name: string; destination: string; region_code: string; province_code: string | null; type: "city" | "municipality"; city_class: "CC" | "HUC" | null };
export type DeliveryProvince = { code: string; name: string; region_code: string };
type Request = <T>(path: string) => Promise<T>;

export function createDeliveryDirectory(request: Request) {
  const cache = createReadCache<unknown[]>(24 * 60 * 60 * 1000);
  function locations<T>(level: string, parentCode?: string): Promise<T[]> {
    const query = `level=${encodeURIComponent(level)}${parentCode ? `&parent_code=${encodeURIComponent(parentCode)}` : ""}`;
    return cache.read(query, async () => (await request<{ data: { locations: T[] } }>(`delivery-locations?${query}`)).data.locations) as Promise<T[]>;
  }
  function present(city: DeliveryCity, provinces: DeliveryProvince[], barangays: DeliveryBarangay[] = []): DeliveryLocation {
    return { destination: city.code, code: city.code, name: city.destination, type: city.type, city_class: city.city_class, region_code: city.region_code, province: provinces.find((province) => province.code === city.province_code) ?? null, barangays };
  }
  return {
    locations,
    async resolveCity(cityCode: string): Promise<DeliveryLocation> {
      const [city] = await locations<DeliveryCity>("city", cityCode);
      if (!city) throw new Error("This delivery city is no longer available.");
      const [provinces, barangays] = await Promise.all([locations<DeliveryProvince>("provinces", city.region_code), locations<DeliveryBarangay>("barangays", city.code)]);
      return present(city, provinces, barangays);
    },
    async negrosLocations(): Promise<DeliveryLocation[]> {
      const provinces = (await locations<DeliveryProvince>("provinces", "1800000000")).filter((province) => province.name === "Negros Occidental" || province.name === "Negros Oriental");
      const groups = await Promise.all([...provinces.map((province) => province.code), "1800000000"].map((parent) => locations<DeliveryCity>("cities", parent)));
      return groups.flat().map((city) => present(city, provinces)).sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}
