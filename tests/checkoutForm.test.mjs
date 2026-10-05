import assert from "node:assert/strict";
import test from "node:test";
import { checkoutRecipient, paymentForFulfillment, paymentProofError, formatCheckoutAmount, checkoutDetailsError } from "../src/lib/checkoutForm.ts";

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

test("checkout selects the recipient and phone belonging to the profile default address", () => {
  const addresses = [
    { recipient: "Work recipient", phone: "09170000001", address: "Work address" },
    { recipient: "Home recipient", phone: "09170000002", address: "Home address" },
  ];
  assert.deepEqual(checkoutRecipient({ name: "Customer", default_delivery_address: "Home address" }, addresses), {
    name: "Home recipient", phone: "09170000002", address: "Home address",
  });
});

test("checkout uses the most recently saved address as a complete recipient pair when no local default matches", () => {
  assert.deepEqual(checkoutRecipient({ name: "Customer", default_delivery_address: "Old address" }, [
    { recipient: "Recipient", phone: "09170000001", address: "New address" },
  ]), { name: "Recipient", phone: "09170000001", address: "New address" });
});

test("checkout preserves a profile-only address without inventing a phone number", () => {
  assert.deepEqual(checkoutRecipient({ name: "Customer", default_delivery_address: "Profile address" }, []), {
    name: "Customer", phone: "", address: "Profile address",
  });
});

test("checkout with no saved contact details starts with the customer name and empty contact fields", () => {
  assert.deepEqual(checkoutRecipient({ name: "Customer", default_delivery_address: null }, []), {
    name: "Customer", phone: "", address: "",
  });
});


test("pickup requires contact details but never requires a delivery address", () => {
  const details = { name: "Customer", phone: "09171234567", fulfillment: "pickup", address: "", editingAddress: true, requiresProof: false, hasProof: false };
  assert.equal(checkoutDetailsError(details), null);
  assert.match(checkoutDetailsError({ ...details, name: " " }), /recipient name/);
  assert.match(checkoutDetailsError({ ...details, phone: " " }), /contact number/);
  assert.match(checkoutDetailsError({ ...details, requiresProof: true }), /payment proof/);
});

test("delivery requires a saved address and wallet proof when selected", () => {
  const details = { name: "Customer", phone: "09171234567", fulfillment: "delivery", address: "Saved address", editingAddress: false, requiresProof: true, hasProof: true };
  assert.equal(checkoutDetailsError(details), null);
  assert.match(checkoutDetailsError({ ...details, address: " " }), /delivery address/);
  assert.match(checkoutDetailsError({ ...details, editingAddress: true }), /delivery address/);
  assert.match(checkoutDetailsError({ ...details, hasProof: false }), /payment proof/);
});
