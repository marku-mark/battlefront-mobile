import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_DELIVERY_ADDRESS,
  formatDeliveryAddress,
  isCompleteDeliveryAddress,
} from "../src/lib/deliveryAddress.ts";

const locations = [{
  destination: "1830200000",
  code: "1830200000",
  name: "Bacolod City",
  type: "city",
  city_class: "HUC",
  province: null,
  barangays: [{ code: "1830200001", name: "Barangay 1" }],
}, {
  destination: "1804523000",
  code: "1804523000",
  name: "Sagay City",
  type: "city",
  city_class: "CC",
  province: { code: "1804500000", name: "Negros Occidental" },
  barangays: [{ code: "1804523018", name: "Poblacion I" }],
}];

const completeAddress = {
  ...EMPTY_DELIVERY_ADDRESS,
  delivery_destination: "1830200000",
  delivery_barangay_code: "1830200001",
  delivery_address_details: "Unit 1, Example Street",
};

test("delivery address is complete only for a backend destination and barangay", () => {
  assert.equal(isCompleteDeliveryAddress(completeAddress, locations), true);
  assert.equal(isCompleteDeliveryAddress({ ...completeAddress, delivery_destination: "" }, locations), false);
  assert.equal(isCompleteDeliveryAddress({ ...completeAddress, delivery_barangay_code: "unknown" }, locations), false);
});

test("delivery address requires non-empty details within the server limit", () => {
  assert.equal(isCompleteDeliveryAddress({ ...completeAddress, delivery_address_details: "   " }, locations), false);
  assert.equal(isCompleteDeliveryAddress({ ...completeAddress, delivery_address_details: "a".repeat(256) }, locations), false);
});

test("delivery address formatting uses the selected barangay and destination", () => {
  assert.equal(
    formatDeliveryAddress(completeAddress, locations),
    "Unit 1, Example Street, Barangay 1, Bacolod City",
  );
});

test("provincial address includes the selected Negros province and full length counts toward the limit", () => {
  const sagay = { ...completeAddress, delivery_destination: "1804523000", delivery_barangay_code: "1804523018" };
  assert.equal(formatDeliveryAddress(sagay, locations), "Unit 1, Example Street, Poblacion I, Sagay City, Negros Occidental");
  assert.equal(isCompleteDeliveryAddress({ ...sagay, delivery_address_details: "x".repeat(230) }, locations), false);
});

test("delivery address formatting omits unavailable backend selections", () => {
  assert.equal(formatDeliveryAddress(EMPTY_DELIVERY_ADDRESS, locations), "");
});
