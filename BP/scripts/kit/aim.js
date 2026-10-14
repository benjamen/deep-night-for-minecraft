// Kit: aiming maths. Pure, game-agnostic.

// A velocity from `from` toward `to` with length `speed`, turned `fanDeg` degrees about the vertical (for spreads),
// lifted a little so a lobbed shot lands rather than ploughs into the ground.
export function aimVelocity(from, to, speed, fanDeg = 0) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const flat = Math.hypot(dx, dz) || 1;
  const a = (fanDeg * Math.PI) / 180;
  const ux = (dx / flat) * Math.cos(a) - (dz / flat) * Math.sin(a);
  const uz = (dx / flat) * Math.sin(a) + (dz / flat) * Math.cos(a);
  const lift = dy / flat + Math.min(0.25, flat / 80);
  const len = Math.hypot(1, lift);
  return { x: (ux / len) * speed, y: (lift / len) * speed, z: (uz / len) * speed };
}

// Is `target` inside the cone a viewer looks along? `eye` and `view` (a direction) are the viewer's; half the cone
// is `halfAngleDeg` wide; nothing beyond `maxDistance` is seen.
export function lookedAt(eye, view, target, halfAngleDeg = 50, maxDistance = 64) {
  const dx = target.x - eye.x, dy = target.y - eye.y, dz = target.z - eye.z;
  const d = Math.hypot(dx, dy, dz);
  if (d === 0) return true;
  if (d > maxDistance) return false;
  const v = Math.hypot(view.x, view.y, view.z);
  if (v === 0) return false;
  return (dx * view.x + dy * view.y + dz * view.z) / (d * v) >= Math.cos((halfAngleDeg * Math.PI) / 180);
}

// A lob: the velocity that carries a projectile with `gravity` (blocks per tick per tick) from `from` to land on `to`
// after `ticks` ticks - a high arc that clears walls. Drag is ignored, so keep the projectile's inertia at 1.
export function lobVelocity(from, to, gravity, ticks) {
  return {
    x: (to.x - from.x) / ticks,
    y: (to.y - from.y + 0.5 * gravity * ticks * ticks) / ticks,
    z: (to.z - from.z) / ticks,
  };
}
