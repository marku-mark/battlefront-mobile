import test from "node:test";
import assert from "node:assert/strict";
import { parseNotificationTarget } from "../src/lib/notificationPayload.ts";

test("notification payload accepts the current nested order link and flat contract", () => {
  assert.deepEqual(parseNotificationTarget({ deep_link: { screen: "order_detail", order_id: 42 } }), {
    screen: "order_detail", id: 42,
  });
  assert.deepEqual(parseNotificationTarget({ screen: "order_detail", id: "42", type: "order_update", channel: "default" }), {
    screen: "order_detail", id: 42, type: "order_update", channel: "default",
  });
});

test("invalid or unknown notification targets safely open the inbox", () => {
  for (const data of [undefined, {}, { screen: "order_detail", id: 0 }, { screen: "other", id: 42 }]) {
    assert.deepEqual(parseNotificationTarget(data), { screen: "notifications" });
  }
});
