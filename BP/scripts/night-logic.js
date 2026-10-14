// Deep Night: the rules for how dark the night is and how far a player can see in it. Pure: no Minecraft imports, so
// every number here is tested (tests/night.test.js). night.js feeds it the world and applies the answer as fog.
//
// Darkness is a float on the kit's 0 to 3 scale: 0 is day, 1 is dusk, 2 is a deep night you can still walk in, and
// 3 is pitch black. It follows the clock: a normal night first, then the dark deepens toward midnight, holds until the
// small hours, and eases off before dawn.
import { approach, byLevel, clamp, smoothstep } from "./kit/intensity.js";

// Minecraft's clock: tick 0 is 6am, 6000 noon, 12000 6pm, 18000 midnight, 24000 6am again.
// Keyframes of { tick, level }, joined with smoothstep. This is the default night; a game can pass its own.
export const NIGHT = {
  keys: [
    { tick: 12000, level: 0 }, // dusk begins
    { tick: 13500, level: 1 },
    { tick: 15500, level: 1.9 }, // a deep night, still readable
    { tick: 17500, level: 2.6 },
    { tick: 18200, level: 3 }, // just past midnight
    { tick: 20800, level: 3 }, // pitch black until about 2:50am
    { tick: 22200, level: 2 },
    { tick: 23200, level: 0.9 },
    { tick: 23900, level: 0 }, // grey before dawn
  ],
  // How far a player sees at each whole level, in blocks; the last entry is replaced by the mode's pitch-black limit.
  seeing: [200, 56, 24, 2.5],
};

// The least a player can see in pitch black, by mode. "normal" is dark enough to be scary; "gentle" is for little
// ones; "pitch" is a hand held in front of your face.
export const MODES = { gentle: 12, normal: 2.5, pitch: 1.5 };

// How dark it is at `tick` (any tick count; it wraps at 24000). `moon` is the moon phase 0 (full) to 4 (new), if
// known; `overcast` is 0 to 1 (rain or storm cloud). A full moon lets a little light through but never lifts pitch
// black; a new moon and thick cloud darken the lesser levels.
export function darknessAt(tick, { moon, overcast = 0, night = NIGHT } = {}) {
  const t = ((tick % 24000) + 24000) % 24000;
  const keys = night.keys;
  let level = 0;
  if (t >= keys[0].tick && t < keys.at(-1).tick) {
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.tick && t < b.tick) {
        level = a.level + (b.level - a.level) * smoothstep(a.tick, b.tick, t);
        break;
      }
    }
  }
  if (level <= 0) return 0;
  // Moon and cloud only matter while there is a night to adjust, and never touch the deepest dark.
  const mid = 1 - clamp(Math.abs(level - 1.5) / 1.5, 0, 1); // strongest in the middle of the scale
  let adjust = clamp(overcast, 0, 1) * 0.35;
  if (moon !== undefined) adjust += (moon === 0 ? -0.35 : moon === 4 ? 0.15 : (2 - Math.abs(moon - 2)) * 0.02 - 0.02);
  return clamp(level + adjust * mid, 0, 3);
}

// The distance in blocks a player sees with no light of their own, or undefined when it is day (no fog wanted).
// Interpolated in log space, so each step in darkness feels like the same step.
export function seeingDistance(darkness, mode = "normal", night = NIGHT) {
  if (darkness < 0.02) return undefined;
  const table = night.seeing.slice(0, -1).concat(MODES[mode] ?? MODES.normal);
  const logs = table.map(Math.log);
  return Math.exp(byLevel(logs, darkness));
}

// How far a light lets the player see. A light of block-light `level` (0..15) lights a disc of radius one block plus
// two thirds of a block per level: a candle about 3, a torch about 10, a lantern about 11. Being inside the disc lets
// you see to its edge, and the effect fades to nothing once you are well outside.
export const lightRadius = (level) => (level <= 0 ? 0 : 1 + level * 0.65);

// The distance a player sees given the dark around them (`base`, from seeingDistance) and the lights near them:
// [{ level, distance }], where `distance` is how far the light is from the player (0 for one held in hand). The
// brightest light sets the range; a second one adds a quarter of its own. Returns at least `base`.
export function visibleDistance(base, lights) {
  const reach = [];
  for (const { level, distance } of lights) {
    const r = lightRadius(level);
    if (r <= 0) continue;
    let seen = 0;
    if (distance <= r * 0.5) seen = r;
    else if (distance < r * 1.5) seen = r + (base - r) * ((distance - r * 0.5) / r);
    reach.push(Math.max(base, seen));
  }
  if (!reach.length) return base;
  reach.sort((a, b) => b - a);
  return reach[0] + (reach[1] ? (reach[1] - base) * 0.25 : 0);
}

// Ease the seen distance toward its target in log space. Stepping out of the light closes slowly (the eyes hold the
// glow for a moment); lighting a torch opens almost at once. `dt` in seconds.
export function easeDistance(current, target, dt, { open = 3, close = 0.8 } = {}) {
  if (current === undefined) return target;
  if (target === undefined) return undefined;
  const next = approach(Math.log(current), Math.log(target), dt, { up: open, down: close });
  return Math.exp(next);
}

// Sounds of the night. Cue names, not sound ids: night.js maps them to whatever sounds the pack ships.
// `weight` is relative chance at that darkness band; `far` and `near` are the distances in blocks it can come from.
export const CUES = [
  { name: "crickets", from: 0.3, to: 2.2, weight: 4, near: 12, far: 30, volume: 0.5 },
  { name: "owl", from: 0.8, to: 2.6, weight: 3, near: 14, far: 40, volume: 0.8 },
  { name: "wind_in_branches", from: 1.2, to: 3, weight: 3, near: 8, far: 24, volume: 0.6 },
  { name: "distant_howl", from: 2, to: 3, weight: 1.5, near: 40, far: 70, volume: 0.7 },
  { name: "twig_snap", from: 2.4, to: 3, weight: 1, near: 5, far: 11, volume: 0.9 },
  { name: "heartbeat", from: 2.8, to: 3, weight: 1.2, near: 0, far: 0, volume: 0.6 },
];

// Seconds between cues: frequent at dusk, sparser in the deep night, and a long hush in pitch black where the rare
// sound lands harder.
export const cueGap = (darkness) => byLevel([0, 8, 16, 38], darkness);

// What to play next, or undefined for silence. `rand` is a function returning [0, 1): pass Math.random in the game
// and a fixed sequence in tests. `last` is the name of the previous cue, which is not repeated.
export function nextCue(darkness, rand, last) {
  const live = CUES.filter((c) => darkness >= c.from && darkness <= c.to && c.name !== last);
  if (!live.length) return undefined;
  const total = live.reduce((s, c) => s + c.weight, 0);
  let pick = rand() * total;
  const cue = live.find((c) => (pick -= c.weight) < 0) ?? live.at(-1);
  const gap = cueGap(darkness) * (0.6 + rand() * 0.8);
  return { ...cue, distance: cue.near + rand() * (cue.far - cue.near), angle: rand() * Math.PI * 2, pitch: 0.85 + rand() * 0.3, gap };
}
