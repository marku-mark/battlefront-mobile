// Hardcoded sample data. Kept separate from api.ts so the fetch layer
// can later swap this out for a real backend without touching screens.

export type Category = {
  id: string;
  name: string;
  /** Ionicons glyph name, e.g. "laptop-outline" */
  icon: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  sold?: number;
};

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

export const categories: Category[] = [
  { id: "cat-1", name: "Laptops", icon: "laptop-outline" },
  { id: "cat-2", name: "Desktops", icon: "desktop-outline" },
  { id: "cat-3", name: "Components", icon: "hardware-chip-outline" },
  { id: "cat-4", name: "Peripherals", icon: "game-controller-outline" },
  { id: "cat-5", name: "Monitors", icon: "tv-outline" },
  { id: "cat-6", name: "Networking", icon: "wifi-outline" },
  { id: "cat-7", name: "Storage", icon: "server-outline" },
  { id: "cat-8", name: "Accessories", icon: "headset-outline" },
];

export const banners: Banner[] = [
  {
    id: "banner-1",
    title: "Build Season Sale",
    subtitle: "Up to 30% off select GPUs",
    image: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&q=80",
  },
  {
    id: "banner-2",
    title: "New Arrivals",
    subtitle: "Latest laptops just landed",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800&q=80",
  },
  {
    id: "banner-3",
    title: "Peripherals Week",
    subtitle: "Keyboards, mice, and more",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
  },
];

export const flashDeals: Product[] = [
  {
    id: "flash-1",
    name: "RTX 4070 Super 12GB",
    price: 32999,
    originalPrice: 38999,
    image: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&q=80",
    sold: 120,
  },
  {
    id: "flash-2",
    name: "Mechanical Keyboard 87-key",
    price: 2499,
    originalPrice: 3299,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80",
    sold: 340,
  },
  {
    id: "flash-3",
    name: "27\" 165Hz Gaming Monitor",
    price: 10999,
    originalPrice: 13999,
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80",
    sold: 88,
  },
];

export const sulitPicks: Product[] = [
  {
    id: "sulit-1",
    name: "1TB NVMe SSD Gen4",
    price: 3999,
    image: "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=400&q=80",
  },
  {
    id: "sulit-2",
    name: "Wireless Gaming Mouse",
    price: 1899,
    image: "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&q=80",
  },
  {
    id: "sulit-3",
    name: "750W 80+ Gold PSU",
    price: 4599,
    image: "https://images.unsplash.com/photo-1591405351990-4726e331f141?w=400&q=80",
  },
];

export const newArrivals: Product[] = [
  {
    id: "new-1",
    name: "Ryzen 7 8700G Processor",
    price: 14999,
    image: "https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=400&q=80",
  },
  {
    id: "new-2",
    name: "14\" Ultrabook 16GB/512GB",
    price: 52999,
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80",
  },
  {
    id: "new-3",
    name: "ATX Mid Tower Case",
    price: 3499,
    image: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=400&q=80",
  },
  {
    id: "new-4",
    name: "32GB DDR5 6000MHz Kit",
    price: 6299,
    image: "https://images.unsplash.com/photo-1562976540-1502c2145186?w=400&q=80",
  },
];

export const brands: Brand[] = [
  { id: "brand-1", name: "ASUS", logo: "" },
  { id: "brand-2", name: "MSI", logo: "" },
  { id: "brand-3", name: "Corsair", logo: "" },
  { id: "brand-4", name: "Logitech", logo: "" },
  { id: "brand-5", name: "Gigabyte", logo: "" },
];

export const stores: Store[] = [
  {
    id: "store-sagay",
    name: "Battlefront Computer & Piso-Wifi Store",
    branch: "Sagay Branch",
    city: "Sagay City",
    address: "Infront of Western Union, Maria Lopez Elementary School, AE Marañon St, Unhan, Sagay City, 6122 Negros Occidental",
    landmark: "Beside LBC Express",
    hours: "Mon-Sat 8AM-6PM, Sun 10AM-5PM",
    phone: "(034) 400-0001",
    latitude: 10.893563,
    longitude: 123.413813,
  },
  {
    id: "store-escalante",
    name: "Battlefront Computer Parts & Accessories",
    branch: "Escalante Branch",
    city: "Escalante City",
    address: "Escalante City, Negros Occidental",
    hours: "Mon-Sat 8AM-6PM",
    phone: "(034) 400-0002",
    latitude: 10.842687,
    longitude: 123.498562,
  },
  {
    id: "store-san-carlos",
    name: "Battlefront Computer & Piso-Wifi Store",
    branch: "San Carlos Branch",
    city: "San Carlos City",
    address: "Infront of Metro Bank, Siroy Building, Carmona Street, Barangay 5, San Carlos City, 6127 Negros Occidental",
    landmark: "Beside Pure Gold",
    hours: "Mon-Sat 8AM-6PM",
    phone: "(034) 400-0003",
    latitude: 10.482812,
    longitude: 123.421187,
  },
  {
    id: "store-bacolod",
    name: "Battlefront Computer Trading",
    branch: "Bacolod Branch",
    city: "Bacolod City",
    address: "Downtown, Along SKG Shopping Center, Beside Ukay-Ukayan 58 Lizares St. Brgy. 13, Bacolod City, Philippines, 6100",
    hours: "Hours not provided",
    phone: "0961 176 4608",
  },
  {
    id: "store-guihulngan",
    name: "Battlefront Computer Trading",
    branch: "Guihulngan Branch",
    city: "Guihulngan City",
    address: "L&E Arcade, Larena St. Brgy. Poblacion, Guihulngan City (above Watsons), Guihulngan, Philippines, 6214",
    hours: "Hours not provided",
    phone: "0947 946 5723",
    latitude: 10.1206,
    longitude: 123.2717,
  },
];
