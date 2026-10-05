import assert from "node:assert/strict";
import test from "node:test";
import { createProgressiveCatalog } from "../src/lib/catalogCache.ts";
import { ApiError } from "../src/lib/apiClient.ts";

function page(data, current, last) {
  return { data, meta: { current_page: current, last_page: last, total: last } };
}

test("first products render before a slow second page; all consumers share requests", async () => {
  let finishSecond;
  const paths = [];
  const cache = createProgressiveCatalog(async (number) => {
    paths.push(number);
    return number === 1 ? page(["first"], 1, 2) : new Promise((resolve) => { finishSecond = resolve; });
  });
  const first = cache.first();
  const full = cache.all();
  assert.deepEqual(await first, ["first"]);
  assert.equal(cache.snapshot().loading, true);
  assert.deepEqual(await cache.first(), ["first"]);
  finishSecond(page(["second"], 2, 2));
  assert.deepEqual(await full, ["first", "second"]);
  assert.deepEqual(await cache.first(), ["first", "second"]);
  assert.deepEqual(paths, [1, 2]);
  assert.equal(cache.snapshot().complete, true);
});

test("a rate-limited background page stops loading and retains visible products", async () => {
  const cache = createProgressiveCatalog(async (number) => {
    if (number === 2) throw new ApiError("Too many requests. Try again later.", 429, {}, 60);
    return page(["visible"], 1, 2);
  });
  const first = cache.first();
  const full = cache.all();
  assert.deepEqual(await first, ["visible"]);
  await assert.rejects(full, ApiError);
  assert.deepEqual(cache.snapshot().rows, ["visible"]);
  assert.equal(cache.snapshot().loading, false);
  assert.equal(cache.snapshot().complete, false);
});

test("a failed refresh keeps the previous catalog and can be retried", async () => {
  let fails = false;
  const cache = createProgressiveCatalog(async () => {
    if (fails) throw new Error("Offline");
    return page(["cached"], 1, 1);
  });
  await cache.all();
  fails = true;
  cache.invalidate();
  await assert.rejects(cache.first(), /Offline/);
  assert.deepEqual(cache.snapshot().rows, ["cached"]);
  fails = false;
  assert.deepEqual(await cache.first(), ["cached"]);
});

test("retry resumes a failed page without downloading successful pages again", async () => {
  const calls = [];
  let fails = true;
  const cache = createProgressiveCatalog(async (number) => {
    calls.push(number);
    if (number === 2 && fails) throw new ApiError("Wait before retrying", 429, {}, 10);
    return page([number], number, 3);
  });
  await assert.rejects(cache.all(), ApiError);
  fails = false;
  assert.deepEqual(await cache.all(), [1, 2, 3]);
  assert.deepEqual(calls, [1, 2, 2, 3]);
});

test("refresh prevents old pagination responses from overwriting new prices", async () => {
  let finishOld;
  let run = 0;
  const cache = createProgressiveCatalog(async (number) => {
    if (number === 1) { run++; return page([run === 1 ? "old" : "new"], 1, run === 1 ? 2 : 1); }
    return new Promise((resolve) => { finishOld = resolve; });
  });
  await cache.first();
  const old = cache.next();
  cache.invalidate();
  assert.deepEqual(await cache.first(), ["new"]);
  finishOld(page(["stale"], 2, 2));
  await old;
  assert.deepEqual(cache.snapshot().rows, ["new"]);
});

test("fresh complete catalogs are reused and expired catalogs are reloaded", async () => {
  let now = 0;
  let calls = 0;
  const cache = createProgressiveCatalog(async () => page([++calls], 1, 1), 60_000, () => now);
  assert.deepEqual(await cache.all(), [1]);
  now = 59_999;
  assert.deepEqual(await cache.first(), [1]);
  now = 60_000;
  assert.deepEqual(await cache.all(), [2]);
});

test("subscribers receive progressive batches and can unsubscribe", async () => {
  const cache = createProgressiveCatalog(async (number) => page([number], number, 2));
  const updates = [];
  const unsubscribe = cache.subscribe((snapshot) => { updates.push(snapshot.rows); });
  await cache.all();
  assert.deepEqual(updates, [[], [], [1], [1], [1, 2]]);
  unsubscribe();
  cache.invalidate();
  assert.equal(updates.length, 5);
});


test("preview loads just one page and concurrent next-page requests are shared", async () => {
  const calls = [];
  const cache = createProgressiveCatalog(async (number) => {
    calls.push(number);
    return page([number], number, 3);
  });
  await cache.first();
  assert.deepEqual(calls, [1]);
  assert.equal(cache.snapshot().loading, false);
  assert.equal(cache.snapshot().complete, false);
  await Promise.all([cache.next(), cache.next()]);
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(cache.snapshot().rows, [1, 2]);
  await cache.next();
  await cache.next();
  assert.deepEqual(calls, [1, 2, 3]);
});

test("a failed demand-loaded page can be retried without losing earlier rows", async () => {
  let fails = true;
  const cache = createProgressiveCatalog(async (number) => {
    if (number === 2 && fails) throw new Error("Offline");
    return page([number], number, 2);
  });
  await cache.first();
  await assert.rejects(cache.next(), /Offline/);
  assert.deepEqual(await cache.first(), [1]);
  fails = false;
  assert.deepEqual(await cache.next(), [1, 2]);
});


test("returning to a screen retains loaded pages until an explicit refresh", async () => {
  let now = 0;
  let calls = 0;
  const cache = createProgressiveCatalog(async (number) => { calls++; return page([number], number, 2); }, 60_000, () => now);
  await cache.first(); await cache.next();
  now = 120_000;
  assert.deepEqual(await cache.resume(), [1, 2]);
  assert.equal(calls, 2);
  cache.invalidate();
  assert.deepEqual(await cache.resume(), [1]);
  assert.equal(calls, 3);
});


test("leaving a filtered screen stops fetching remaining pages and allows later resumption", async () => {
  const calls = [];
  let active = true;
  const cache = createProgressiveCatalog(async (number) => {
    calls.push(number);
    if (number === 2) active = false;
    return page([number], number, 4);
  });
  assert.deepEqual(await cache.all(() => active), [1, 2]);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(cache.snapshot().loading, false);
  assert.equal(cache.snapshot().complete, false);
  assert.deepEqual(await cache.all(), [1, 2, 3, 4]);
});
