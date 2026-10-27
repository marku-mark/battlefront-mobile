import assert from "node:assert/strict";
import test from "node:test";
import { shouldRefreshOnlineOrder } from "../src/lib/paymentRecovery.ts";
test("foreground recovery refreshes pending hosted payments without claiming payment success", () => {
  const order = { statusValue: "pending", paymentStatusValue: "pending", payment: { checkout_url: "https://checkout.example.test" } };
  assert.equal(shouldRefreshOnlineOrder(order), true);
  assert.equal(shouldRefreshOnlineOrder({ ...order, paymentStatusValue: "paid" }), false);
  assert.equal(shouldRefreshOnlineOrder({ ...order, statusValue: "cancelled" }), false);
  assert.equal(shouldRefreshOnlineOrder({ ...order, statusValue: "completed" }), false);
  assert.equal(shouldRefreshOnlineOrder({ ...order, payment: {} }), false);
  assert.equal(shouldRefreshOnlineOrder(null), false);
});
