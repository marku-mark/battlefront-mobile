import assert from "node:assert/strict";
import test from "node:test";
import { createPcBuilderApi, migrateLocalBuild, readLegacyBuilds, buildSubtotal } from "../src/lib/pcBuilderApi.ts";

test("saved build edits retain quantities configuration and the server edit version", async () => {
  const input = { name: "My PC", mode: "advanced", budget: "25000.00", edit_version: 4, components: [{ key: "fan-1", product_id: 8, quantity: 2, configuration: { mounting_position: "front" } }] };
  const api = createPcBuilderApi(async (path, options) => {
    assert.equal(path, "pc-builds/build-uuid"); assert.equal(options.method, "PATCH"); assert.deepEqual(JSON.parse(options.body), input);
    return { data: { uuid: "build-uuid", edit_version: 5 } };
  });
  assert.deepEqual(await api.save(input, "build-uuid"), { uuid: "build-uuid", edit_version: 5 });
});

test("build operations use the versioned mobile routes and JSON envelopes", async () => {
  const calls = [];
  const api = createPcBuilderApi(async (path, options) => { calls.push([path, options.method]); return { data: [] }; });
  await api.catalog(); await api.list(); await api.validate([]); await api.duplicate("id"); await api.share("id"); await api.stopSharing("id"); await api.shared("token"); await api.addToCart("id"); await api.remove("id");
  assert.deepEqual(calls, [["pc-builder", "GET"], ["pc-builds", "GET"], ["pc-builder/validate", "POST"], ["pc-builds/id/duplicate", "POST"], ["pc-builds/id/share", "POST"], ["pc-builds/id/share", "DELETE"], ["pc-builds/shared/token", "GET"], ["pc-builds/id/cart", "POST"], ["pc-builds/id", "DELETE"]]);
});

test("uncertain build-to-cart requests are never automatically repeated", async () => {
  let calls = 0;
  const api = createPcBuilderApi(async () => { calls++; throw new Error("Connection interrupted"); });
  await assert.rejects(api.addToCart("build"), /Connection interrupted/); assert.equal(calls, 1);
});

test("local build import preserves its source and flags missing mismatched and stockless products", () => {
  const original = { id: "old", name: "Old build", savedAt: "2026-10-01", selections: { cpu: "1", motherboard: "2", graphics: "3", storage: "4" } };
  const before = JSON.stringify(original);
  const catalog = { components: { processor: [{ id: 1, component_type: "processor", stock_quantity: 2 }, { id: 2, component_type: "processor", stock_quantity: 2 }], storage: [{ id: 4, component_type: "storage", stock_quantity: 0 }] } };
  const result = migrateLocalBuild(original, catalog);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(result.input.components, [{ key: "processor-1", product_id: 1, component_type: "processor", quantity: 1, configuration: {} }]);
  assert.deepEqual(result.missing, ["Motherboard", "Graphics card", "Storage"]);
});

test("corrupt legacy builds do not prevent importing valid local builds", () => {
  assert.deepEqual(readLegacyBuilds("invalid JSON"), []);
  assert.equal(readLegacyBuilds(JSON.stringify([null, {}, { id: "one", name: "My build", selections: { cpu: "1" } }])).length, 1);
});

test("builder totals use decimal-safe catalog prices and selected quantities", () => {
  assert.equal(buildSubtotal([{ product_id: 1, quantity: 3 }, { product_id: 2, quantity: 1 }], [{ id: 1, price: "0.10" }, { id: 2, price: "0.20" }]), 0.5);
});
