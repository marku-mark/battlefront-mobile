import assert from "node:assert/strict";
import test from "node:test";
import { createOrderSubmission } from "../src/lib/orderSubmission.ts";
import { createApiClient, ApiError } from "../src/lib/apiClient.ts";

const pickup = { recipient_name: "Test User", contact_number: "09171234567", fulfillment_method: "pickup", payment_method: "cash" };

test("phone pickup checkout sends authenticated JSON and returns the created order", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://backend.test/api/v1/orders");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Authorization"), "Bearer customer-token");
    assert.equal(options.headers.get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(options.body), pickup);
    return Response.json({ data: { id: 7, status: { value: "pending" } } }, { status: 201 });
  });
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1", () => "customer-token"), "native");
  assert.deepEqual(await orders.placeOrder(pickup), { id: 7, status: { value: "pending" } });
});

test("native wallet checkout sends readable image bytes and delivery details without setting a multipart boundary", async (t) => {
  const proof = { uri: "file:///phone/payment.png", name: "payment.png", type: "image/png" };
  const image = new Blob(["native image bytes"], { type: "image/png" });
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.body.get("delivery_address"), "Sagay delivery address");
    assert.equal(options.body.get("payment_method"), "gcash");
    assert.equal(options.headers.has("Content-Type"), false);
    const uploaded = options.body.get("payment_proof");
    assert.equal(uploaded.name, "payment.png");
    assert.equal(uploaded.type, "image/png");
    assert.equal(await uploaded.text(), "native image bytes");
    return Response.json({ data: { id: 8 } }, { status: 201 });
  });
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1"), "native", (selected) => { assert.deepEqual(selected, proof); return image; });
  assert.deepEqual(await orders.placeOrder({ ...pickup, fulfillment_method: "delivery", delivery_address: "Sagay delivery address", payment_method: "gcash", payment_proof: proof }), { id: 8 });
});

test("a missing native image stops placement before contacting the order endpoint", async () => {
  let requests = 0;
  const orders = createOrderSubmission(async () => { requests++; }, "native", () => { throw new Error("Payment proof is no longer available. Choose the image again."); });
  await assert.rejects(orders.placeOrder({ ...pickup, payment_method: "gcash", payment_proof: { uri: "file:///missing.png", name: "proof.png", type: "image/png" } }), /Choose the image again/);
  assert.equal(requests, 0);
});

test("rejected wallet proof replacement uses the same readable native file upload", async (t) => {
  const proof = { uri: "file:///phone/payment.png", name: "payment.png", type: "image/png" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://backend.test/api/v1/orders/8/payment-proof");
    assert.equal(await options.body.get("payment_proof").text(), "replacement bytes");
    return Response.json({ data: { id: 8 } });
  });
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1"), "native", () => new Blob(["replacement bytes"], { type: "image/png" }));
  assert.deepEqual(await orders.resubmitPaymentProof("8", proof), { id: 8 });
});

test("browser wallet checkout sends actual image bytes and a supported filename", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url === "blob:proof") return new Response(new Blob(["image bytes"], { type: "image/png" }));
    const proof = options.body.get("payment_proof");
    assert.equal(proof.name, "proof.png");
    assert.equal(proof.type, "image/png");
    assert.equal(await proof.text(), "image bytes");
    assert.equal(options.body.get("fulfillment_method"), "pickup");
    return Response.json({ data: { id: 9 } }, { status: 201 });
  });
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1"), "web");
  assert.deepEqual(await orders.placeOrder({ ...pickup, payment_method: "maya", payment_proof: { uri: "blob:proof", name: "proof.png", type: "image/png" } }), { id: 9 });
});

test("failed order submissions expose validation errors and are never retried automatically", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ errors: { cart: ["Your cart has changed."] } }, { status: 422 }));
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1"), "native");
  await assert.rejects(orders.placeOrder(pickup), (error) => error instanceof ApiError && error.message === "Your cart has changed.");
  assert.equal(fetch.mock.callCount(), 1);
});

test("an unreadable browser proof prevents submission", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1"), "web");
  await assert.rejects(orders.placeOrder({ ...pickup, payment_method: "maya", payment_proof: { uri: "blob:missing", name: "proof.png", type: "image/png" } }), /Choose the image again/);
  assert.equal(fetch.mock.callCount(), 1);
});
