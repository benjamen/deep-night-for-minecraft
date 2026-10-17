// Kit: plays a scripted scene for one player. Game-agnostic: a scene is data
//   { end: ticks, stand?: { pos, facing },
//     shots: [{ at, camera?, fade?, sound?: { id, volume, pitch, from? }, command?: string | string[] }] }
// `command` runs as the player (titles, weather, lightning, camera shake...).
// and the caller supplies hooks. Camera, fade, HUD and input go through commands, which are stable across Script
// API versions, and the scene always hands everything back, even if a step throws or the player leaves.
import { system, world } from "@minecraft/server";
import { cameraCommand, fadeCommand } from "./scene-math.js";

const playing = new Set(); // player ids in a scene right now
const skipping = new Set(); // player ids asked to skip their scene (skipScene)
const stoppers = new Map(); // player id -> stops that player's scene timer
const live = (id) => world.getAllPlayers().find((p) => p.id === id);

function run(player, command, log) {
  try {
    player.runCommand(command);
  } catch (e) {
    log?.(`scene command failed: ${command}: ${e}`);
  }
}

export const isInScene = (player) => playing.has(player.id);

// Ask the scene this player is in to skip to its end on the next tick (for testing, and for a skip button).
export function skipScene(player) {
  if (playing.has(player.id)) skipping.add(player.id);
}

// Stop the scene this player is in right now, wherever it has got to: no more shots, no final stand, no onEnd. Everything
// is handed back. For a reset (testing) or a player who must not finish the scene they were in.
export function cancelScene(player, log) {
  stoppers.get(player.id)?.();
  stoppers.delete(player.id);
  skipping.delete(player.id);
  handBack(player, log);
}

// Take the camera, the HUD and the controls.
export function takeOver(player, log) {
  playing.add(player.id);
  for (const c of ["inputpermission set @s movement disabled", "inputpermission set @s camera disabled", "hud @s hide all"]) run(player, c, log);
}

// Give everything back. Safe to call twice, and on a player who is not in a scene (e.g. one who rejoined).
export function handBack(player, log) {
  playing.delete(player.id);
  for (const c of ["camera @s clear", "inputpermission set @s movement enabled", "inputpermission set @s camera enabled", "hud @s reset"]) run(player, c, log);
}

// Put the player at `pos`, facing `facing`: through the API, not `tp`, so no "You have been teleported" line shows in chat.
function stand(player, { pos, facing }, log) {
  try {
    player.teleport(pos, { facingLocation: facing });
  } catch (e) {
    log?.(`scene stand failed: ${e}`);
  }
}

// Play `scene`. Options:
//   skippable  sneaking (after the first second) skips to the end. Default true.
//   onTick(player, tick)   called every tick while it plays (move actors, etc.)
//   onEnd(player, { skipped, failed })  called once, after control is handed back
//   log(message)           where failures are reported
// Returns false if the player is already in a scene.
export function playScene(player, scene, { skippable = true, onTick, onEnd, log } = {}) {
  if (playing.has(player.id)) return false;
  const id = player.id;
  if (scene.stand) stand(player, scene.stand, log);
  takeOver(player, log);
  const shots = [...scene.shots].sort((a, b) => a.at - b.at);
  let tick = 0;
  let next = 0;
  const finish = (p, result) => {
    system.clearRun(timer);
    stoppers.delete(id);
    skipping.delete(id);
    if (scene.stand) stand(p, scene.stand, log);
    handBack(p, log);
    try {
      onEnd?.(p, result);
    } catch (e) {
      log?.(`scene onEnd failed: ${e}`);
    }
  };
  const timer = system.runInterval(() => {
    const p = live(id);
    if (!p) {
      stoppers.delete(id);
      playing.delete(id);
      skipping.delete(id);
      system.clearRun(timer);
      return;
    }
    try {
      const skip = skippable && ((tick > 20 && p.isSneaking) || skipping.has(id));
      while (!skip && next < shots.length && shots[next].at <= tick) {
        const s = shots[next++];
        if (s.fade) run(p, fadeCommand(s.fade), log);
        if (s.camera) run(p, cameraCommand(s.camera), log);
        for (const c of [].concat(s.command ?? [])) run(p, c, log);
        if (s.sound) {
          const opts = { volume: s.sound.volume ?? 1, pitch: s.sound.pitch ?? 1 };
          if (s.sound.from) p.dimension.playSound(s.sound.id, s.sound.from, opts);
          else p.playSound(s.sound.id, opts);
        }
      }
      onTick?.(p, tick);
      if (skip) {
        run(p, fadeCommand({ in: 0, hold: 0.2, out: 0.6 }), log);
        finish(p, { skipped: true, failed: false });
        return;
      }
      if (tick >= scene.end) {
        finish(p, { skipped: false, failed: false });
        return;
      }
    } catch (e) {
      log?.(`scene failed: ${e}`);
      finish(p, { skipped: false, failed: true });
      return;
    }
    tick++;
  }, 1);
  stoppers.set(id, () => system.clearRun(timer));
  return true;
}
