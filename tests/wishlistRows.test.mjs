import assert from "node:assert/strict";
import test from "node:test";
import { wishlistRows } from "../src/lib/wishlistRows.ts";
test("unavailable saved products remain visible and removable without inventing catalog details", () => {
  const product = { id: "2", name: "Available product", price: 100 };
  assert.deepEqual(wishlistRows(["1", "2", "3"], [product]), [{ id: "1", unavailable: true }, product, { id: "3", unavailable: true }]);
});
test("wishlist rendering follows saved order and excludes products no longer saved", () => {
  assert.deepEqual(wishlistRows(["2", "1"], [{ id: "1" }, { id: "2" }, { id: "3" }]), [{ id: "2" }, { id: "1" }]);
});
