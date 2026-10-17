// Kit: where a creature can stand. Game-agnostic.
// The y a creature that needs `room` open blocks above it can stand at near (x, z): the first solid block, not a leaf or
// ground cover, within a few blocks of `y`, with room above it. Undefined when there is nowhere (a wall, a drop).
const LEAF = /_leaves$/;
const COVER = /(^minecraft:(short_|tall_)?grass$|fern|bush|flower|vine|snow_layer|sapling|mushroom|dead_bush)/;

export function standAt(dimension, x, z, y, room = 2) {
  try {
    for (let yy = Math.floor(y) + 2; yy >= Math.floor(y) - 3; yy--) {
      const at = (dy) => dimension.getBlock({ x: Math.floor(x), y: yy + dy, z: Math.floor(z) });
      const ground = at(0);
      if (!ground || ground.isAir || ground.isLiquid || LEAF.test(ground.typeId) || COVER.test(ground.typeId)) continue;
      let clear = true;
      for (let k = 1; k <= room; k++) {
        const b = at(k);
        if (!b || !(b.isAir || COVER.test(b.typeId))) clear = false;
      }
      if (clear) return yy + 1;
    }
  } catch {
    // an unloaded chunk
  }
  return undefined;
}

// Can a player at `eye` see `to`? Walk the line a block and a half at a time: anything solid in the way (terrain, or a
// tree's leaves before the last `ignoreLast` steps) hides it.
export function lineClear(dimension, eye, to, ignoreLast = 3) {
  const dx = to.x - eye.x, dy = to.y - eye.y, dz = to.z - eye.z;
  const steps = Math.ceil(Math.hypot(dx, dy, dz) / 1.5);
  try {
    for (let i = 1; i < steps - ignoreLast; i++) {
      const t = i / steps;
      const b = dimension.getBlock({ x: Math.floor(eye.x + dx * t), y: Math.floor(eye.y + dy * t), z: Math.floor(eye.z + dz * t) });
      if (b && !b.isAir && !b.isLiquid && !COVER.test(b.typeId)) return false;
    }
  } catch {
    return false; // part of the line is not loaded: it cannot be seen
  }
  return true;
}

// A column of the world for placing something: { ground, water, covered, clear } at (x, z), or null when it is not
// loaded. `ground` is the y a creature stands at; `covered` means a tree's crown is overhead; `clear` (when `eye` is given)
// is whether a player at `eye` can see a figure standing there.
export function columnSampler(dimension, eye) {
  const tree = /(_leaves|_log|_wood)$/;
  return (x, z) => {
    try {
      const block = dimension.getTopmostBlock({ x: Math.floor(x), z: Math.floor(z) });
      if (!block) return null;
      let y = block.location.y;
      for (let i = 0; i < 24; i++) {
        const b = dimension.getBlock({ x: Math.floor(x), y, z: Math.floor(z) });
        if (!b || !(b.isAir || tree.test(b.typeId) || COVER.test(b.typeId))) break;
        y--;
      }
      const water = block.typeId === "minecraft:water" || dimension.getBlock({ x: Math.floor(x), y, z: Math.floor(z) })?.typeId === "minecraft:water";
      return { ground: y + 1, water, covered: tree.test(block.typeId), clear: eye ? lineClear(dimension, eye, { x, y: y + 3.3, z }) : undefined };
    } catch {
      return null;
    }
  };
}
