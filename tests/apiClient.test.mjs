import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, collectPages, createApiClient, retryRateLimitedRead } from "../src/lib/apiClient.ts";

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
