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
  categorySlug?: string;
  brandId: string;
  price: number;
  originalPrice?: number;
  image: string | ImageSourcePropType;
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

export function getProductImageSource(image: Product["image"]): ImageSourcePropType {
  return typeof image === "string" ? { uri: image } : image;
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

export const banners: Banner[] = [
  { id: "banner-1", title: "Build Season Sale", subtitle: "Browse current inventory", image: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80" },
  { id: "banner-2", title: "New Arrivals", subtitle: "Latest products in stock", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80" },
  { id: "banner-3", title: "Peripherals Week", subtitle: "Keyboards, mice, and more", image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80" },
];

export const stores: Store[] = [
  { id: "store-sagay", name: "Battlefront Computer & Piso-Wifi Store", branch: "Sagay Branch", city: "Sagay City", address: "Infront of Western Union, Maria Lopez Elementary School, AE Marañon St, Unhan, Sagay City, 6122 Negros Occidental", landmark: "Beside LBC Express", hours: "Mon-Sat 8AM-6PM, Sun 10AM-5PM", phone: "(034) 400-0001", latitude: 10.893563, longitude: 123.413813 },
  { id: "store-escalante", name: "Battlefront Computer Parts & Accessories", branch: "Escalante Branch", city: "Escalante City", address: "Escalante City, Negros Occidental", hours: "Mon-Sat 8AM-6PM", phone: "(034) 400-0002", latitude: 10.842687, longitude: 123.498562 },
  { id: "store-san-carlos", name: "Battlefront Computer & Piso-Wifi Store", branch: "San Carlos Branch", city: "San Carlos City", address: "Infront of Metro Bank, Siroy Building, Carmona Street, Barangay 5, San Carlos City, 6127 Negros Occidental", landmark: "Beside Pure Gold", hours: "Mon-Sat 8AM-6PM", phone: "(034) 400-0003", latitude: 10.482812, longitude: 123.421187 },
  { id: "store-bacolod", name: "Battlefront Computer Trading", branch: "Bacolod Branch", city: "Bacolod City", address: "Downtown, Along SKG Shopping Center, Beside Ukay-Ukayan 58 Lizares St. Brgy. 13, Bacolod City, Philippines, 6100", hours: "Hours not provided", phone: "0961 176 4608" },
  { id: "store-guihulngan", name: "Battlefront Computer Trading", branch: "Guihulngan Branch", city: "Guihulngan City", address: "L&E Arcade, Larena St. Brgy. Poblacion, Guihulngan City (above Watsons), Guihulngan, Philippines, 6214", hours: "Hours not provided", phone: "0947 946 5723", latitude: 10.1206, longitude: 123.2717 },
];
