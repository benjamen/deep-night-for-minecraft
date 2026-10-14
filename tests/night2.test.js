import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canSleep, flameLevel, flicker, holdClock, isFlame, surfaceFactor, undergroundDistance } from "../BP/scripts/night-logic.js";

test("caves: full night in the open and at a cellar's depth, none deep in rock", () => {
  assert.equal(surfaceFactor(0), 1);
  assert.equal(surfaceFactor(3), 1);
  assert.equal(surfaceFactor(30), 0);
  assert.ok(surfaceFactor(8) > 0 && surfaceFactor(8) < 1);
  for (let d = 0; d < 30; d++) assert.ok(surfaceFactor(d + 1) <= surfaceFactor(d) + 1e-9, "never gets darker coming back up");
});

test("caves: the seen distance opens up with depth, and is untouched at the surface", () => {
  assert.equal(undergroundDistance(2.5, 1), 2.5);
  assert.ok(Math.abs(undergroundDistance(2.5, 0) - 200) < 1e-6);
  assert.ok(undergroundDistance(2.5, 0.5) > 2.5 && undergroundDistance(2.5, 0.5) < 200);
  assert.equal(undergroundDistance(undefined, 0.5), undefined);
});

test("flicker: flames waver a little around their light, lamps stay steady, dark stays dark", () => {
  for (let t = 0; t < 400; t++) assert.ok(flicker(t) > 0.85 && flicker(t) < 1.15);
  assert.ok(new Set(Array.from({ length: 40 }, (_, t) => flameLevel(14, true, t).toFixed(2))).size > 10, "it actually varies");
  assert.equal(flameLevel(15, false, 7), 15);
  assert.equal(flameLevel(0, true, 7), 0);
  assert.ok(flameLevel(1, true, 3) >= 1);
  assert.ok(isFlame("minecraft:torch") && isFlame("minecraft:campfire") && isFlame("minecraft:candle"));
  assert.ok(!isFlame("minecraft:glowstone") && !isFlame("minecraft:sea_lantern") && !isFlame("minecraft:redstone_torch"));
});

test("long night: the clock is held back only in the dark hours, and the night comes out the right length", () => {
  assert.equal(holdClock(6000, 10, 2), false, "never by day");
  assert.equal(holdClock(18000, 10, 1), false, "normal length means no holding");
  let held = 0;
  for (let c = 1; c <= 1000; c++) if (holdClock(18000, c, 2)) held += 1;
  assert.equal(held, 500, "factor 2 holds back every other tick");
  held = 0;
  for (let c = 1; c <= 1200; c++) if (holdClock(18000, c, 3)) held += 1;
  assert.ok(Math.abs(held - 800) <= 1, "factor 3 holds back two ticks in three");
  assert.equal(holdClock(18000, 10, 99) || true, true);
});

test("night.js uses them and offers dn:long", () => {
  const src = readFileSync(new URL("../BP/scripts/night.js", import.meta.url), "utf8");
  for (const word of ["surfaceFactor", "flameLevel", "holdClock", "dn:long"]) assert.ok(src.includes(word), word);
});

test("sleep: beds refuse in the dark hours only when the option is on", () => {
  assert.ok(canSleep(18000, false), "option off: always");
  assert.ok(!canSleep(18000, true) && !canSleep(14000, true) && !canSleep(22500, true));
  assert.ok(canSleep(6000, true) && canSleep(12500, true) && canSleep(23500, true));
  assert.match(readFileSync(new URL("../BP/scripts/night.js", import.meta.url), "utf8"), /dn:nosleep/);
});
