import assert from "node:assert/strict";
import test from "node:test";
import { cartSnapshot, createCartQueue, createOptimisticCart } from "../src/lib/cartState.ts";

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

test("quantity changes immediately update the displayed line, count and estimated subtotal", () => {
  const state = createOptimisticCart();
  state.confirm(cart());
  state.begin("42", 3);

  const snapshot = state.snapshot();
  assert.equal(snapshot.items[0].quantity, 3);
  assert.equal(snapshot.items[0].lineTotal, 2700);
  assert.equal(snapshot.subtotal, 2700);
  assert.equal(state.find("42").quantity, 2);
});

test("a rejected quantity change restores confirmed quantity, totals and stock conflicts", () => {
  const state = createOptimisticCart();
  state.confirm(cart({ conflict_count: 1 }));
  const operation = state.begin("42", 8);

  state.settle(operation);

  assert.deepEqual(state.snapshot(), cartSnapshot(cart({ conflict_count: 1 })));
});

test("removing the last item hides it immediately but preserves its server ID for the request and rollback", () => {
  const state = createOptimisticCart();
  state.confirm(cart());
  const operation = state.begin("42", 0);
  assert.deepEqual(state.snapshot().items, []);
  assert.equal(state.snapshot().subtotal, 0);
  assert.equal(state.find("42").serverId, 8);

  state.settle(operation);

  assert.deepEqual(state.snapshot(), cartSnapshot(cart()));
});

test("an earlier response cannot overwrite a newer pending quantity and final prices come from the server", () => {
  const state = createOptimisticCart();
  state.confirm(cart());
  const first = state.begin("42", 3);
  const second = state.begin("42", 4);
  const response = cart();
  response.items[0].quantity = 3;
  response.items[0].unit_price = "850.00";
  response.items[0].line_total = "2550.00";
  response.total = "2550.00";

  state.settle(first);
  state.confirm(response);
  assert.equal(state.snapshot().items[0].quantity, 4);
  assert.equal(state.snapshot().subtotal, 3400);
  state.settle(second);

  assert.equal(state.snapshot().items[0].quantity, 3);
  assert.equal(state.snapshot().subtotal, 2550);
});

test("refresh after a lost removal response reconciles a deletion that reached the server", () => {
  const state = createOptimisticCart();
  state.confirm(cart());
  const operation = state.begin("42", 0);

  state.settle(operation);
  state.confirm(cart({ items: [], total: "0.00" }));

  assert.deepEqual(state.snapshot().items, []);
  assert.equal(state.snapshot().subtotal, 0);
});

test("a new session has no pending changes or confirmed items from the previous session", () => {
  const previous = createOptimisticCart();
  previous.confirm(cart());
  const operation = previous.begin("42", 0);
  const current = createOptimisticCart();

  previous.settle(operation);
  previous.confirm(cart());

  assert.deepEqual(current.snapshot(), { items: [], subtotal: 0, conflictCount: 0 });
});
