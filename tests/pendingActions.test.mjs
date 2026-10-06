import assert from "node:assert/strict";
import test from "node:test";
import { createPendingActions } from "../src/lib/pendingActions.ts";

test("rapid repeated adds share one action while different products remain independent", async () => {
  const actions = createPendingActions();
  let calls = 0;
  let finish;
  const first = actions.run("customer:product", () => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  assert.equal(actions.run("customer:product", async () => { calls++; }), first);
  assert.equal(await actions.run("customer:other", async () => "other"), "other");
  finish(true);
  assert.equal(await first, true);
  assert.equal(calls, 1);
  assert.equal(await actions.run("customer:product", async () => "added again"), "added again");
});

test("failed actions unlock and customer identities do not share pending adds", async () => {
  const actions = createPendingActions();
  const failed = actions.run("first:product", async () => { throw new Error("Offline"); });
  assert.equal(await actions.run("second:product", async () => "second cart"), "second cart");
  await assert.rejects(failed, /Offline/);
  assert.equal(await actions.run("first:product", async () => "retry"), "retry");
});
