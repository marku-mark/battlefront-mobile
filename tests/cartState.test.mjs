import assert from "node:assert/strict";
import test from "node:test";
import { cartSnapshot, createCartQueue } from "../src/lib/cartState.ts";

function cart(overrides = {}) {
  return {
    items: [{ id: 8, quantity: 2, product: { id: 42, name: "Memory kit", brand: "Kingston", category: "RAM / Memory", image_url: "http://backend.test/storage/products/ram/42.webp", price: "1200.00", discount_price: "900.00" }, unit_price: "900.00", line_total: "1800.00", availability: { status: "available", available_quantity: 7 } }],
    total: "1800.00", total_quantity: 2, conflict_count: 0, ...overrides,
  };
}

test("a real cart response with a text category can render after adding a product", () => {
  const snapshot = cartSnapshot(cart());
  assert.equal(snapshot.items[0].product.id, "42");
  assert.equal(snapshot.items[0].product.categorySlug, "category-ram-memory");
  assert.equal(snapshot.items[0].product.image, "http://backend.test/storage/products/ram/42.webp");
  assert.equal(snapshot.items[0].serverId, 8);
  assert.equal(snapshot.items[0].quantity, 2);
});

test("cart prices and totals use the server's current price snapshots", () => {
  const response = cart();
  response.items[0].product.discount_price = "800.00";
  const snapshot = cartSnapshot(response);
  assert.equal(snapshot.items[0].product.price, 900);
  assert.equal(snapshot.items[0].lineTotal, 1800);
  assert.equal(snapshot.subtotal, 1800);
});

test("missing inventory remains unavailable instead of granting twelve extra items", () => {
  const response = cart({ conflict_count: 1 });
  response.items[0].availability = { status: "inventory_unavailable", available_quantity: null };
  const snapshot = cartSnapshot(response);
  assert.equal(snapshot.items[0].product.stockQuantity, 0);
  assert.equal(snapshot.items[0].product.availability, "inventory_unavailable");
  assert.equal(snapshot.conflictCount, 1);
});

test("an empty cart renders a zero total and no stale lines", () => {
  assert.deepEqual(cartSnapshot(cart({ items: [], total: "0.00", total_quantity: 0 })), { items: [], subtotal: 0, conflictCount: 0 });
});

test("cart refreshes wait for mutations so old responses cannot replace newer quantities", async () => {
  const enqueue = createCartQueue();
  let release;
  let quantity = 1;
  const mutation = enqueue(async () => { await new Promise((resolve) => { release = resolve; }); quantity = 2; return quantity; });
  const refresh = enqueue(async () => quantity);
  await Promise.resolve();
  release();
  assert.equal(await mutation, 2);
  assert.equal(await refresh, 2);
});

test("a failed cart operation does not prevent retry or subsequent updates", async () => {
  const enqueue = createCartQueue();
  let attempts = 0;
  const failed = enqueue(async () => { attempts++; throw new Error("Offline"); });
  const retry = enqueue(async () => { attempts++; return "recovered"; });
  await assert.rejects(failed, /Offline/);
  assert.equal(await retry, "recovered");
  assert.equal(attempts, 2);
});
