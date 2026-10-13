import type { ImageSourcePropType } from "react-native";

export type Category = {
  id: string;
  name: string;
  icon: string;
};

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  description?: string | null;
  categorySlug?: string;
  brandId: string;
  price: number;
  originalPrice?: number;
  image: string;
  sold?: number;
  rating?: number;
  reviewCount?: number;
  stockQuantity?: number;
  availability?: string;
  variants?: string[];
  performanceTier?: string;
  useCase?: string;
  specialTraits?: string;
};

export function getProductVariants(product: Product): string[] {
  if (product.variants && product.variants.length > 0) return product.variants;
  return [];
}

export function getProductImageSource(image: Product["image"]): ImageSourcePropType | undefined {
  if (!image) return undefined;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  let apiOrigin: string | undefined;
  try {
    if (apiUrl) apiOrigin = new URL(apiUrl).origin;
  } catch {
    // An invalid API URL is reported by the API client; keep image parsing safe.
  }

  try {
    const url = /^https?:\/\//i.test(image)
      ? new URL(image)
      : apiOrigin
        ? new URL(image.replace(/^\/+/, ""), `${apiOrigin}/`)
        : undefined;
    if (!url) return undefined;

    // Product image URLs come from Laravel and can contain a stale APP_URL host.
    // Use the configured API host for Laravel-managed image paths on phones.
    const isLaravelImage = /^\/(storage|images)\//i.test(url.pathname);
    const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(url.hostname) || url.hostname.endsWith(".test");
    if (apiOrigin && (isLaravelImage || isLocalHost)) {
      const api = new URL(apiOrigin);
      url.protocol = api.protocol;
      url.host = api.host;
    }

    return { uri: url.toString() };
  } catch {
    return undefined;
  }
}

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
};

export type Brand = {
  id: string;
  name: string;
  logo: string;
};

export type Store = {
  id: string;
  name: string;
  branch: string;
  address: string;
  landmark?: string;
  hours: string;
  phone: string;
  city: string;
  latitude?: number;
  longitude?: number;
};

export const stores: Store[] = [
  { id: "store-sagay", name: "Battlefront Computer & Piso-Wifi Store", branch: "Sagay Branch", city: "Sagay City", address: "Infront of Western Union, Maria Lopez Elementary School, AE Marañon St, Unhan, Sagay City, 6122 Negros Occidental", landmark: "Beside LBC Express", hours: "Mon-Sat 8AM-6PM, Sun 10AM-5PM", phone: "(034) 400-0001", latitude: 10.893563, longitude: 123.413813 },
  { id: "store-escalante", name: "Battlefront Computer Parts & Accessories", branch: "Escalante Branch", city: "Escalante City", address: "Escalante City, Negros Occidental", hours: "Mon-Sat 8AM-6PM", phone: "(034) 400-0002", latitude: 10.842687, longitude: 123.498562 },
  { id: "store-san-carlos", name: "Battlefront Computer & Piso-Wifi Store", branch: "San Carlos Branch", city: "San Carlos City", address: "Infront of Metro Bank, Siroy Building, Carmona Street, Barangay 5, San Carlos City, 6127 Negros Occidental", landmark: "Beside Pure Gold", hours: "Mon-Sat 8AM-6PM", phone: "(034) 400-0003", latitude: 10.482812, longitude: 123.421187 },
  { id: "store-bacolod", name: "Battlefront Computer Trading", branch: "Bacolod Branch", city: "Bacolod City", address: "Downtown, Along SKG Shopping Center, Beside Ukay-Ukayan 58 Lizares St. Brgy. 13, Bacolod City, Philippines, 6100", hours: "Hours not provided", phone: "0961 176 4608" },
  { id: "store-guihulngan", name: "Battlefront Computer Trading", branch: "Guihulngan Branch", city: "Guihulngan City", address: "L&E Arcade, Larena St. Brgy. Poblacion, Guihulngan City (above Watsons), Guihulngan, Philippines, 6214", hours: "Hours not provided", phone: "0947 946 5723", latitude: 10.1206, longitude: 123.2717 },
];
