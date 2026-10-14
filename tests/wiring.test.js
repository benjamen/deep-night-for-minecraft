import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CUES } from "../BP/scripts/night-logic.js";

const read = (p) => readFileSync(new URL(`../BP/scripts/${p}`, import.meta.url), "utf8");

test("every sound cue has an entry in the sound table (null means silent until recorded sounds are added)", () => {
  const src = read("night.js");
  for (const cue of CUES) assert.match(src, new RegExp(`\\b${cue.name}:`), `no sound entry for ${cue.name}`);
});

test("the night asks the shared fog mixer rather than pushing fog itself", () => {
  const src = read("night.js");
  assert.match(src, /startFogMixer\(/);
  assert.match(src, /setFog\(LAYER/);
  assert.doesNotMatch(src, /fog @s/, "only the kit's mixer may run the fog command");
  assert.match(read("main.js"), /startNight\(\)/);
});

test("a pack id is unique to this pack, so the mixers of several packs can elect one owner", () => {
  const bp = JSON.parse(readFileSync(new URL("../BP/manifest.json", import.meta.url), "utf8"));
  const src = read("night.js");
  assert.ok(src.includes(`"deep-night-${bp.header.uuid.slice(0, 8)}"`), "PACK_ID should be derived from the manifest uuid");
});

test("the fog ladder the night asks for exists in the resource pack", async () => {
  const { fogDefinitions } = await import("../BP/scripts/kit/fog.js");
  const { existsSync } = await import("node:fs");
  for (const d of fogDefinitions()) assert.ok(existsSync(new URL(`../RP/fogs/${d.file}`, import.meta.url)), `${d.file} is missing: run npm run sync-kit`);
});
