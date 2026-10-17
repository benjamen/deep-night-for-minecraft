// Kit: a light that goes with the player. A held torch, lantern or candle lights the dark round them, by an invisible
// light block kept at their head and moved as they move, so signs and walls near them can be read. Game-agnostic: the game
// says which items count. The light block is only ever put into air, only ever taken out if it is still ours, and every
// one placed is remembered in a world property, so a crash or a restart cannot leave glowing air behind.
import { BlockPermutation, system, world } from "@minecraft/server";

const KEY = "kit:held_lights";

// The ways the game has named its light blocks, in the order to try them: one block with a level state, or one block id
// per level. Pure, so a game's tests can check them.
export function lightBlockForms(level) {
  const l = Math.min(15, Math.max(1, Math.round(level)));
  return [
    { id: "minecraft:light_block", states: { block_light_level: l } },
    { id: `minecraft:light_block_${l}`, states: {} },
  ];
}

// Where the light goes for a player at `location` (a block at head height), as { x, y, z }.
export const lightSpot = (location, height = 1.4) => ({ x: Math.floor(location.x), y: Math.floor(location.y + height), z: Math.floor(location.z) });

const same = (a, b) => a && b && a.x === b.x && a.y === b.y && a.z === b.z;
const readAll = () => {
  try {
    return JSON.parse(world.getDynamicProperty(KEY) ?? "{}");
  } catch {
    return {};
  }
};
const writeAll = (m) => world.setDynamicProperty(KEY, JSON.stringify(m));

let permutation;
function lightPermutation(level) {
  if (permutation?.level === level) return permutation.value;
  for (const f of lightBlockForms(level)) {
    try {
      permutation = { level, value: BlockPermutation.resolve(f.id, f.states) };
      return permutation.value;
    } catch {
      // not this build's name for it
    }
  }
  permutation = { level, value: undefined };
  return undefined;
}

const isLight = (block) => block?.typeId === "minecraft:light_block" || /^minecraft:light_block_\d+$/.test(block?.typeId ?? "");

function take(placed) {
  try {
    const b = world.getDimension(placed.dim).getBlock(placed);
    if (b && isLight(b)) b.setType("minecraft:air");
  } catch {
    // unloaded: it is cleaned up at the next start
  }
}

// `counts(typeId)`: does holding this item give light. `level`: how bright (1 to 15). `held(player)`: the type id of the
// item in the player's hand, if the game has its own way to read it (defaults to the selected hotbar slot).
export function startHeldLight({ counts, level = 12, held, log = () => {} }) {
  // Clean up whatever a last run left (world properties cannot be touched while the scripts are first loading).
  system.run(() => {
    for (const placed of Object.values(readAll())) take(placed);
    writeAll({});
  });
  const heldOf = held ?? ((p) => p.getComponent("minecraft:inventory")?.container?.getItem(p.selectedSlotIndex)?.typeId);
  const mine = new Map(); // player id -> { x, y, z, dim }
  const release = (id) => {
    const p = mine.get(id);
    if (!p) return;
    take(p);
    mine.delete(id);
    const all = readAll();
    delete all[id];
    writeAll(all);
  };
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      let want;
      try {
        want = counts(heldOf(player) ?? "") ? lightSpot(player.location) : undefined;
      } catch {
        want = undefined;
      }
      const now = mine.get(player.id);
      if (!want) {
        release(player.id);
        continue;
      }
      if (same(now, want) && player.dimension.id === now.dim) continue;
      try {
        const block = player.dimension.getBlock(want);
        const perm = lightPermutation(level);
        if (!block || !perm || !(block.isAir || isLight(block))) continue; // never into anything solid
        const old = now;
        block.setPermutation(perm);
        mine.set(player.id, { ...want, dim: player.dimension.id });
        const all = readAll();
        all[player.id] = mine.get(player.id);
        writeAll(all);
        if (old && !same(old, want)) take(old);
      } catch (e) {
        log(`held light failed: ${e}`);
      }
    }
  }, 4);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => release(playerId));
}
