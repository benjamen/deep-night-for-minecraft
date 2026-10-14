// Kit: finds where water creatures belong, from a height map. Pure (no Minecraft imports), game-agnostic.
// A map is { size, half, height: Int16Array, isWater(i) } over columns x, z in -half..half-1 (index (z+half)*size +
// (x+half)), with the sea surface at `surface` (the top water block's y). Depth is how many water blocks stand over the
// bed; shoreDistance is how many columns (8-way steps) a water column is from the nearest dry one.

// Distance from every water column to the nearest land column, by a breadth-first sweep from the land.
export function shoreDistances(map) {
  const { size } = map;
  const n = size * size;
  const dist = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = 0; i < n; i++) if (!map.isWater(i)) { dist[i] = 0; queue[tail++] = i; }
  while (head < tail) {
    const i = queue[head++];
    const x = i % size, z = (i - x) / size;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const X = x + dx, Z = z + dz;
      if ((dx === 0 && dz === 0) || X < 0 || Z < 0 || X >= size || Z >= size) continue;
      const j = Z * size + X;
      if (dist[j] !== -1) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  return dist;
}

// Sort the water into named zones. `zones` maps a name to { depth: [min, max], shore: [min, max], max: count } and
// the result maps each name to an evenly spread list of [x, z] columns that fit, at most `max` of them. Columns are
// taken in a fixed stride so the same map always gives the same spots.
export function waterZones(map, zones, surface = -1) {
  const dist = shoreDistances(map);
  const { size, half, height } = map;
  const out = {};
  for (const [name, rule] of Object.entries(zones)) {
    const fits = [];
    for (let i = 0; i < size * size; i++) {
      if (!map.isWater(i)) continue;
      const depth = surface - height[i];
      const d = dist[i];
      if (depth < rule.depth[0] || depth > rule.depth[1] || d < rule.shore[0] || d > rule.shore[1]) continue;
      fits.push(i);
    }
    const step = Math.max(1, Math.floor(fits.length / (rule.max ?? 200)));
    out[name] = [];
    for (let k = 0; k < fits.length && out[name].length < (rule.max ?? 200); k += step) {
      const i = fits[k];
      const x = i % size;
      out[name].push([x - half, (i - x) / size - half]);
    }
  }
  return out;
}

// Spots from `list` ([x, z] pairs) between minDist and maxDist of `from` ({ x, z }), nearest first.
export function spotsNear(list, from, minDist, maxDist) {
  return list
    .map(([x, z]) => ({ x, z, d: Math.hypot(x - from.x, z - from.z) }))
    .filter((s) => s.d >= minDist && s.d <= maxDist)
    .sort((a, b) => a.d - b.d);
}

// The spots from `list` ([x, z] pairs) farther than `radius` from every point in `points` ({ x, z }): water kept clear
// around lights, wards or safe havens. Returns `list` itself when there is nothing to keep clear.
export function spotsAwayFrom(list, points, radius) {
  if (!points?.length) return list;
  return list.filter(([x, z]) => points.every((p) => Math.hypot(x - p.x, z - p.z) > radius));
}
