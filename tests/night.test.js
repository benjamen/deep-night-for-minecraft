import assert from "node:assert/strict";
import { test } from "node:test";
import { CUES, MODES, NIGHT, cueGap, darknessAt, easeDistance, lightRadius, nextCue, seeingDistance, visibleDistance } from "../BP/scripts/night-logic.js";

test("darkness follows the clock: none by day, a normal night first, pitch black after midnight, easing before dawn", () => {
  assert.equal(darknessAt(6000), 0, "noon");
  assert.equal(darknessAt(12000), 0, "dusk begins from nothing");
  assert.ok(darknessAt(13500) >= 0.95 && darknessAt(13500) <= 1.05, "early evening is dusk gloom");
  const deep = darknessAt(16000);
  assert.ok(deep > 1.3 && deep < 2.3, `a normal night first (${deep})`);
  for (const t of [18200, 19000, 20000, 20800]) assert.equal(darknessAt(t), 3, `pitch black at ${t}`);
  assert.ok(darknessAt(22200) < 2.05 && darknessAt(22200) > 1.95, "back to a normal night");
  assert.equal(darknessAt(23950), 0, "light before dawn");
  assert.equal(darknessAt(0), 0);
  assert.equal(darknessAt(24000 + 19000), 3, "ticks wrap at a day");
  assert.equal(darknessAt(-24000 + 19000), 3, "and before zero");
});

test("the dark rises smoothly: never a jump of more than a little between ticks", () => {
  let prev = darknessAt(11900);
  for (let t = 11901; t < 24100; t++) {
    const d = darknessAt(t);
    assert.ok(Math.abs(d - prev) < 0.01, `jump of ${Math.abs(d - prev)} at tick ${t}`);
    prev = d;
  }
});

test("the midnight window is wide enough to feel: pitch black lasts well over two real minutes", () => {
  let ticks = 0;
  for (let t = 0; t < 24000; t++) if (darknessAt(t) >= 2.95) ticks++;
  assert.ok(ticks >= 2400, `only ${ticks} ticks (${ticks / 20}s) of pitch black`);
});

test("moon and cloud: a full moon thins the lesser dark, a new moon and cloud deepen it, pitch black never lifts", () => {
  const plain = darknessAt(15500);
  assert.ok(darknessAt(15500, { moon: 0 }) < plain, "full moon");
  assert.ok(darknessAt(15500, { moon: 4 }) > plain, "new moon");
  assert.ok(darknessAt(15500, { overcast: 1 }) > plain, "cloud");
  assert.equal(darknessAt(19000, { moon: 0 }), 3, "a full moon does not lift pitch black");
  assert.equal(darknessAt(19000, { moon: 4, overcast: 1 }), 3, "and nothing goes past the scale");
  assert.equal(darknessAt(6000, { moon: 4, overcast: 1 }), 0, "day stays day");
});

test("how far you see: no fog by day, then dusk, deep night and pitch black, down to the mode's limit", () => {
  assert.equal(seeingDistance(0), undefined);
  const dusk = seeingDistance(1), deep = seeingDistance(2), black = seeingDistance(3);
  assert.ok(dusk > deep && deep > black, `${dusk} ${deep} ${black}`);
  assert.ok(Math.abs(black - MODES.normal) < 1e-6, "pitch black is the mode's limit");
  assert.ok(seeingDistance(3, "gentle") > seeingDistance(3, "normal") && seeingDistance(3, "normal") > seeingDistance(3, "pitch"));
  assert.ok(seeingDistance(3, "pitch") <= 3.01);
  assert.ok(seeingDistance(0.5) > dusk && seeingDistance(0.5) < 200, "it closes in gradually");
  assert.equal(seeingDistance(3, "nonsense"), black, "an unknown mode is normal");
  assert.equal(NIGHT.seeing.length, 4);
});

test("lights open the dark by the light they give: a lantern more than a torch, a torch far more than a candle", () => {
  const base = seeingDistance(3);
  const held = (level) => visibleDistance(base, [{ level, distance: 0 }]);
  assert.equal(held(0), base, "a dead light adds nothing");
  assert.ok(held(15) > held(14) && held(14) > held(10) && held(10) > held(3), `${held(15)} ${held(14)} ${held(10)} ${held(3)}`);
  assert.ok(held(14) > 9 && held(14) < 12, "a torch lights about ten blocks");
  assert.ok(held(3) > base && held(3) < 4, "a single candle is a small circle, but a real one");
  assert.ok(held(12) > 8 && held(12) < held(14), "four candles are nearly a torch");
  assert.equal(held(15), lightRadius(15));
});

test("a lamp lights a room around it: standing in its glow helps, well outside it does not", () => {
  const base = seeingDistance(3);
  const lamp = (distance) => visibleDistance(base, [{ level: 15, distance }]);
  assert.equal(lamp(4), lightRadius(15), "close to it, you see its whole pool");
  assert.ok(lamp(11) > base && lamp(11) < lamp(4), "at its edge it has faded");
  assert.equal(lamp(25), base, "far from it, nothing");
  let prev = Infinity;
  for (let d = 0; d <= 30; d += 0.5) {
    assert.ok(lamp(d) <= prev + 1e-9, `the glow must only fade with distance (${d})`);
    prev = lamp(d);
  }
});

test("two lights help more than one, but never as much as double", () => {
  const base = seeingDistance(3);
  const one = visibleDistance(base, [{ level: 14, distance: 0 }]);
  const two = visibleDistance(base, [{ level: 14, distance: 0 }, { level: 14, distance: 1 }]);
  assert.ok(two > one && two < one * 2 - base);
  assert.equal(visibleDistance(base, []), base);
});

test("the eyes hold the glow: stepping out of light closes slowly, lighting a torch opens quickly", () => {
  assert.equal(easeDistance(undefined, 20, 0.5), 20);
  assert.equal(easeDistance(20, undefined, 0.5), undefined, "day: no fog");
  const closing = easeDistance(12, 5, 0.5), opening = easeDistance(5, 12, 0.5);
  assert.ok(closing > 5 && closing < 12, "it does not snap shut");
  assert.ok(12 - closing < opening - 5, "it opens faster than it closes");
  let v = 12;
  for (let i = 0; i < 40; i++) v = easeDistance(v, 5, 0.5);
  assert.ok(Math.abs(v - 5) < 1e-6, "and it gets there");
});

test("night sounds: silent by day, never the same twice, spaced out more as the dark deepens, deterministic", () => {
  const seq = (values) => { let i = 0; return () => values[i++ % values.length]; };
  assert.equal(nextCue(0, seq([0.5])), undefined);
  for (let d = 0.3; d <= 3; d += 0.1) {
    const cue = nextCue(d, seq([0.1, 0.5, 0.9, 0.3, 0.7]));
    if (!cue) continue;
    assert.ok(d >= cue.from && d <= cue.to, `${cue.name} is out of place at darkness ${d}`);
    assert.ok(cue.gap > 0 && cue.distance >= cue.near && cue.distance <= cue.far);
  }
  assert.notEqual(nextCue(2.5, seq([0.2]), "owl")?.name, "owl");
  assert.deepEqual(nextCue(2, seq([0.4, 0.6, 0.2, 0.8])), nextCue(2, seq([0.4, 0.6, 0.2, 0.8])));
  assert.ok(cueGap(1) < cueGap(2) && cueGap(2) < cueGap(3), "a long hush in pitch black");
  const names = new Set(CUES.map((c) => c.name));
  assert.equal(names.size, CUES.length);
  assert.ok(CUES.some((c) => c.to === 3 && c.from >= 2.4), "pitch black has its own sounds");
});

test("sounds: every cue has a sound id that is defined, and every defined file exists", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const { SOUNDS } = await import("../BP/scripts/night.js").catch(() => ({ SOUNDS: null }));
  const defs = JSON.parse(readFileSync(new URL("../RP/sounds/sound_definitions.json", import.meta.url), "utf8")).sound_definitions;
  const src = readFileSync(new URL("../BP/scripts/night.js", import.meta.url), "utf8");
  const ids = [...src.matchAll(/id: "(dn\.[a-z]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, CUES.length, "one sound per cue");
  for (const id of ids) assert.ok(defs[id], `${id} is defined`);
  for (const d of Object.values(defs)) for (const f of d.sounds) assert.ok(existsSync(new URL(`../RP/${f.name}.ogg`, import.meta.url)), f.name);
  void SOUNDS;
});
