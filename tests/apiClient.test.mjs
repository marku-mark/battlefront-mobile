import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, collectPages, createApiClient, retryRateLimitedRead, createPacedRead } from "../src/lib/apiClient.ts";

test("requests use the configured API root and bearer authentication", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://backend.test/api/v1/cart");
    assert.equal(options.headers.get("Accept"), "application/json");
    assert.equal(options.headers.get("Authorization"), "Bearer customer-token");
    return Response.json({ data: { items: [] } });
  });
  const request = createApiClient("http://backend.test/api/v1/", () => "customer-token");
  assert.deepEqual(await request("/cart"), { data: { items: [] } });
});
test("guest requests omit credentials and multipart uploads retain their boundary", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.headers.has("Authorization"), false);
    assert.equal(options.headers.has("Content-Type"), false);
    assert.ok(options.body instanceof FormData);
    return Response.json({ data: { id: 1 } }, { status: 201 });
  });
  const body = new FormData(); body.append("recipient_name", "Customer");
  await createApiClient("http://backend.test/api/v1")("orders", { method: "POST", body });
});
test("logout handles 204 without parsing a JSON body", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));
  assert.equal(await createApiClient("http://backend.test/api/v1")("auth/logout", { method: "POST" }), undefined);
});
test("validation messages remain actionable and writes are never automatically retried", async (t) => {
  const mocked = t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Invalid", errors: { quantity: ["Not enough stock."] } }, { status: 422 }));
  await assert.rejects(createApiClient("http://backend.test/api/v1")("orders", { method: "POST", body: "{}" }), (error) => error instanceof ApiError && error.status === 422 && error.message === "Not enough stock.");
  assert.equal(mocked.mock.callCount(), 1);
});
test("an expired customer token invalidates the local session", async (t) => {
  let expired = false;
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Unauthenticated." }, { status: 401 }));
  await assert.rejects(createApiClient("http://backend.test/api/v1", () => "expired", () => { expired = true; })("profile"), ApiError);
  assert.equal(expired, true);
});
test("rate limit responses expose Retry-After", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Too many requests." }, { status: 429, headers: { "Retry-After": "42" } }));
  await assert.rejects(createApiClient("http://backend.test/api/v1")("products"), (error) => error instanceof ApiError && error.retryAfter === 42);
});

test("server cooldown prevents repeated requests and never retries an order automatically", async (t) => {
  let now = 0;
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Too Many Attempts." }, { status: 429, headers: { "Retry-After": "42" } }));
  const request = createApiClient("http://backend.test/api/v1", () => null, () => {}, () => now);
  await assert.rejects(request("products"), (error) => error.retryAfter === 42 && /42 seconds/.test(error.message));
  now = 10_000;
  await assert.rejects(request("orders", { method: "POST", body: "{}" }), (error) => error.status === 429 && error.retryAfter === 32);
  assert.equal(fetch.mock.callCount(), 1);
  now = 42_000;
  await assert.rejects(request("products"), ApiError);
  assert.equal(fetch.mock.callCount(), 2);
});

test("missing or invalid cooldown headers use a bounded one-minute cooldown", async (t) => {
  for (const header of [null, "invalid", "-1"]) {
    const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 429, headers: header === null ? {} : { "Retry-After": header } }));
    const request = createApiClient("http://backend.test/api/v1", () => null, () => {}, () => 0);
    await assert.rejects(request("products"), (error) => error.retryAfter === 60);
    await assert.rejects(request("cart"), (error) => error.retryAfter === 60);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test("concurrent catalog requests are spaced to leave room for customer actions", async () => {
  let now = 0;
  const starts = [];
  const read = createPacedRead(async (path) => { starts.push([path, now]); return path; }, 2500, () => now, async (delay) => { now += delay; });
  assert.deepEqual(await Promise.all([read("products?page=1"), read("products/filters"), read("products?page=2")]), ["products?page=1", "products/filters", "products?page=2"]);
  assert.deepEqual(starts, [["products?page=1", 0], ["products/filters", 2500], ["products?page=2", 5000]]);
});

test("a failed catalog request does not block later reads or trigger an automatic retry", async () => {
  let calls = 0;
  let now = 0;
  const read = createPacedRead(async () => { if (++calls === 1) throw new Error("Offline"); return "recovered"; }, 2500, () => now, async (delay) => { now += delay; });
  await assert.rejects(read("products"), /Offline/);
  assert.equal(await read("products"), "recovered");
  assert.equal(calls, 2);
  assert.equal(now, 2500);
});

test("an old unauthorized response cannot sign out a newly authenticated customer", async (t) => {
  let token = "old-token";
  let expired = false;
  t.mock.method(globalThis, "fetch", async () => {
    token = "new-token";
    return Response.json({ message: "Unauthenticated." }, { status: 401 });
  });
  const request = createApiClient("http://backend.test/api/v1", () => token, () => { expired = true; });
  await assert.rejects(request("profile"), ApiError);
  assert.equal(expired, false);
});
test("catalog pagination collects every page without following a foreign next URL", async () => {
  const paths = [];
  const rows = await collectPages(async (path) => {
    paths.push(path);
    return { data: [paths.length], meta: { current_page: paths.length, last_page: 3 }, links: { next: "http://foreign.test" } };
  }, "products?category_id=2");
  assert.deepEqual(rows, [1, 2, 3]);
  assert.deepEqual(paths, ["products?category_id=2&page=1", "products?category_id=2&page=2", "products?category_id=2&page=3"]);
});
test("connection failures explain how to recover", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });
  await assert.rejects(createApiClient("http://backend.test/api/v1")("health"), /API address and Wi-Fi/);
});

test("server failures with HTML bodies report HTTP errors instead of blaming Wi-Fi", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Server error</html>", { status: 500 }));
  await assert.rejects(createApiClient("http://backend.test/api/v1")("orders", { method: "POST", body: "{}" }), (error) => error instanceof ApiError && error.status === 500 && /HTTP 500/.test(error.message));
});

test("HTML upload rejection explains the server upload limit", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Too large", { status: 413 }));
  await assert.rejects(createApiClient("http://backend.test/api/v1")("orders"), (error) => error instanceof ApiError && /smaller image/.test(error.message));
});

test("a non-JSON order confirmation directs the customer to check history before retrying", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<html>Created</html>", { status: 201 }));
  await assert.rejects(createApiClient("http://backend.test/api/v1")("orders"), (error) => error instanceof ApiError && /check My orders/.test(error.message));
});

test("rate-limited catalog filters wait for Retry-After then recover", async () => {
  let attempts = 0;
  const delays = [];
  const read = retryRateLimitedRead(async (path) => {
    assert.equal(path, "products/filters");
    if (++attempts === 1) throw new ApiError("Too many requests.", 429, {}, 3);
    return { data: { categories: [], brands: [] } };
  }, async (milliseconds) => { delays.push(milliseconds); });
  assert.deepEqual(await read("products/filters"), { data: { categories: [], brands: [] } });
  assert.deepEqual(delays, [3000]);
  assert.equal(attempts, 2);
});

test("catalog recovery is bounded and does not retry connection or server errors", async () => {
  for (const status of [429, 500]) {
    let attempts = 0;
    const read = retryRateLimitedRead(async () => { attempts++; throw new ApiError("Unavailable", status); }, async () => {});
    await assert.rejects(read("products"), ApiError);
    assert.equal(attempts, status === 429 ? 2 : 1);
  }
});
