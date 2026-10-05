import assert from "node:assert/strict";
import test from "node:test";
import { createCachedRead } from "../src/lib/apiClient.ts";

test("catalog and filter reads fetch updated values after one minute", async () => {
  let now = 0;
  let calls = 0;
  const cache = createCachedRead(async () => ++calls, 60_000, () => now);
  assert.equal(await cache.read(), 1);
  now = 59_999;
  assert.equal(await cache.read(), 1);
  now = 60_000;
  assert.equal(await cache.read(), 2);
});

test("slow pagination is shared even after the freshness period has elapsed", async () => {
  let now = 0;
  let complete;
  let calls = 0;
  const cache = createCachedRead(() => { calls++; return new Promise((resolve) => { complete = resolve; }); }, 60_000, () => now);
  const first = cache.read();
  await Promise.resolve();
  now = 120_000;
  assert.equal(cache.read(), first);
  complete(["new price"]);
  assert.deepEqual(await first, ["new price"]);
  now += 59_999;
  assert.equal(cache.read(), first);
  assert.equal(calls, 1);
});

test("pull-to-refresh and order placement invalidate completed catalog snapshots", async () => {
  let calls = 0;
  const cache = createCachedRead(async () => ++calls, 60_000);
  assert.equal(await cache.read(), 1);
  cache.invalidate();
  assert.equal(await cache.read(), 2);
});

test("invalidation during pagination avoids duplicate loads and expires its result", async () => {
  let complete;
  let calls = 0;
  const cache = createCachedRead(() => { calls++; return calls === 1 ? new Promise((resolve) => { complete = resolve; }) : Promise.resolve("current"); }, 60_000);
  const first = cache.read();
  await Promise.resolve();
  cache.invalidate();
  assert.equal(cache.read(), first);
  complete("old");
  await first;
  assert.equal(await cache.read(), "current");
  assert.equal(calls, 2);
});

test("a failed catalog load can be retried without retaining a rejected promise", async () => {
  let calls = 0;
  const cache = createCachedRead(async () => { if (++calls === 1) throw new Error("Offline"); return []; }, 60_000);
  await assert.rejects(cache.read(), /Offline/);
  assert.deepEqual(await cache.read(), []);
});
