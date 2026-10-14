// Kit: block-cell shapes for effects that change the world for a moment (an ice ring, a fire trail, shackles of
// ice). Pure (no Minecraft imports), game-agnostic. Cells are integer { x, y, z } positions.

const key = (c) => `${c.x},${c.y},${c.z}`;
const uniq = (cells) => [...new Map(cells.map((c) => [key(c), c])).values()];

// The cells of a flat ring around `center` (feet height), from radius rMin out to rMax.
export function ringCells(center, rMin, rMax) {
  const cx = Math.floor(center.x), cy = Math.floor(center.y), cz = Math.floor(center.z);
  const out = [];
  for (let dz = -Math.ceil(rMax); dz <= Math.ceil(rMax); dz++) for (let dx = -Math.ceil(rMax); dx <= Math.ceil(rMax); dx++) {
    const d = Math.hypot(dx, dz);
    if (d >= rMin && d <= rMax) out.push({ x: cx + dx, y: cy, z: cz + dz });
  }
  return out;
}

// The four cells beside a creature's feet: north, south, east, west. Filled, they hold it in place.
export function shackleCells(feet) {
  const x = Math.floor(feet.x), y = Math.floor(feet.y), z = Math.floor(feet.z);
  return [{ x: x + 1, y, z }, { x: x - 1, y, z }, { x, y, z: z + 1 }, { x, y, z: z - 1 }];
}

// The cells along a straight line on the ground from `a` to `b`, one per block stepped, `every` blocks apart.
export function trailCells(a, b, every = 1) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
  const out = [];
  for (let i = 0; i <= n; i += every) {
    const t = i / n;
    out.push({ x: Math.floor(a.x + (b.x - a.x) * t), y: Math.floor(a.y + (b.y - a.y) * t), z: Math.floor(a.z + (b.z - a.z) * t) });
  }
  return uniq(out);
}

// A scatter of `count` cells within `radius` of `center`, from a seeded `rand` (so tests can pin it).
export function scatterCells(center, radius, count, rand = Math.random) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
    out.push({ x: Math.floor(center.x + Math.cos(a) * r), y: Math.floor(center.y), z: Math.floor(center.z + Math.sin(a) * r) });
  }
  return uniq(out);
}

// Of a list of restores (each { at: tick, ... }), the ones due by `now`, and the ones still waiting.
export function dueRestores(list, now) {
  return { due: list.filter((r) => r.at <= now), waiting: list.filter((r) => r.at > now) };
}
