// Kit: shared fog. Several packs want to dim the player's view at once (night, rain, ash, a game's own mist) and the
// game's fog command lets only the last one win, with distances fixed in pack files. So packs do not push fog
// themselves: they ask for what they want (a distance in blocks and a tint), this module mixes the asks like layers
// of thin air - the visible distance is 1 / (sum of 1 / each distance), so a thin haze and a dark night together are
// a little darker than the night alone - and snaps the answer to a ladder of pre-built fog definitions
// (scripts/gen-fogs.mjs writes them into the resource pack). Pure and game-agnostic; fog-mixer.js applies it.

export const FOG_NAMESPACE = "kit";

// Tints are named so asks stay readable; a pack can pass its own { name: "#rrggbb" } map.
export const DEFAULT_TINTS = Object.freeze({
  black: "#000000", night: "#05070f", dim: "#2b333b", slate: "#59636d", haze: "#7b858e", grey: "#9aa3a8", mist: "#c9d2d6",
  ash: "#4a4642", dust: "#b59a6b", snow: "#e8eef2", // (a grey ramp between night and mist: mixed layers snap to a grey, never to brown ash)
});

export const DEFAULT_LADDER = Object.freeze({ steps: 12, min: 3, max: 96, tints: DEFAULT_TINTS, startRatio: 0.15 });

// The visible distances of a ladder: `steps` values from `min` to `max` blocks, evenly spaced in ratio (a fog
// nearly closed in needs finer steps than one far off).
export function ladderDistances({ steps, min, max }) {
  if (steps < 2) return [min];
  const ratio = Math.pow(max / min, 1 / (steps - 1));
  return Array.from({ length: steps }, (_, i) => Math.round(min * Math.pow(ratio, i) * 10) / 10);
}

export const fogId = (tint, step, namespace = FOG_NAMESPACE) => `${namespace}:fog_${tint}_${step}`;

// Every definition a ladder needs, as { id, file, json }: write these into RP/fogs/.
export function fogDefinitions(ladder = DEFAULT_LADDER, namespace = FOG_NAMESPACE) {
  const distances = ladderDistances(ladder);
  const out = [];
  for (const [tint, hex] of Object.entries(ladder.tints)) {
    distances.forEach((end, step) => {
      const id = fogId(tint, step, namespace);
      const water = Math.max(4, Math.round(end * 0.5));
      out.push({
        id,
        file: `fog_${tint}_${step}.json`,
        json: {
          format_version: "1.16.100",
          "minecraft:fog_settings": {
            description: { identifier: id },
            distance: {
              air: { fog_start: Math.round(end * ladder.startRatio * 10) / 10, fog_end: end, fog_color: hex, render_distance_type: "fixed" },
              water: { fog_start: 0, fog_end: water, fog_color: hex, render_distance_type: "fixed" },
            },
          },
        },
      });
    });
  }
  return out;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Mix asks ({ distance, tint }) where `tint` is a name from `tints` or a "#rrggbb" string. Returns
// { distance, color: [r,g,b] }, or null when nobody is asking for any fog.
// An ask with `exclusive: true` (a cut scene that needs a clear view) is mixed alone: the others are ignored while it lasts.
export function mixFog(asks, tints = DEFAULT_TINTS) {
  const all = asks.filter((a) => a && a.distance > 0);
  const live = all.some((a) => a.exclusive) ? all.filter((a) => a.exclusive) : all;
  if (!live.length) return null;
  let density = 0;
  const sum = [0, 0, 0];
  for (const a of live) {
    const w = 1 / a.distance;
    density += w;
    const c = rgb(tints[a.tint] ?? a.tint);
    for (let i = 0; i < 3; i++) sum[i] += c[i] * w;
  }
  return { distance: 1 / density, color: sum.map((v) => v / density) };
}

// Snap a mix to the nearest rung: { id, tint, step }. `previous` (the rung applied last time) is kept unless the mix
// has moved clearly off it, so a fog drifting between two rungs does not flicker back and forth.
export function snapFog(mix, ladder = DEFAULT_LADDER, previous, namespace = FOG_NAMESPACE) {
  if (!mix) return null;
  const distances = ladderDistances(ladder);
  const logD = Math.log(mix.distance);
  let step = 0, best = Infinity;
  distances.forEach((d, i) => {
    const gap = Math.abs(Math.log(d) - logD);
    if (gap < best) { best = gap; step = i; }
  });
  let tint = "", tintBest = Infinity;
  for (const [name, hex] of Object.entries(ladder.tints)) {
    const c = rgb(hex);
    const gap = Math.hypot(c[0] - mix.color[0], c[1] - mix.color[1], c[2] - mix.color[2]);
    if (gap < tintBest) { tintBest = gap; tint = name; }
  }
  if (previous && previous.tint in ladder.tints) {
    const prevGap = Math.abs(Math.log(distances[previous.step]) - logD);
    const rung = distances.length > 1 ? Math.log(distances[1] / distances[0]) : 1;
    if (prevGap <= rung * 0.75) step = previous.step; // hysteresis
    const pc = rgb(ladder.tints[previous.tint]);
    if (Math.hypot(pc[0] - mix.color[0], pc[1] - mix.color[1], pc[2] - mix.color[2]) <= tintBest + 12) tint = previous.tint;
  }
  return { id: fogId(tint, step, namespace), tint, step };
}

// Which of several running copies of the kit applies the fog: the one with the lowest pack id. Everyone computes the
// same answer from the same list, so exactly one copy acts.
export function electOwner(ids) {
  const list = [...new Set(ids)].sort();
  return list.length ? list[0] : undefined;
}

// A request with a time to live, so a pack that stops asking (or crashes) stops dimming the world.
export function liveAsks(requests, now) {
  return requests.filter((r) => r.until > now);
}
