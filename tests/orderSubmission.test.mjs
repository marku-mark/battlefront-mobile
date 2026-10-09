import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createOrderSubmission } from "../src/lib/orderSubmission.ts";
import { createApiClient, ApiError } from "../src/lib/apiClient.ts";

const pickup = { cart_item_ids: [2], recipient_name: "Test User", contact_number: "09171234567", fulfillment_method: "pickup", payment_method: "cash" };
const require = createRequire(import.meta.url);
const { transformSync } = require("@babel/core");
const { code } = transformSync(readFileSync(require.resolve("react-native/Libraries/Network/FormData"), "utf8"), {
  babelrc: false, configFile: false,
  plugins: [require.resolve("@babel/plugin-transform-flow-strip-types"), require.resolve("@babel/plugin-transform-modules-commonjs")],
});
const nativeModule = { exports: {} };
new Function("module", "exports", code)(nativeModule, nativeModule.exports);
function loadExpoModule(path, dependencies = {}) {
  const filename = new URL(`../node_modules/expo/src/${path}.ts`, import.meta.url);
  const { code } = transformSync(readFileSync(filename, "utf8"), {
    filename: filename.pathname, babelrc: false, configFile: false,
    plugins: [require.resolve("@babel/plugin-transform-typescript"), require.resolve("@babel/plugin-transform-modules-commonjs")],
  });
  const module = { exports: {} };
  new Function("module", "exports", "require", code)(module, module.exports, (name) => {
    assert.ok(name in dependencies, `Unexpected Expo dependency: ${name}`);
    return dependencies[name];
  });
  return module.exports;
}
const { installFormDataPatch } = loadExpoModule("winter/FormData");
const { convertFormDataAsync } = loadExpoModule("winter/fetch/convertFormData", {
  "../../utils/blobUtils": loadExpoModule("utils/blobUtils"),
});
installFormDataPatch(nativeModule.exports.default);
const readNativeProof = () => ({ bytes: async () => new TextEncoder().encode("image bytes") });
async function assertEncodedProof(body, name) {
  const encoded = await convertFormDataAsync(body, "test-boundary");
  const multipart = new TextDecoder().decode(encoded.body);
  assert.ok(multipart.includes(`name="payment_proof"; filename="${name}"`));
  assert.ok(multipart.includes("content-type: image/png\r\n\r\nimage bytes\r\n"));
}
function useNativeFormData(t) {
  const original = globalThis.FormData;
  globalThis.FormData = nativeModule.exports.default;
  t.after(() => { globalThis.FormData = original; });
}

test("native proof sends image bytes, picker filename and MIME type through Expo multipart encoding", async (t) => {
  useNativeFormData(t);
  const proof = { uri: "file:///phone/proof.png", name: "proof.png", type: "image/png" };
  const orders = createOrderSubmission(async (_path, options) => {
    await assertEncodedProof(options.body, proof.name);
    return { data: { id: 8 } };
  }, "native", readNativeProof);
  assert.deepEqual(await orders.placeOrder({ ...pickup, payment_method: "gcash", payment_proof: proof }), { id: 8 });
});

test("repeated proof uploads are blocked before reading the file and unlock after completion", async (t) => {
  useNativeFormData(t);
  let finish;
  let files = 0;
  let requests = 0;
  const proof = { uri: "file:///proof.png", name: "proof.png", type: "image/png" };
  const orders = createOrderSubmission(async () => { requests++; return new Promise((resolve) => { finish = resolve; }); }, "native", () => { files++; return readNativeProof(); });
  const first = orders.resubmitPaymentProof("7", proof);
  await assert.rejects(orders.resubmitPaymentProof("7", proof), /still being uploaded/);
  assert.equal(files, 1);
  assert.equal(requests, 1);
  finish({ data: { id: 7 } });
  await first;
  const next = orders.resubmitPaymentProof("7", proof);
  await Promise.resolve();
  await Promise.resolve();
  finish({ data: { id: 7 } });
  await next;
  assert.equal(requests, 2);
});

test("failed proof uploads unlock for an explicit retry without retrying automatically", async (t) => {
  useNativeFormData(t);
  let calls = 0;
  const proof = { uri: "file:///proof.png", name: "proof.png", type: "image/png" };
  const orders = createOrderSubmission(async () => { calls++; throw new Error("Offline"); }, "native", readNativeProof);
  await assert.rejects(orders.resubmitPaymentProof("7", proof), /Offline/);
  assert.equal(calls, 1);
  await assert.rejects(orders.resubmitPaymentProof("7", proof), /Offline/);
  assert.equal(calls, 2);
});

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

test("native wallet checkout encodes proof bytes and delivery details without setting a multipart boundary", async (t) => {
  useNativeFormData(t);
  const proof = { uri: "file:///phone/payment.png", name: "payment.png", type: "image/png" };
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.deepEqual(options.body.getAll("cart_item_ids[]"), ["2"]);
    assert.equal(options.body.getAll("delivery_destination")[0], "Sagay City");
    assert.equal(options.body.getAll("delivery_address")[0], "Sagay delivery address");
    assert.equal(options.body.getAll("payment_method")[0], "gcash");
    assert.equal(options.headers.has("Content-Type"), false);
    await assertEncodedProof(options.body, proof.name);
    return Response.json({ data: { id: 8 } }, { status: 201 });
  });
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1"), "native", (selected) => { assert.deepEqual(selected, proof); return readNativeProof(); });
  assert.deepEqual(await orders.placeOrder({ ...pickup, fulfillment_method: "delivery", delivery_destination: "Sagay City", delivery_address: "Sagay delivery address", payment_method: "gcash", payment_proof: proof }), { id: 8 });
});

test("a missing native image stops placement before contacting the order endpoint", async () => {
  let requests = 0;
  const orders = createOrderSubmission(async () => { requests++; }, "native", () => { throw new Error("Payment proof is no longer available. Choose the image again."); });
  await assert.rejects(orders.placeOrder({ ...pickup, payment_method: "gcash", payment_proof: { uri: "file:///missing.png", name: "proof.png", type: "image/png" } }), /Choose the image again/);
  assert.equal(requests, 0);
});

test("rejected wallet proof replacement also sends bytes through Expo multipart encoding", async (t) => {
  useNativeFormData(t);
  const proof = { uri: "file:///phone/payment.png", name: "payment.png", type: "image/png" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://backend.test/api/v1/orders/8/payment-proof");
    await assertEncodedProof(options.body, proof.name);
    return Response.json({ data: { id: 8 } });
  });
  const orders = createOrderSubmission(createApiClient("http://backend.test/api/v1"), "native", readNativeProof);
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


test("repeated placement taps cannot start another request while submission is pending", async () => {
  let finish;
  let calls = 0;
  const orders = createOrderSubmission(async () => {
    calls++;
    return new Promise((resolve) => { finish = resolve; });
  }, "native");
  const first = orders.placeOrder(pickup);
  await assert.rejects(orders.placeOrder(pickup), /still being submitted/);
  assert.equal(calls, 1);
  finish({ data: { id: 12 } });
  assert.deepEqual(await first, { id: 12 });
});

test("failed placements unlock for an explicit retry but never retry themselves", async () => {
  let calls = 0;
  const orders = createOrderSubmission(async () => {
    calls++;
    if (calls === 1) throw new Error("Offline");
    return { data: { id: 13 } };
  }, "native");
  await assert.rejects(orders.placeOrder(pickup), /Offline/);
  assert.equal(calls, 1);
  assert.deepEqual(await orders.placeOrder(pickup), { id: 13 });
  assert.equal(calls, 2);
});
