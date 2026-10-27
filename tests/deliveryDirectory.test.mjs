import assert from "node:assert/strict";
import test from "node:test";
import { createDeliveryDirectory } from "../src/lib/deliveryDirectory.ts";

test("nationwide city recovery preserves its region province and barangays instead of assuming Negros", async () => {
  const calls = [];
  const city = { code: "city-code", name: "Provincial City", destination: "Provincial City", region_code: "region-code", province_code: "province-code", type: "city", city_class: "CC" };
  const directory = createDeliveryDirectory(async (path) => {
    calls.push(path);
    const level = new URLSearchParams(path.split("?")[1]).get("level");
    return { data: { locations: level === "city" ? [city] : level === "provinces" ? [{ code: "province-code", name: "Selected Province", region_code: "region-code" }] : [{ code: "barangay-code", name: "Barangay" }] } };
  });
  const result = await directory.resolveCity("city-code");
  assert.equal(result.region_code, "region-code"); assert.equal(result.province.code, "province-code");
  assert.deepEqual(result.barangays, [{ code: "barangay-code", name: "Barangay" }]);
  assert.deepEqual(calls, ["delivery-locations?level=city&parent_code=city-code", "delivery-locations?level=provinces&parent_code=region-code", "delivery-locations?level=barangays&parent_code=city-code"]);
  await directory.resolveCity("city-code"); assert.equal(calls.length, 3);
});

test("independent city recovery keeps a null province and never inserts a neighboring province", async () => {
  const directory = createDeliveryDirectory(async (path) => {
    const level = new URLSearchParams(path.split("?")[1]).get("level");
    return { data: { locations: level === "city" ? [{ code: "city", name: "Independent City", destination: "Independent City", region_code: "region", province_code: null, type: "city", city_class: "HUC" }] : level === "provinces" ? [{ code: "neighbor", name: "Other Province" }] : [] } };
  });
  assert.equal((await directory.resolveCity("city")).province, null);
});

test("failed geography reads can be retried without caching a missing city as a valid address", async () => {
  let calls = 0;
  const directory = createDeliveryDirectory(async () => { calls++; if (calls === 1) throw new Error("Offline"); return { data: { locations: [] } }; });
  await assert.rejects(directory.resolveCity("missing"), /Offline/);
  await assert.rejects(directory.resolveCity("missing"), /no longer available/);
  assert.equal(calls, 2);
});
