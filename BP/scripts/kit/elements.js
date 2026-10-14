// Kit: elemental effects - burning, freezing, chilling - built from vanilla effects, particles and temporary blocks.
// Game-agnostic; each is safe on an unloaded or vanished target.
import { shackleCells, ringCells, trailCells } from "./cells.js";
import { effect, particle, sound } from "./effects.js";
import { placeTemporary } from "./temp-blocks.js";

// Set an entity alight for `seconds`.
export function burn(entity, seconds) {
  try {
    entity.setOnFire(seconds, true);
    return true;
  } catch {
    return false;
  }
}

// Frozen: very slow, weak arms, frost on the screen (a pale blue flash for players), snowflakes, and - with
// `shackles` - ice round the feet for the same time, so they cannot step out of it until it cracks.
export function freeze(entity, ticks, { amplifier = 3, shackles = false, block = "minecraft:packed_ice" } = {}) {
  effect(entity, "slowness", ticks, amplifier);
  effect(entity, "mining_fatigue", ticks, 1);
  const at = entity.location;
  particle(entity.dimension, "minecraft:snowflake_particle", { x: at.x, y: at.y + 1, z: at.z });
  sound(entity.dimension, "random.glass", at, 0.8, 1.6);
  if (entity.typeId === "minecraft:player") {
    try {
      entity.runCommand("camera @s fade time 0.05 0.2 0.6 color 170 220 255");
    } catch {
      // no camera control here
    }
  }
  if (shackles) placeTemporary(entity.dimension, shackleCells(at), block, ticks);
}

// Chilled: slowed a little, with a breath of frost. A lighter freeze for glancing hits.
export function chill(entity, ticks) {
  effect(entity, "slowness", ticks, 1);
  particle(entity.dimension, "minecraft:snowflake_particle", { x: entity.location.x, y: entity.location.y + 1.4, z: entity.location.z });
}

// A ring of `block` (powder snow sinks and freezes whoever wades into it) round `center` for `ticks`.
export function frostRing(dimension, center, rMin, rMax, ticks, block = "minecraft:powder_snow") {
  return placeTemporary(dimension, ringCells(center, rMin, rMax), block, ticks);
}

// A line of fire on the ground from `a` to `b` for `ticks`. Fire is only put into air with solid ground under it;
// the game should run with fire spread off (gamerule dofiretick false) so a trail never takes a building with it.
export function fireTrail(dimension, a, b, ticks, every = 2) {
  return placeTemporary(dimension, trailCells(a, b, every), "minecraft:fire", ticks);
}
