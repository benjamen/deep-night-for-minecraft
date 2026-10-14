// Kit: fire a projectile entity from one point at another. Game-agnostic: the projectile is any entity with a
// minecraft:projectile component. Uses the component's shoot() where the API has it, and an impulse otherwise.
import { aimVelocity, lobVelocity } from "./aim.js";

// Fire `count` of `type` from `from` toward `to` at `speed` blocks per tick, fanned by `spread` degrees each side.
// With `lob: { gravity, ticks }` it is thrown in a high arc to land on `to` instead (over walls).
// Returns how many were fired.
export function fireAt(dimension, type, from, to, { speed = 1.2, spread = 0, count = 1, owner, lob } = {}) {
  let fired = 0;
  for (let k = 0; k < count; k++) {
    const fan = count > 1 ? -spread + (2 * spread * k) / (count - 1) : 0;
    const v = lob ? lobVelocity(from, to, lob.gravity, lob.ticks) : aimVelocity(from, to, speed, fan);
    try {
      const e = dimension.spawnEntity(type, from);
      const proj = e.getComponent("minecraft:projectile");
      if (proj && typeof proj.shoot === "function") {
        if (owner) proj.owner = owner;
        proj.shoot(v);
      } else {
        e.applyImpulse(v);
      }
      fired++;
    } catch {
      // the chunk is not loaded, or the entity could not be spawned: skip it
    }
  }
  return fired;
}
