import assert from "node:assert/strict";
import test from "node:test";
import { mapProduct, getProductFacts } from "../src/lib/productCatalog.ts";
import { getProductImageSource } from "../src/lib/data.ts";

const product = { id: 42, name: "Memory kit", description: "32GB DDR5-6000 memory kit.", brand: "Kingston", price: "1200.00", discount_price: "900.00", image_url: "http://backend.test/storage/42.webp", category: { id: 3, name: "RAM / Memory" }, inventory: { status: "low_stock" } };

test("mobile details preserve the server description, category, price, and stock status", () => {
  const mapped = mapProduct(product);
  const facts = getProductFacts(mapped);
  assert.equal(mapped.id, "42");
  assert.equal(mapped.price, 900);
  assert.equal(mapped.originalPrice, 1200);
  assert.equal(mapped.categorySlug, "category-ram-memory");
  assert.equal(facts.description, product.description);
  assert.equal(facts.availability, "Low stock");
  assert.deepEqual(facts.specifications, [["Category", "RAM / Memory"], ["Availability", "Low stock"], ["Brand", "Kingston"]]);
});

test("missing descriptions and inventory do not invent product facts or availability", () => {
  const mapped = mapProduct({ ...product, description: null, inventory: undefined, brand: null, discount_price: null });
  const facts = getProductFacts(mapped);
  assert.equal(mapped.price, 1200);
  assert.equal(mapped.originalPrice, undefined);
  assert.equal(mapped.availability, "unavailable");
  assert.equal(facts.availability, "Unavailable");
  assert.equal(facts.description, "No description has been provided for this product.");
  assert.equal(facts.specifications.some(([label]) => label === "Brand"), false);
  assert.doesNotMatch(JSON.stringify(facts), /Ready to ship|Warranty included|Ships in 24 hours/);
});

test("out-of-stock products keep their server description without promising shipping", () => {
  const facts = getProductFacts(mapProduct({ ...product, inventory: { status: "out_of_stock" } }));
  assert.equal(facts.availability, "Out of stock");
  assert.equal(facts.description, product.description);
});

test("catalog images use the exact URL supplied by the backend", () => {
  const mapped = mapProduct(product);
  assert.equal(mapped.image, product.image_url);
  assert.deepEqual(getProductImageSource(mapped.image), { uri: product.image_url });
});

test("missing backend images have no bundled product fallback", () => {
  const mapped = mapProduct({ ...product, image_url: null });
  assert.equal(getProductImageSource(mapped.image), undefined);
});

test("old bundled image IDs and device-local paths cannot become catalog image sources", () => {
  for (const localImage of [42, "assets/product_images/42.webp", "file:///catalog/42.webp", "data:image/webp;base64,AAAA"]) {
    assert.equal(getProductImageSource(localImage), undefined);
  }
});
