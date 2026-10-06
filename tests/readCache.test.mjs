import assert from "node:assert/strict";
import test from "node:test";
import { createReadCache, loadSelectedProducts } from "../src/lib/readCache.ts";
import { CACHE_AGE } from "../src/lib/cachePolicy.ts";

test("reference data is reused until its policy expires and explicit refresh bypasses the cache", async () => {
  for (const lifetime of [CACHE_AGE.branches, CACHE_AGE.filters, CACHE_AGE.products, CACHE_AGE.search]) {
    let now = 0;
    let calls = 0;
    const cache = createReadCache(lifetime, () => now);
    const load = async () => ++calls;
    assert.equal(await cache.read("reference", load), 1);
    now = lifetime - 1;
    assert.equal(await cache.read("reference", load), 1);
    now = lifetime;
    assert.equal(await cache.read("reference", load), 2);
    assert.equal(await cache.read("reference", load, true), 3);
  }
});

test("leaving a saved-products screen stops remaining detail requests", async () => {
  let active = true;
  const calls = [];
  const rows = await loadSelectedProducts(["1", "2", "3"], async (id) => { calls.push(id); active = false; return { id }; }, 1, () => active);
  assert.deepEqual(calls, ["1"]);
  assert.deepEqual(rows, [{ id: "1" }]);
});

test("reopening a fresh product uses its existing data without another request", async () => {
  let calls = 0;
  const cache = createReadCache(60_000, () => 0);
  const load = async () => { calls++; return { id: "42", price: 900 }; };
  await cache.read("42", load);
  assert.deepEqual(cache.peek("42"), { id: "42", price: 900 });
  await cache.read("42", load);
  assert.equal(calls, 1);
});

test("stale data stays visible until a background request supplies updated prices", async () => {
  let now = 0;
  const cache = createReadCache(60_000, () => now);
  cache.seed("42", { price: 900 });
  now = 60_000;
  let finish;
  const pending = cache.read("42", () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  assert.deepEqual(cache.peek("42"), { price: 900 });
  finish({ price: 850 });
  await pending;
  assert.deepEqual(cache.peek("42"), { price: 850 });
});

test("duplicate reads share work while unrelated features complete independently", async () => {
  const cache = createReadCache(60_000);
  let finish;
  const slow = cache.read("catalog", () => new Promise((resolve) => { finish = resolve; }));
  assert.equal(cache.read("catalog", async () => { throw new Error("Duplicate request"); }), slow);
  assert.equal(await cache.read("orders", async () => "orders ready"), "orders ready");
  finish("catalog ready");
  assert.equal(await slow, "catalog ready");
});

test("a failed background read preserves visible data and permits a later retry", async () => {
  let now = 0;
  const cache = createReadCache(100, () => now);
  cache.seed("orders", ["existing order"]);
  now = 100;
  await assert.rejects(cache.read("orders", async () => { throw new Error("Offline"); }), /Offline/);
  assert.deepEqual(cache.peek("orders"), ["existing order"]);
  assert.deepEqual(await cache.read("orders", async () => ["updated order"]), ["updated order"]);
});

test("logout clears private snapshots immediately and rejects late responses", async () => {
  const cache = createReadCache(100);
  cache.seed("profile", { name: "First customer" });
  let finish;
  const pending = cache.read("orders", () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  cache.clear();
  assert.equal(cache.peek("profile"), undefined);
  finish(["private order"]);
  await assert.rejects(pending, /information changed/);
  assert.equal(cache.peek("orders"), undefined);
  assert.deepEqual(await cache.read("orders", async () => ["second customer"]), ["second customer"]);
});

test("invalidated queued reads never start with the next customer's credentials", async () => {
  const cache = createReadCache(100);
  let calls = 0;
  const pending = cache.read("profile", async () => { calls++; return "private"; });
  cache.clear();
  await assert.rejects(pending, /information changed/);
  assert.equal(calls, 0);
});

test("a confirmed update invalidates old snapshots and cannot be replaced by an earlier read", async () => {
  const cache = createReadCache(100);
  let finish;
  const pending = cache.read("order", () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve();
  cache.clear(); cache.seed("order", "new proof");
  finish("old proof");
  await assert.rejects(pending, /information changed/);
  assert.equal(await cache.read("order", async () => "unneeded request"), "new proof");
});

test("cached not-found products do not trigger repeated requests and memory is bounded", async () => {
  const cache = createReadCache(100, () => 0, 2);
  cache.seed("missing", null);
  assert.equal(await cache.read("missing", async () => { throw new Error("Unneeded request"); }), null);
  cache.seed("one", 1); cache.seed("two", 2);
  assert.equal(cache.peek("missing"), undefined);
  assert.equal(cache.peek("two"), 2);
});

test("wishlist loads only requested unique IDs, limits concurrency and preserves saved order", async () => {
  const requested = [];
  let active = 0;
  let maximum = 0;
  const products = await loadSelectedProducts(["3", "1", "3", "missing", "2", "4"], async (id) => {
    requested.push(id); active++; maximum = Math.max(maximum, active);
    await Promise.resolve(); active--;
    return id === "missing" ? null : { id };
  }, 2);
  assert.deepEqual(requested, ["3", "1", "missing", "2", "4"]);
  assert.equal(maximum, 2);
  assert.deepEqual(products, [{ id: "3" }, { id: "1" }, { id: "2" }, { id: "4" }]);
});

test("an empty wishlist sends no requests and a failed product read remains a real error", async () => {
  assert.deepEqual(await loadSelectedProducts([], async () => { throw new Error("Unexpected request"); }), []);
  await assert.rejects(loadSelectedProducts(["42"], async () => { throw new Error("Offline"); }), /Offline/);
});
