import test from "node:test";
import assert from "node:assert/strict";
import { createNotificationApi } from "../src/lib/notificationApi.ts";

test("notification API uses Laravel history, count, and read contracts", async () => {
  const calls = [];
  const notification = { id: "notice-1", is_read: true };
  const responses = [
    { data: [notification], meta: { current_page: 2, last_page: 3, unread_count: 4 } },
    { data: { unread_count: 4 } },
    { data: notification, meta: { unread_count: 3 } },
    { data: { unread_count: 0 } },
  ];
  const api = createNotificationApi(async (path, options) => {
    calls.push([path, options?.method ?? "GET"]);
    return responses.shift();
  }, () => 1);

  assert.equal((await api.getNotifications(2)).meta.unread_count, 4);
  assert.equal(await api.getUnreadNotificationCount(), 4);
  assert.deepEqual(await api.markNotificationRead("notice-1"), { notification, unreadCount: 3 });
  assert.equal(await api.markAllNotificationsRead(), 0);
  assert.deepEqual(calls, [
    ["notifications?page=2", "GET"],
    ["notifications/unread-count", "GET"],
    ["notifications/notice-1/read", "PATCH"],
    ["notifications/read-all", "PATCH"],
  ]);
});

test("a late notification response cannot be used by another session", async () => {
  let revision = 1;
  let release;
  const api = createNotificationApi(() => new Promise((resolve) => { release = resolve; }), () => revision);
  const pending = api.getNotifications();
  revision = 2;
  release({ data: [], meta: { current_page: 1, last_page: 1, unread_count: 0 } });
  await assert.rejects(pending, /account changed/);
});
