// Kit: camera maths and command builders for scripted scenes. Pure (no Minecraft imports), game-agnostic.
// Positions are world coordinates { x, y, z }; times are seconds unless a name says ticks.

// The rotation that looks from `from` toward `to`, in Minecraft's convention: yaw 0 faces south (+z), 90 west,
// -90 east, 180 north; pitch is negative looking up. Rounded to a tenth of a degree for stable commands.
export function lookRotation(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const pitch = (-Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
  const r = (v) => Math.round(v * 10) / 10 || 0;
  return { pitch: r(pitch), yaw: r(yaw) };
}

// A camera shot at tick `at`: sit at `pos` and look at `target`, easing over `ease` seconds.
export const shotAt = (at, pos, target, ease = 0) => ({ at, camera: { pos, rot: lookRotation(pos, target), ease } });

const n = (v) => (Math.round(v * 100) / 100).toString();

// The camera command for one shot, run as the player (`camera @s ...`).
export function cameraCommand({ pos, rot, ease }) {
  const easing = ease > 0 ? `ease ${n(ease)} in_out_sine ` : "";
  return `camera @s set minecraft:free ${easing}pos ${n(pos.x)} ${n(pos.y)} ${n(pos.z)} rot ${n(rot.pitch)} ${n(rot.yaw)}`;
}

// The fade command: in, hold and out in seconds, to black unless a colour [r, g, b] (0..255) is given.
export function fadeCommand({ in: fadeIn, hold, out, color = [0, 0, 0] }) {
  return `camera @s fade time ${fadeIn} ${hold} ${out} color ${color.join(" ")}`;
}

// The checks every scene should pass: shots in range, moves finished before the end. Returns a list of problems,
// empty when the scene is sound (used by game tests).
export function sceneProblems(scene) {
  const problems = [];
  for (const s of scene.shots) {
    if (s.at < 0 || s.at >= scene.end) problems.push(`shot at tick ${s.at} is outside 0..${scene.end}`);
    if (s.camera && s.at + s.camera.ease * 20 > scene.end) problems.push(`the move at tick ${s.at} is still easing when the scene ends`);
  }
  return problems;
}

// Paths for actors, as positions over normalised time t in 0..1.
// A circle round `center` of `radius`, starting at angle `phase` (radians) and going round `turns` times.
export function circlePath(center, radius, t, { phase = 0, turns = 1, y = center.y } = {}) {
  const a = phase + t * turns * Math.PI * 2;
  return { x: center.x + Math.cos(a) * radius, y, z: center.z + Math.sin(a) * radius };
}

// A straight run from `a` to `b` that rises out of and sinks back below a surface: `depth` blocks under at the ends,
// `rise` blocks under at the middle (a back breaking the water and going down again).
export function surfacingPath(a, b, t, { depth = 8, rise = 1 } = {}) {
  const lift = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
  return { x: a.x + (b.x - a.x) * t, y: a.y - depth + (depth - rise) * lift, z: a.z + (b.z - a.z) * t };
}
