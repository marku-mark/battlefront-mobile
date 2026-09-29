import assert from "node:assert/strict";
import test from "node:test";
import { calculateCheckoutPricing } from "../src/lib/checkoutPricing.ts";

test("free shipping threshold includes a subtotal of exactly 5000", () => {
  assert.equal(calculateCheckoutPricing(5000).shippingFee, 0);
  assert.equal(calculateCheckoutPricing(4999).shippingFee, 150);
});

test("FREESHIP discounts shipping instead of merchandise", () => {
  const pricing = calculateCheckoutPricing(2500, "FREESHIP");
  assert.equal(pricing.productDiscount, 0);
  assert.equal(pricing.shippingDiscount, 150);
  assert.equal(pricing.shippingFee, 0);
  assert.equal(pricing.total, 2500);
});

test("FREESHIP adds no discount when delivery is already free", () => {
  const pricing = calculateCheckoutPricing(6000, "FREESHIP");
  assert.equal(pricing.discountAmount, 0);
  assert.equal(pricing.total, 6000);
});

test("SAVE150 is limited by subtotal and does not discount shipping", () => {
  const pricing = calculateCheckoutPricing(100, "SAVE150");
  assert.equal(pricing.productDiscount, 100);
  assert.equal(pricing.shippingFee, 150);
  assert.equal(pricing.total, 150);
});

test("percentage promotion respects its cap", () => {
  const pricing = calculateCheckoutPricing(10000, "BATTLEFRONT10");
  assert.equal(pricing.productDiscount, 500);
  assert.equal(pricing.total, 9500);
});

test("store pickup has no shipping fee", () => {
  const pricing = calculateCheckoutPricing(2000, "", "pickup");
  assert.equal(pricing.shippingFee, 0);
  assert.equal(pricing.total, 2000);
});