import assert from "node:assert/strict";
import test from "node:test";
import { createCartApi } from "../src/lib/cartApi.ts";
import { createReadCache } from "../src/lib/readCache.ts";
import { CACHE_AGE } from "../src/lib/cachePolicy.ts";

test("cart writes reuse the authoritative response and fresh revisits send no GET", async () => {
  const calls = [];
  const cart = createCartApi(async (path, options) => {
    calls.push([path, options?.method ?? "GET"]);
    return { data: { revision: calls.length } };
  }, createReadCache(CACHE_AGE.private), () => 0);
  await cart.getCart();
  assert.deepEqual(await cart.addCartItem("7", 2), { revision: 2 });
  assert.deepEqual(await cart.getCart(), { revision: 2 });
  await cart.changeCartItem(12, 3);
  assert.deepEqual(await cart.getCart(), { revision: 3 });
  await cart.deleteCartItem(12);
  assert.deepEqual(await cart.getCart(), { revision: 4 });
  assert.deepEqual(calls, [["cart", "GET"], ["cart/items", "POST"], ["cart/items/12", "PATCH"], ["cart/items/12", "DELETE"]]);
});

test("manual cart refresh bypasses fresh data and shares a pending read", async () => {
  let calls = 0;
  const cart = createCartApi(async () => ({ data: ++calls }), createReadCache(CACHE_AGE.private), () => 0);
  assert.equal(await cart.getCart(), 1);
  assert.equal(await cart.getCart(), 1);
  const refresh = cart.getCart(true);
  assert.equal(cart.getCart(true), refresh);
  assert.equal(await refresh, 2);
});

test("an earlier cart read cannot replace a confirmed mutation", async () => {
  let finish;
  const cart = createCartApi(async (_path, options) => options ? { data: "updated" } : new Promise((resolve) => { finish = resolve; }), createReadCache(CACHE_AGE.private), () => 0);
  const read = cart.getCart();
  await Promise.resolve();
  await cart.addCartItem("7", 1);
  finish({ data: "old" });
  await assert.rejects(read, /information changed/);
  assert.equal(await cart.getCart(), "updated");
});

test("logout clears private data and late writes cannot seed the next account's cache", async () => {
  const cache = createReadCache(CACHE_AGE.private);
  let revision = 0;
  let finish;
  const cart = createCartApi(async (_path, options) => options ? new Promise((resolve) => { finish = resolve; }) : { data: "new customer" }, cache, () => revision);
  cache.seed("cart", "old customer");
  const update = cart.addCartItem("7", 1);
  revision++; cache.clear();
  assert.equal(cache.peek("cart"), undefined);
  finish({ data: "old mutation" });
  await update;
  assert.equal(await cart.getCart(), "new customer");
});

test("a failed write keeps the last confirmed cart and allows a fresh reconciliation", async () => {
  let calls = 0;
  const cart = createCartApi(async (_path, options) => {
    if (options) throw new Error("Offline");
    return { data: ++calls };
  }, createReadCache(CACHE_AGE.private), () => 0);
  await cart.getCart();
  await assert.rejects(cart.changeCartItem(12, 2), /Offline/);
  assert.equal(await cart.getCart(), 1);
  assert.equal(await cart.getCart(true), 2);
});
