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

test("search queries the requested server page and preserves pagination metadata", async () => {
  const { loadProductSearchPage } = await import("../src/lib/productCatalog.ts");
  const result = await loadProductSearchPage(async (path) => {
    assert.equal(path, "products?q=SSD%20%26%20RAM&page=2");
    return { data: [{ id: 91, name: "SSD", price: "2500", discount_price: null, brand: "Test", image_url: null, category: { id: 3, name: "Storage" } }], meta: { current_page: 2, last_page: 4, total: 40 } };
  }, " SSD & RAM ", 2);
  assert.equal(result.data[0].id, "91");
  assert.equal(result.data[0].price, 2500);
  assert.deepEqual(result.meta, { current_page: 2, last_page: 4, total: 40 });
});

test("short search terms send no request, while failed searches remain retryable errors", async () => {
  const { loadProductSearchPage } = await import("../src/lib/productCatalog.ts");
  let calls = 0;
  const request = async () => { calls++; throw new Error("Offline"); };
  assert.deepEqual((await loadProductSearchPage(request, " a ")).data, []);
  assert.equal(calls, 0);
  await assert.rejects(loadProductSearchPage(request, "monitor"), /Offline/);
  assert.equal(calls, 1);
});
