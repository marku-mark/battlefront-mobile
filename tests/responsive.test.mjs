import assert from "node:assert/strict";
import test from "node:test";
import { getResponsiveLayout, getGridCardWidth } from "../src/lib/responsive.ts";

test("large text uses fewer columns so product controls remain readable", () => {
  assert.equal(getResponsiveLayout(390).productColumns, 2);
  assert.equal(getResponsiveLayout(390, 1.5).productColumns, 1);
  assert.equal(getResponsiveLayout(768, 1.5).productColumns, 2);
  const columns = getResponsiveLayout(390, 1.5).productColumns;
  assert.equal(getGridCardWidth(390, columns), 358);
});

test("wide layouts stay within the content limit", () => {
  assert.equal(getResponsiveLayout(1800).contentWidth, 1280);
  assert.equal(getResponsiveLayout(1800).productColumns, 4);
  assert.equal(getGridCardWidth(1800, 4), 303);
});
