// Kit: small effect primitives for special attacks, each safe to call on an unloaded or vanished target (failures are
// swallowed: an effect that cannot happen simply does not). Game-agnostic.
import { aimVelocity } from "./aim.js";

export function sound(dimension, id, at, volume = 1, pitch = 1) {
  try {
    dimension.playSound(id, at, { volume, pitch });
  } catch {
    // nobody there to hear it
  }
}

export function particle(dimension, id, at) {
  try {
    dimension.spawnParticle(id, at);
  } catch {
    // unknown particle or unloaded chunk
  }
}

// Knock a player (or any entity that takes knockback) along { x, z } with `up` lift. Script API 2.x takes
// (horizontal force, vertical strength); 1.x took (dirX, dirZ, horizontal, vertical). Both are tried.
export function knock(entity, force, up = 0) {
  try {
    entity.applyKnockback(force, up);
    return true;
  } catch {
    try {
      const s = Math.hypot(force.x, force.z);
      if (s > 0) entity.applyKnockback(force.x / s, force.z / s, s, up);
      return true;
    } catch {
      return false;
    }
  }
}

// Pull `entity` toward `point` (negative strength pushes away).
export function pull(entity, point, strength, up = 0) {
  const dx = point.x - entity.location.x, dz = point.z - entity.location.z;
  const d = Math.hypot(dx, dz) || 1;
  return knock(entity, { x: (dx / d) * strength, z: (dz / d) * strength }, up);
}

// Throw a mob at a target (a charge, a dive, a pounce). Players cannot take impulses; use pull for them.
export function lunge(entity, target, power, lift = 0.2) {
  try {
    const v = aimVelocity(entity.location, target, power);
    entity.applyImpulse({ x: v.x, y: Math.max(lift, v.y), z: v.z });
    return true;
  } catch {
    return false;
  }
}

export function effect(entity, id, ticks, amplifier = 0) {
  try {
    entity.addEffect(id, ticks, { amplifier, showParticles: false });
    return true;
  } catch {
    return false;
  }
}

// Everyone of `families` (default players) within `radius` of `center` takes `damage` and is thrown outward.
// Returns the entities hit.
export function shockwave(dimension, center, radius, damage, throwStrength, { families = ["player"], source } = {}) {
  const hit = [];
  let near = [];
  try {
    near = dimension.getEntities({ location: center, maxDistance: radius });
  } catch {
    return hit;
  }
  for (const e of near) {
    if (e === source) continue;
    let fam = [];
    try {
      fam = e.getComponent("minecraft:type_family")?.getTypeFamilies?.() ?? (e.typeId === "minecraft:player" ? ["player"] : []);
    } catch {
      fam = e.typeId === "minecraft:player" ? ["player"] : [];
    }
    if (!families.some((f) => fam.includes(f))) continue;
    try {
      if (damage > 0) e.applyDamage(damage, source ? { cause: "entityAttack", damagingEntity: source } : undefined);
    } catch {
      // immune or gone
    }
    pull(e, center, -throwStrength, 0.4);
    hit.push(e);
  }
  return hit;
}

// Summon up to `count` of `type` around `center`, never more than `cap` of them within `capRadius`.
export function summonNear(dimension, type, center, count, { radius = 3, cap = 6, capRadius = 16, tag } = {}) {
  let made = 0;
  try {
    const have = dimension.getEntities({ type, location: center, maxDistance: capRadius }).length;
    for (let i = 0; i < count && have + made < cap; i++) {
      const a = Math.random() * Math.PI * 2;
      const at = { x: center.x + Math.cos(a) * radius, y: center.y, z: center.z + Math.sin(a) * radius };
      const e = dimension.spawnEntity(type, at);
      if (tag) e.addTag(tag);
      made++;
    }
  } catch {
    // unloaded or not allowed here
  }
  return made;
}
