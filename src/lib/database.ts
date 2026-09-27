import * as SQLite from "expo-sqlite";
import { catalogSeed } from "./catalogSeed";

export const databasePromise = SQLite.openDatabaseAsync("battlefront-catalog.db");

let initializationPromise: Promise<void> | null = null;

export function initializeCatalogDatabase(): Promise<void> {
  initializationPromise ??= initialize();
  return initializationPromise;
}

async function initialize() {
  const database = await databasePromise;

  await database.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category_id TEXT NOT NULL,
      brand_id TEXT NOT NULL,
      price REAL NOT NULL,
      image_key TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      performance_tier TEXT,
      use_case TEXT,
      special_traits TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (brand_id) REFERENCES brands(id)
    );
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  const existing = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM products");
  if (existing?.count) return;

  await database.withTransactionAsync(async () => {
    for (const category of catalogSeed.categories) {
      await database.runAsync(
        "INSERT INTO categories (id, name) VALUES (?, ?)",
        category.id,
        category.name
      );
    }
    for (const brand of catalogSeed.brands) {
      await database.runAsync("INSERT INTO brands (id, name) VALUES (?, ?)", brand.id, brand.name);
    }
    for (const product of catalogSeed.products) {
      await database.runAsync(
        "INSERT INTO products (id, name, category_id, brand_id, price, image_key, stock_quantity, performance_tier, use_case, special_traits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        product.id,
        product.name,
        product.categoryId,
        product.brandId,
        product.price,
        product.imageKey,
        product.stockQuantity,
        product.performanceTier,
        product.useCase,
        product.specialTraits
      );
      for (const variant of product.variants) {
        await database.runAsync(
          "INSERT INTO product_variants (id, product_id, name, price, stock_quantity) VALUES (?, ?, ?, ?, ?)",
          variant.id,
          product.id,
          variant.name,
          variant.price,
          variant.stockQuantity
        );
      }
    }
  });
}