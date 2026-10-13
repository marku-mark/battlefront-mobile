import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_DELIVERY_ADDRESS,
  formatDeliveryAddress,
  isCompleteDeliveryAddress,
} from "../src/lib/deliveryAddress.ts";

const locations = [{
  destination: "Bacolod City",
  code: "1800000000",
  name: "Bacolod City",
  type: "city",
  city_class: "CC",
  province: { code: "1806", name: "Negros Occidental" },
  barangays: [{ code: "1806040001", name: "Barangay 1" }],
}];

const completeAddress = {
  ...EMPTY_DELIVERY_ADDRESS,
  delivery_destination: "Bacolod City",
  delivery_barangay_code: "1806040001",
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

test("delivery address formatting omits unavailable backend selections", () => {
  assert.equal(formatDeliveryAddress(EMPTY_DELIVERY_ADDRESS, locations), "");
});
