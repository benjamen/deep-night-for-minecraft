// Deep Night, the Minecraft side: every half second, work out how dark it is for each player, how far their own
// lights let them see, and ask the shared fog mixer (kit/fog-mixer.js) for that much fog. Also plays the sounds of
// the night around them. All the numbers come from night-logic.js, which is tested; this file is only glue and has
// not been run in a game yet (see DESIGN.md for what to check first).
import { system, world } from "@minecraft/server";
import { clearFog, setFog, startFogMixer } from "./kit/fog-mixer.js";
import { lightOf } from "./kit/luminance.js";
import { darknessAt, easeDistance, flameLevel, canSleep, holdClock, isFlame, nextCue, seeingDistance, surfaceFactor, undergroundDistance, visibleDistance } from "./night-logic.js";

export const PACK_ID = "deep-night-f2a93cb9";
const INTERVAL = 10; // ticks between updates
const LAYER = "night";
const MODE_KEY = "dn:mode";

// Placeholder sounds from the base game until the pack ships its own recorded ones (see DESIGN.md). A cue mapped to
// null is silent for now.
export const SOUNDS = {
  crickets: { id: "dn.crickets", pitch: 1 },
  owl: { id: "dn.owl", pitch: 1 },
  wind_in_branches: { id: "dn.wind", pitch: 1 },
  distant_howl: { id: "dn.howl", pitch: 1 },
  twig_snap: { id: "dn.twig", pitch: 1 },
  heartbeat: { id: "dn.heartbeat", pitch: 1 },
};

const log = (msg) => console.warn(`[DeepNight] ${msg}`);
const seen = new Map(); // player id -> eased distance
const cues = new Map(); // player id -> { at: tick, last: cue name }
const debug = { time: undefined, dark: undefined, off: false };

const mode = () => {
  const m = world.getDynamicProperty(MODE_KEY);
  return typeof m === "string" ? m : "normal";
};

function worldTick() {
  if (debug.time !== undefined) return debug.time;
  try {
    return world.getTimeOfDay();
  } catch {
    return 6000; // no clock: treat as day, never dark by mistake
  }
}

function sky() {
  const out = {};
  try {
    out.moon = world.getMoonPhase();
  } catch {
    // older builds: no moon phase
  }
  try {
    const w = world.getDimension("overworld").getWeather();
    out.overcast = w === "Thunder" ? 1 : w === "Rain" ? 0.6 : 0;
  } catch {
    out.overcast = 0;
  }
  return out;
}

// The light of an item in a hand, or of a placed light block.
function held(player) {
  let best = { level: 0, flame: false };
  const consider = (item) => {
    if (!item) return;
    const level = lightOf(item.typeId);
    if (level > best.level) best = { level, flame: isFlame(item.typeId) };
  };
  try {
    consider(player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex));
    consider(player.getComponent("minecraft:equippable")?.getEquipment("Offhand"));
  } catch {
    // no inventory yet
  }
  return best;
}

function blockLight(block) {
  const id = block.typeId;
  if (id === "minecraft:air") return 0;
  const states = {};
  if (id.endsWith("candle")) {
    states.candles = block.permutation.getState("candles");
    states.lit = block.permutation.getState("lit");
  }
  if (id.endsWith("campfire") && block.permutation.getState("extinguished") === true) return 0;
  return lightOf(id, states);
}

// Light blocks within eight blocks, sampled every second column and from just below to just above the head: about
// 300 block reads, a few times a second.
function nearbyLights(player) {
  const lights = [];
  const { x, y, z } = player.location;
  const dim = player.dimension;
  for (let dx = -8; dx <= 8; dx += 2) {
    for (let dz = -8; dz <= 8; dz += 2) {
      for (let dy = -1; dy <= 2; dy++) {
        try {
          const block = dim.getBlock({ x: Math.floor(x) + dx, y: Math.floor(y) + dy, z: Math.floor(z) + dz });
          if (!block) continue;
          const level = blockLight(block);
          if (level > 0) lights.push({ level: flameLevel(level, isFlame(block.typeId), system.currentTick, dx * 7 + dz * 3), distance: Math.hypot(dx, dy, dz) });
        } catch {
          // unloaded
        }
      }
    }
  }
  lights.sort((a, b) => b.level - a.level);
  return lights.slice(0, 6);
}

// How far below the open sky the player is: 0 in the open, large deep in a cave. Reads the top block of the column.
function depthBelowSurface(player) {
  try {
    const top = player.dimension.getTopmostBlock({ x: Math.floor(player.location.x), z: Math.floor(player.location.z) });
    return top ? Math.max(0, top.location.y + 1 - player.location.y) : 0;
  } catch {
    return 0;
  }
}

function update() {
  const tick = worldTick();
  const darkness = debug.off ? 0 : debug.dark ?? darknessAt(tick, sky());
  const base = seeingDistance(darkness, mode());
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id !== "minecraft:overworld" || base === undefined) {
      if (seen.delete(player.id)) clearFog(LAYER, player.id);
      continue;
    }
    const lights = nearbyLights(player);
    const inHand = held(player);
    if (inHand.level > 0) lights.push({ level: flameLevel(inHand.level, inHand.flame, system.currentTick), distance: 0 });
    const lit = visibleDistance(base, lights);
    const target = undergroundDistance(lit, surfaceFactor(depthBelowSurface(player)));
    const dist = easeDistance(seen.get(player.id), target, INTERVAL / 20);
    seen.set(player.id, dist);
    setFog(LAYER, player.id, { distance: dist, tint: "night" });
    sounds(player, darkness);
  }
}

function sounds(player, darkness) {
  const now = system.currentTick;
  const state = cues.get(player.id) ?? { at: now + 100, last: undefined };
  if (now < state.at) {
    cues.set(player.id, state);
    return;
  }
  const cue = nextCue(darkness, Math.random, state.last);
  if (!cue) {
    cues.set(player.id, { at: now + 100, last: state.last });
    return;
  }
  cues.set(player.id, { at: now + Math.round(cue.gap * 20), last: cue.name });
  const sound = SOUNDS[cue.name];
  if (!sound) return;
  const at = { x: player.location.x + Math.cos(cue.angle) * cue.distance, y: player.location.y, z: player.location.z + Math.sin(cue.angle) * cue.distance };
  try {
    player.dimension.playSound(sound.id, at, { volume: cue.volume, pitch: sound.pitch * cue.pitch });
  } catch {
    // unloaded
  }
}

export function startNight() {
  startFogMixer({ packId: PACK_ID, log });
  system.runInterval(update, INTERVAL);
  // No sleeping through the dark: with dn:nosleep on, beds refuse during the deep night.
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (!event.block.typeId.endsWith("_bed") || world.getDynamicProperty("dn:nosleep") !== true) return;
    if (canSleep(worldTick(), true)) return;
    event.cancel = true;
    system.run(() => event.player.onScreenDisplay.setActionBar("§7You can't sleep. Something is out there."));
  });
  // Long nights: hold the clock back during the dark hours (dn:long 2 makes the night twice as long).
  let counter = 0;
  system.runInterval(() => {
    const factor = Number(world.getDynamicProperty("dn:long") ?? 1);
    if (debug.time !== undefined || factor <= 1) return;
    counter += 1;
    const t = worldTick();
    if (holdClock(t, counter, factor)) {
      try {
        world.setTimeOfDay(t - 1);
      } catch {
        // clock not settable
      }
    }
  }, 1);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    seen.delete(playerId);
    cues.delete(playerId);
  });
  // Testing aids, from chat: /scriptevent dn:mode gentle|normal|pitch, dn:time 19000, dn:dark 3, dn:off, dn:auto
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    // Quiet (`/scriptevent dn:quiet on`): no chat replies, for a game that drives the night by script event; the line goes to the log.
    const say = (text) => (world.getDynamicProperty("dn:quiet") === "on" ? console.warn(`[Deep Night] ${text}`) : sourceEntity?.sendMessage?.(`[Deep Night] ${text}`));
    const m = message.trim();
    if (id === "dn:quiet") {
      world.setDynamicProperty("dn:quiet", m === "off" ? "off" : "on");
    } else if (id === "dn:mode") {
      world.setDynamicProperty(MODE_KEY, ["gentle", "normal", "pitch"].includes(m) ? m : "normal");
      say(`mode ${mode()}`);
    } else if (id === "dn:nosleep") {
      world.setDynamicProperty("dn:nosleep", m !== "off");
      say(`sleeping through the dark is ${m === "off" ? "allowed" : "blocked"}`);
    } else if (id === "dn:long") {
      const f = Math.min(4, Math.max(1, Number(m) || 1));
      world.setDynamicProperty("dn:long", f);
      say(`the night is ${f} times as long`);
    } else if (id === "dn:time") {
      debug.time = m === "" ? undefined : Number(m);
      say(m === "" ? "clock restored" : `clock fixed at ${m}`);
    } else if (id === "dn:dark") {
      debug.dark = m === "" ? undefined : Number(m);
      debug.off = false;
      say(m === "" ? "darkness follows the clock" : `darkness fixed at ${m}`);
    } else if (id === "dn:off") {
      debug.off = true;
      say("off");
    } else if (id === "dn:auto") {
      debug.time = debug.dark = undefined;
      debug.off = false;
      say("automatic");
    } else if (id === "dn:status") {
      const d = debug.off ? 0 : debug.dark ?? darknessAt(worldTick(), sky());
      say(`tick ${worldTick()}, darkness ${d.toFixed(2)}, mode ${mode()}, sees ${seen.get(sourceEntity?.id)?.toFixed(1) ?? "-"} blocks`);
    }
  });
  log("started");
}
