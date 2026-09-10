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
