export const DEMO_ACCOUNT = {
  email: "demo@battlefront.local",
  password: "battlefront-demo",
  displayName: "Demo Shopper",
  phone: "0917 000 0000",
  address: "12 Demo Street, Barangay 1, City of Bacolod, Negros Island Region (NIR), 6100",
} as const;

export const DEMO_ORDERS = [
  {
    id: "BF-DEMO-1042",
    date: "September 24, 2026",
    status: "Delivered",
    items: "1 × Desktop upgrade bundle",
    total: "₱24,990",
  },
  {
    id: "BF-DEMO-1038",
    date: "September 18, 2026",
    status: "In transit",
    items: "1 × Gaming keyboard",
    total: "₱3,490",
  },
] as const;

export const DEMO_ADDRESSES = [
  {
    label: "Home",
    recipient: DEMO_ACCOUNT.displayName,
    phone: DEMO_ACCOUNT.phone,
    address: DEMO_ACCOUNT.address,
    region: "Negros Island Region (NIR)",
    regionCode: "1800000000",
    province: "",
    provinceCode: "",
    localityParentCode: "1800000000",
    city: "City of Bacolod",
    cityCode: "1830200000",
    barangay: "Barangay 1",
    barangayCode: "1830200004",
    street: "12 Demo Street",
    zipCode: "6100",
  },
] as const;