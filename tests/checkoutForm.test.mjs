import assert from "node:assert/strict";
import test from "node:test";
import { paymentForFulfillment, paymentProofError, formatCheckoutAmount } from "../src/lib/checkoutForm.ts";

const methods = [
  { value: "cash", available_for: ["pickup"] },
  { value: "card_at_store", available_for: ["pickup"] },
  { value: "gcash", available_for: ["pickup", "delivery"] },
  { value: "maya", available_for: ["pickup", "delivery"] },
];

test("delivery replaces pickup-only payment and preserves an eligible wallet", () => {
  assert.equal(paymentForFulfillment(methods, "delivery", "cash"), "gcash");
  assert.equal(paymentForFulfillment(methods, "delivery", "card_at_store"), "gcash");
  assert.equal(paymentForFulfillment(methods, "delivery", "maya"), "maya");
  assert.equal(paymentForFulfillment(methods, "pickup", "maya"), "maya");
  assert.equal(paymentForFulfillment([], "delivery", "cash"), "");
});

test("wallet proof accepts supported images up to 5 MB and rejects missing, oversized, and unsupported proof", () => {
  assert.match(paymentProofError(null), /Choose payment proof/);
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(paymentProofError({ mimeType, fileSize: 5 * 1024 * 1024 }), null);
  }
  assert.match(paymentProofError({ mimeType: "image/gif" }), /JPEG, PNG, or WebP/);
  assert.match(paymentProofError({ mimeType: "image/png", fileSize: 5 * 1024 * 1024 + 1 }), /5 MB/);
});

test("checkout formats server prices without adding shipping or discounts", () => {
  assert.equal(formatCheckoutAmount("1234.50"), "₱1,234.50");
  assert.equal(formatCheckoutAmount("0.00"), "₱0.00");
});
