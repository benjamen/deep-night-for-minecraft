// Kit: runs abilities (abilities.js) for creatures near players. Game-agnostic: the game passes, per entity type,
// its ability list and the hooks that make each one happen.
//
//   startAbilities({
//     mobs: { "<type id>": { abilities: [...], tell(name, entity, target, ctx), fire(name, entity, target, ctx),
//                            cancel?(name, entity, target, ctx) } },
//     players: () => Player[],     who can be targeted (e.g. playing, not in a scene)
//     skip?: (entity) => boolean,  entities to leave alone (actors, scenery)
//     context?: (entity, target) => object,  game state to add to the ctx the abilities see
//     range: 48, interval: 5, log,
//   })
import { system, world } from "@minecraft/server";
import { abilityStep } from "./abilities.js";
import { lookedAt } from "./aim.js";

export function startAbilities({ mobs, players, skip = () => false, context, range = 48, interval = 5, log }) {
  const memory = new Map(); // entity id -> ability memory
  const sight = new Map(); // entity id -> { seen, seenTicks, unseenTicks }
  return system.runInterval(() => {
    const ps = players();
    if (!ps.length) return;
    const dimension = world.getDimension("overworld");
    const now = system.currentTick;
    for (const [type, mob] of Object.entries(mobs)) {
      let entities = [];
      try {
        entities = dimension.getEntities({ type });
      } catch {
        continue;
      }
      for (const e of entities) {
        if (skip(e)) continue;
        let target, dist = Infinity;
        for (const p of ps) {
          const d = Math.hypot(p.location.x - e.location.x, p.location.y - e.location.y, p.location.z - e.location.z);
          if (d < dist) { dist = d; target = p; }
        }
        if (!target || dist > range) continue;
        try {
          const eye = target.getHeadLocation();
          const seen = lookedAt(eye, target.getViewDirection(), { x: e.location.x, y: e.location.y + 1, z: e.location.z }, 55, 64);
          const s = sight.get(e.id) ?? { seen, seenTicks: 0, unseenTicks: 0 };
          s.seenTicks = seen ? s.seenTicks + interval : 0;
          s.unseenTicks = seen ? 0 : s.unseenTicks + interval;
          s.seen = seen;
          sight.set(e.id, s);
          const hp = e.getComponent("minecraft:health");
          const held = target.getComponent("minecraft:inventory")?.container?.getItem(target.selectedSlotIndex)?.typeId;
          const ctx = {
            dist, seen, seenTicks: s.seenTicks, unseenTicks: s.unseenTicks,
            targetInWater: target.isInWater, targetSprinting: target.isSprinting, targetHeld: held,
            inWater: e.isInWater, health: hp ? hp.currentValue / hp.effectiveMax : 1,
            above: e.location.y - target.location.y, // how far the creature is above its target (a gull overhead)
            ...(context ? context(e, target) : {}),
          };
          const step = abilityStep(memory.get(e.id), ctx, now, mob.abilities);
          memory.set(e.id, step.memory);
          if (step.tell) mob.tell?.(step.tell, e, target, ctx);
          if (step.fire) mob.fire?.(step.fire, e, target, ctx);
          if (step.cancel) mob.cancel?.(step.cancel, e, target, ctx);
        } catch (err) {
          log?.(`ability ${type} failed: ${err}`);
        }
      }
    }
    if (memory.size > 512) { memory.clear(); sight.clear(); }
  }, interval);
}
