import assert from "node:assert/strict";
import test from "node:test";
import {
  getAddressByBarangayCode,
  getAllBarangays,
  getAllMunicipalities,
  getAllRegions,
  getBarangaysByMunicipality,
  getProvincesByRegion,
} from "@aivangogh/ph-address";
import {
  EMPTY_PHILIPPINE_ADDRESS,
  formatPhilippineAddress,
  isCompletePhilippineAddress,
  toPhilippineAddressFields,
} from "../src/lib/philippineAddress.ts";

const completeNcrAddress = {
  ...EMPTY_PHILIPPINE_ADDRESS,
  region: "National Capital Region (NCR)",
  regionCode: "1300000000",
  localityParentCode: "1300000000",
  city: "City of Manila",
  cityCode: "1339000000",
  barangay: "Barangay 1",
  barangayCode: "1339000001",
  street: "Unit 1, Example Street",
  zipCode: "1000",
};

test("address validation allows region-level cities without a province", () => {
  assert.equal(isCompletePhilippineAddress(completeNcrAddress), true);
});

test("address validation requires a selected barangay, street, and four-digit ZIP", () => {
  assert.equal(isCompletePhilippineAddress({ ...completeNcrAddress, barangayCode: "" }), false);
  assert.equal(isCompletePhilippineAddress({ ...completeNcrAddress, street: "   " }), false);
  assert.equal(isCompletePhilippineAddress({ ...completeNcrAddress, zipCode: "100" }), false);
});

test("address formatting uses Philippine locality order and omits an inapplicable province", () => {
  assert.equal(
    formatPhilippineAddress(completeNcrAddress),
    "Unit 1, Example Street, Barangay 1, City of Manila, National Capital Region (NCR), 1000",
  );
});

test("legacy saved addresses remain visible as street text while requiring structured location selection", () => {
  const fields = toPhilippineAddressFields({ address: "12 Demo Street, Bacolod City" });
  assert.equal(fields.street, "12 Demo Street, Bacolod City");
  assert.equal(fields.regionCode, "");
  assert.equal(isCompletePhilippineAddress(fields), false);
});

test("region-level addresses fall back to the region when their province code is empty", () => {
  const fields = toPhilippineAddressFields({ regionCode: "1300000000", provinceCode: "" });
  assert.equal(fields.localityParentCode, "1300000000");
});

test("PSGC dataset exposes NCR localities and independent cities", () => {
  const ncr = getAllRegions().find((region) => region.psgcCode === "1300000000");
  assert.ok(ncr);
  assert.equal(getProvincesByRegion(ncr.psgcCode).length, 0);

  const bacolod = getAllMunicipalities().find((municipality) => municipality.name === "Bacolod City");
  assert.ok(bacolod);
  const [barangay] = getBarangaysByMunicipality(bacolod.psgcCode);
  assert.ok(barangay);
  assert.equal(getAllBarangays().some((item) => item.psgcCode === barangay.psgcCode), true);
  const bacolodAddress = getAddressByBarangayCode(barangay.psgcCode);
  assert.equal(bacolodAddress?.region.psgcCode, "1800000000");
  assert.equal(bacolodAddress?.province, undefined);
});