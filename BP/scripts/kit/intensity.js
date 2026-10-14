// Kit: intensity channels, the 0 to 3 scale every effect pack shares (weather, disasters, darkness). Pure and
// game-agnostic. A channel's value is a float from 0 to 3 that eases toward a target; its level is the whole number
// the rules and the player see, with a little hysteresis so it does not flicker at a boundary.

export const MAX_LEVEL = 3;
export const LEVEL_NAMES = ["none", "light", "medium", "heavy"];

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Move `value` toward `target` by at most `rate` units per second over `dt` seconds. `rate` is { up, down } (or one
// number for both). Never overshoots, and clamps to the 0..3 scale.
export function approach(value, target, dt, rate = 0.1) {
  const { up, down } = typeof rate === "number" ? { up: rate, down: rate } : rate;
  const goal = clamp(target, 0, MAX_LEVEL);
  const step = (goal > value ? up : down) * dt;
  if (Math.abs(goal - value) <= step) return goal;
  return value + Math.sign(goal - value) * step;
}

// The whole level for `value`. `previous` is the level shown a moment ago: it only changes once the value is
// `margin` past the halfway point to the next level, so a value hovering at 1.5 does not flip every tick.
export function levelOf(value, previous, margin = 0.15) {
  const v = clamp(value, 0, MAX_LEVEL);
  if (previous === undefined) return Math.round(v);
  if (v > previous + 0.5 + margin) return Math.min(MAX_LEVEL, Math.round(v - margin));
  if (v < previous - 0.5 - margin) return Math.max(0, Math.round(v + margin));
  return previous;
}

// Pick a number by level from a table: `byLevel([0, 2, 5, 9], 2)` is 5. A float level interpolates between entries.
export function byLevel(table, level) {
  const v = clamp(level, 0, table.length - 1);
  const i = Math.floor(v);
  return i >= table.length - 1 ? table[table.length - 1] : lerp(table[i], table[i + 1], v - i);
}

// An event with an omen, a main stretch and an aftermath (a disaster, a front rolling in). Times in seconds.
// Returns the phase at `t` seconds from the start, how far through that phase it is (0..1), and whether it is over.
export function phaseAt(t, { omen = 0, event = 0, aftermath = 0 }) {
  if (t < 0) return { phase: "pending", progress: 0, over: false };
  if (t < omen) return { phase: "omen", progress: omen ? t / omen : 1, over: false };
  if (t < omen + event) return { phase: "event", progress: event ? (t - omen) / event : 1, over: false };
  if (t < omen + event + aftermath) return { phase: "aftermath", progress: aftermath ? (t - omen - event) / aftermath : 1, over: false };
  return { phase: "done", progress: 1, over: true };
}
