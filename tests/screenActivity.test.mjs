import assert from "node:assert/strict";
import test from "node:test";
import { createScreenActivity } from "../src/lib/screenActivity.ts";

test("reads start only for a focused foreground screen and clean up on background or blur", () => {
  let starts = 0;
  let stops = 0;
  const screen = createScreenActivity(() => { starts++; return () => { stops++; }; });
  screen.update(false, true);
  screen.update(true, false);
  assert.equal(starts, 0);
  screen.update(true, true);
  screen.update(true, true);
  assert.equal(starts, 1);
  screen.update(true, false);
  assert.equal(stops, 1);
  screen.update(true, true);
  assert.equal(starts, 2);
  screen.update(false, true);
  screen.dispose();
  assert.equal(stops, 2);
});

test("cleanup prevents late read responses from publishing into a hidden screen", async () => {
  let finish;
  const updates = [];
  const response = new Promise((resolve) => { finish = resolve; });
  const screen = createScreenActivity(() => {
    let active = true;
    response.then((value) => { if (active) updates.push(value); });
    return () => { active = false; };
  });
  screen.update(true, true);
  screen.dispose();
  finish("old response");
  await response;
  assert.deepEqual(updates, []);
});
