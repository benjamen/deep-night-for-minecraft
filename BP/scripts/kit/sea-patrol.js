// Kit: keeps water creatures around the players, in the water zones they belong to. Game-agnostic: the game passes
// rules and spot lists (from water-zones.js, in world coordinates); this file spawns, tags and clears.
//
//   startPatrol({
//     rules: [{ type, zone, perPlayer, near: [min, max], keepWithin, despawnBeyond, below: 1 }],
//     spots: () => ({ zoneName: [[x, z], ...] }),   world coordinates, read each tick (may be empty until built)
//     enabled: (player) => boolean,                   e.g. not before the intro is over
//     interval: 40, log,
//   })
//
// A creature it spawns is tagged `kit_patrol` (and `kit_patrol_<zone>`) and remembers where it was put in the
// dynamic property `kit:home`, so a game can leash it back (homeOf). Actors and anything else the game spawns
// itself are never touched.
import { system, world } from "@minecraft/server";
import { spotsNear } from "./water-zones.js";

export const PATROL_TAG = "kit_patrol";
const HOME = "kit:home";

export function homeOf(entity) {
  try {
    const raw = entity.getDynamicProperty(HOME);
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

// The block a water creature can be put in at column (x, z): `below` blocks under the surface, if that is still
// water. Undefined when the column is not water, not loaded, or too shallow.
function waterSpot(dimension, x, z, below) {
  try {
    const top = dimension.getTopmostBlock({ x, z });
    if (!top || top.typeId !== "minecraft:water") return undefined;
    const y = top.location.y - below;
    for (let cy = y; cy <= top.location.y; cy++) if (dimension.getBlock({ x, y: cy, z })?.typeId !== "minecraft:water") return undefined;
    return { x: x + 0.5, y, z: z + 0.5 };
  } catch {
    return undefined;
  }
}

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

export function startPatrol({ rules, spots, enabled = () => true, interval = 40, log }) {
  return system.runInterval(() => {
    const players = world.getAllPlayers();
    if (!players.length) return;
    const dimension = world.getDimension("overworld");
    let zones;
    try {
      zones = spots() ?? {};
    } catch {
      zones = {};
    }
    for (const rule of rules) {
      // Clear the ones that have been left far behind.
      for (const e of dimension.getEntities({ type: rule.type, tags: [PATROL_TAG] })) {
        if (players.every((p) => dist2(p.location, e.location) > rule.despawnBeyond ** 2)) e.remove();
      }
      const list = zones[rule.zone] ?? [];
      if (!list.length) continue;
      for (const p of players) {
        if (!enabled(p)) continue;
        const near = dimension.getEntities({ type: rule.type, location: p.location, maxDistance: rule.keepWithin }).length;
        if (near >= rule.perPlayer) continue;
        const choices = spotsNear(list, p.location, rule.near[0], rule.near[1]);
        for (let tries = 0; tries < 4 && choices.length; tries++) {
          const pick = choices[Math.floor(Math.random() * choices.length)];
          const at = waterSpot(dimension, pick.x, pick.z, rule.below ?? 1);
          if (!at) continue;
          try {
            const e = dimension.spawnEntity(rule.type, at);
            e.addTag(PATROL_TAG);
            e.addTag(`${PATROL_TAG}_${rule.zone}`);
            e.setDynamicProperty(HOME, JSON.stringify(at));
            log?.(`patrol: ${rule.type} in ${rule.zone} near ${p.name}`);
          } catch (err) {
            log?.(`patrol spawn failed: ${err}`);
          }
          break;
        }
      }
    }
  }, interval);
}
