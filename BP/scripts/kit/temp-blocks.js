// Kit: blocks that appear for a moment and then go back - ice shackles, a ring of powder snow, a trail of fire.
// Game-agnostic. Only ever fills AIR (never replaces a block of the build), only where there is solid ground under
// the cell (unless `floating` is set), and puts back air when the time is up, if the block is still the one it put
// there. Pending restores are saved in a world property, so a reload in the middle never leaves them behind:
// call startTempBlocks() once at startup and it clears anything a crash or restart left.
import { system, world } from "@minecraft/server";
import { dueRestores } from "./cells.js";

const PROPERTY = "kit:temp_blocks";
let pending = [];

function save() {
  try {
    world.setDynamicProperty(PROPERTY, JSON.stringify(pending.slice(-400)));
  } catch {
    // too big or unavailable: the in-memory list still restores them this session
  }
}

function restore(r) {
  try {
    const block = world.getDimension(r.dim).getBlock(r.pos);
    if (!block) return false; // unloaded: keep it for later
    if (block.typeId === r.block) block.setType("minecraft:air");
    return true;
  } catch {
    return false;
  }
}

// Place `blockId` into each cell that is air for `ticks`. Returns how many it placed.
export function placeTemporary(dimension, cells, blockId, ticks, { floating = false } = {}) {
  let placed = 0;
  const at = system.currentTick + ticks;
  for (const pos of cells) {
    try {
      const block = dimension.getBlock(pos);
      if (!block || block.typeId !== "minecraft:air") continue;
      if (!floating) {
        const below = dimension.getBlock({ x: pos.x, y: pos.y - 1, z: pos.z });
        if (!below || below.isAir || below.isLiquid) continue;
      }
      block.setType(blockId);
      pending.push({ dim: dimension.id, pos, block: blockId, at });
      placed++;
    } catch {
      // unloaded or not allowed
    }
  }
  if (placed) save();
  return placed;
}

export function startTempBlocks() {
  // Anything left from before a restart is due now.
  try {
    const raw = world.getDynamicProperty(PROPERTY);
    if (typeof raw === "string") pending = JSON.parse(raw).map((r) => ({ ...r, at: 0 }));
  } catch {
    pending = [];
  }
  system.runInterval(() => {
    if (!pending.length) return;
    const { due, waiting } = dueRestores(pending, system.currentTick);
    if (!due.length) return;
    const keep = due.filter((r) => !restore(r));
    pending = [...waiting, ...keep];
    save();
  }, 10);
}
