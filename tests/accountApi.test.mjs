import assert from "node:assert/strict";
import test from "node:test";
import { createAccountApi, createProfileActions } from "../src/lib/accountApi.ts";
import { ApiError, createApiClient } from "../src/lib/apiClient.ts";

const user = { id: 5, name: "Customer", email: "customer@example.com", default_delivery_address: null };
const result = { user, token: "customer-token", expires_at: "2026-11-01T00:00:00Z" };

test("registration sends confirmed credentials and returns the customer session", async (t) => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://backend.test/api/v1/auth/register");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.has("Authorization"), false);
    assert.deepEqual(JSON.parse(options.body), { name: "Customer", email: "customer@example.com", password: " password ", password_confirmation: " password ", device_name: "Battlefront Expo" });
    return Response.json({ data: result }, { status: 201 });
  });
  const account = createAccountApi(createApiClient("http://backend.test/api/v1"));
  assert.deepEqual(await account.register({ name: " Customer ", email: " customer@example.com ", password: " password ", password_confirmation: " password " }), result);
});

test("duplicate email registration exposes validation feedback and does not retry", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({ errors: { email: ["The email has already been taken."] } }, { status: 422 }));
  const account = createAccountApi(createApiClient("http://backend.test/api/v1"));
  await assert.rejects(account.register({ name: "Customer", email: user.email, password: "password", password_confirmation: "password" }), (error) => error instanceof ApiError && error.message === "The email has already been taken.");
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("profile editing uses bearer authentication and returns server-normalized account details", async (t) => {
  const updated = { ...user, name: "Updated customer", email: "updated@example.com", default_delivery_address: "12 Mabini Street, Sagay City" };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "http://backend.test/api/v1/profile");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers.get("Authorization"), "Bearer customer-token");
    assert.deepEqual(JSON.parse(options.body), updatedInput);
    return Response.json({ data: updated });
  });
  const updatedInput = { name: updated.name, email: updated.email, default_delivery_address: updated.default_delivery_address };
  const account = createAccountApi(createApiClient("http://backend.test/api/v1", () => result.token));
  assert.deepEqual(await account.updateProfile({ ...updatedInput, name: ` ${updated.name} `, email: ` ${updated.email} ` }), updated);
});

test("clearing the synced default address sends null and preserves name and email", async () => {
  const account = createAccountApi(async (path, options) => {
    assert.equal(path, "profile");
    assert.deepEqual(JSON.parse(options.body), { name: user.name, email: user.email, default_delivery_address: null });
    return { data: user };
  });
  assert.deepEqual(await account.updateProfile({ name: user.name, email: user.email, default_delivery_address: null }), user);
});

test("profile validation failures reach the editor without reporting a saved result", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ errors: { default_delivery_address: ["The default delivery address may not be greater than 255 characters."] } }, { status: 422 }));
  const account = createAccountApi(createApiClient("http://backend.test/api/v1", () => result.token));
  await assert.rejects(account.updateProfile({ name: user.name, email: user.email, default_delivery_address: "x".repeat(256) }), (error) => error instanceof ApiError && error.status === 422 && error.errors.default_delivery_address.length === 1);
});

test("successful profile saves replace the active customer snapshot with the server response", async () => {
  let activeUser = user;
  const updated = { ...user, name: "New name", default_delivery_address: "Sagay City" };
  const actions = createProfileActions({ getProfile: async () => updated, updateProfile: async () => updated }, () => user.id, (profile) => { activeUser = profile; });
  assert.deepEqual(await actions.saveProfile({ name: updated.name, email: updated.email, default_delivery_address: updated.default_delivery_address }), updated);
  assert.equal(activeUser.name, "New name");
  assert.equal(activeUser.default_delivery_address, "Sagay City");
});

test("an account change during a profile request cannot overwrite the new session", async () => {
  let owner = user.id;
  let committed = false;
  const actions = createProfileActions({ getProfile: async () => { owner = 99; return user; }, updateProfile: async () => user }, () => owner, () => { committed = true; });
  await assert.rejects(actions.refreshProfile(), /account changed/);
  assert.equal(committed, false);
});

test("a default-address editor belonging to another customer cannot send an update", async () => {
  let writes = 0;
  const actions = createProfileActions({ getProfile: async () => user, updateProfile: async () => { writes++; return user; } }, () => 99, () => {});
  await assert.rejects(actions.saveProfile({ name: user.name, email: user.email, default_delivery_address: "Sagay City" }, user.id), /account changed/);
  assert.equal(writes, 0);
});

test("failed profile saves leave the active customer snapshot unchanged", async () => {
  let activeUser = user;
  const actions = createProfileActions({ getProfile: async () => user, updateProfile: async () => { throw new Error("Offline"); } }, () => user.id, (profile) => { activeUser = profile; });
  await assert.rejects(actions.saveProfile({ name: "New name", email: user.email }), /Offline/);
  assert.equal(activeUser, user);
});
