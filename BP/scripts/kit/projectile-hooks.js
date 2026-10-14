// Kit: what happens when a projectile lands, per projectile type. Game-agnostic.
//
//   onProjectileHits({
//     "<projectile type>": { entity(projectile, hit, source, dimension), block(projectile, block, dimension) },
//   })
//
// The projectile entities themselves deal their impact damage (their minecraft:projectile component); these hooks
// add what a component cannot: freezing, fire on the ground, a crater of ice.
import { world } from "@minecraft/server";

export function onProjectileHits(hooks, log) {
  world.afterEvents.projectileHitEntity.subscribe((event) => {
    const type = event.projectile?.typeId;
    const hook = hooks[type]?.entity;
    if (!hook) return;
    try {
      const hit = event.getEntityHit()?.entity;
      if (hit) hook(event.projectile, hit, event.source, event.dimension);
    } catch (e) {
      log?.(`projectile ${type} entity hook failed: ${e}`);
    }
  });
  world.afterEvents.projectileHitBlock.subscribe((event) => {
    const type = event.projectile?.typeId;
    const hook = hooks[type]?.block;
    if (!hook) return;
    try {
      const block = event.getBlockHit()?.block;
      if (block) hook(event.projectile, block, event.dimension);
    } catch (e) {
      log?.(`projectile ${type} block hook failed: ${e}`);
    }
  });
}
