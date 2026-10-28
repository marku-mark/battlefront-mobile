import test from "node:test";
import assert from "node:assert/strict";
import { createChatState } from "../src/lib/chatState.ts";
import { createChatApi } from "../src/lib/chatApi.ts";

const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test("chat serializes rapid sends and preserves a single transcript", async () => {
  const response = deferred(); let calls = 0;
  const store = createChatState(() => { calls++; return response.promise; }, () => {});
  const first = store.send("GPU advice");
  assert.equal(await store.send("GPU advice"), false);
  assert.equal(store.snapshot().messages[1].status, "sending");
  response.resolve("What is your budget?"); await first;
  assert.equal(calls, 1);
  assert.equal(store.snapshot().messages.length, 3);
  assert.equal(store.snapshot().messages[1].status, "sent");
});

test("retry keeps the failed message in place and honors server cooldown", async () => {
  let time = 0; let calls = 0;
  const store = createChatState(async () => { if (++calls === 1) throw { status: 429, retryAfter: 5, message: "Too many requests" }; return "Ready"; }, () => {}, () => time);
  await store.send("Delivery?");
  const id = store.snapshot().messages[1].id;
  assert.equal(await store.send("Delivery?", id), false);
  time = 5000; await store.send("Delivery?", id);
  assert.equal(calls, 2);
  assert.equal(store.snapshot().messages.length, 3);
  assert.equal(store.snapshot().messages[1].id, id);
});

test("reset or account change discards late successes and failures", async () => {
  for (const fails of [false, true]) {
    const response = deferred(); let resets = 0;
    const store = createChatState(() => response.promise, () => { resets++; });
    const pending = store.send("Private order"); store.reset();
    if (fails) response.reject(new Error("Offline")); else response.resolve("Private answer");
    await pending;
    assert.equal(resets, 1); assert.equal(store.snapshot().messages.length, 1);
    assert.equal(store.snapshot().pending, false); assert.equal(store.snapshot().error, "");
  }
});

test("malformed replies and network failures remain retryable", async () => {
  for (const result of ["", null, undefined]) {
    const store = createChatState(async () => result, () => {});
    await store.send("Hello");
    assert.equal(store.snapshot().messages[1].status, "failed");
    assert.match(store.snapshot().error, /unexpected/);
  }
  const store = createChatState(async () => { throw new Error("The server took too long to respond."); }, () => {});
  await store.send("Hello"); assert.match(store.snapshot().error, /too long/);
});

test("chat API carries only successful context and validates responses", async () => {
  const bodies = []; let calls = 0;
  const api = createChatApi(async (_, options) => { bodies.push(JSON.parse(options.body)); calls++; if (calls === 2) return { data: { message: "", context_token: "bad" } }; return { data: { message: "Answer", context_token: "valid" } }; });
  await api.reply("one"); await assert.rejects(api.reply("two")); await api.reply("three");
  assert.deepEqual(bodies.map(row => row.context_token), [null, "valid", "valid"]);
  api.reset(); await api.reply("new"); assert.equal(bodies.at(-1).context_token, null);
});

test("late transport response cannot restore cleared context", async () => {
  const response = deferred(); const bodies = [];
  const api = createChatApi(async (_, options) => { bodies.push(JSON.parse(options.body)); return bodies.length === 1 ? response.promise : { data: { message: "new", context_token: null } }; });
  const pending = api.reply("old"); api.reset(); response.resolve({ data: { message: "old", context_token: "old-token" } }); await pending;
  await api.reply("new"); assert.equal(bodies[1].context_token, null);
});
