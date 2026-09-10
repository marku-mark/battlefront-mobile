// API stub layer. Every function returns a Promise so screens already
// call this the way they would a real network request. Swap the body
// of each function for a real `fetch()`/SDK call later — no screen
// code should need to change.
import {
  banners,
  brands,
  categories,
  flashDeals,
  newArrivals,
  sulitPicks,
  type Banner,
  type Brand,
  type Category,
  type Product,
} from "./data";

const MOCK_DELAY_MS = 0; // set > 0 to simulate network latency during dev

function resolveAfter<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));
}

export async function getCategories(): Promise<Category[]> {
  return resolveAfter(categories);
}

export async function getBanners(): Promise<Banner[]> {
  return resolveAfter(banners);
}

export async function getFlashDeals(): Promise<Product[]> {
  return resolveAfter(flashDeals);
}

export async function getSulitPicks(): Promise<Product[]> {
  return resolveAfter(sulitPicks);
}

export async function getNewArrivals(): Promise<Product[]> {
  return resolveAfter(newArrivals);
}

export async function getBrands(): Promise<Brand[]> {
  return resolveAfter(brands);
}

// Flash deal countdown target — replace with a real deal-end timestamp
// once deals come from a backend.
export function getFlashDealEndTime(): Date {
  const end = new Date();
  end.setHours(end.getHours() + 6);
  return end;
}

export async function getChatbotReply(message: string): Promise<string> {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("order")) {
    return "Order tracking will be available once you sign in. I can still help you find a product in the meantime.";
  }
  if (normalizedMessage.includes("gpu") || normalizedMessage.includes("graphics")) {
    return "For graphics cards, check Flash Deals for current GPU offers. Tell me your budget and target games for a more specific recommendation.";
  }
  if (normalizedMessage.includes("laptop")) {
    return "We have laptops for work, school, and gaming. Open Categories and choose Laptops to browse the current selection.";
  }
  if (normalizedMessage.includes("shipping") || normalizedMessage.includes("delivery")) {
    return "Delivery options depend on your location. Shipping details will be shown during checkout once the cart flow is connected.";
  }

  return "I can help with products, orders, GPUs, laptops, and delivery. What would you like to know?";
}
