// Kit: applies the shared fog (fog.js) to each player. Every pack that uses the kit calls startFogMixer() once, and
// asks for fog with setFog()/clearFog(). The copies find each other with script events; the one with the lowest pack
// id (electOwner) is the only one that touches the fog command, so the packs never fight over it.
//
// Needs the fog ladder in the resource pack: run scripts/gen-fogs.mjs from the kit repo into the pack's RP/fogs.
import { system, world } from "@minecraft/server";
import { DEFAULT_LADDER, electOwner, liveAsks, mixFog, snapFog } from "./fog.js";

const USER_ID = "kit_mix"; // the id the mixed fog is pushed under: one entry per player, always
const TTL = 60; // ticks an ask lives without being refreshed
const HELLO_EVERY = 100;
const asks = new Map(); // `${layer}|${playerId}` -> { layer, player, distance, tint, until, from }
const peers = new Map(); // pack id -> tick last heard
const applied = new Map(); // player id -> { id, tint, step }
let me = "pack";
let ladder = DEFAULT_LADDER;
let logger = () => {};
let failures = 0;

// Script events cannot be sent while the world is still loading (the scripts' first run is before it), so a failure is
// not final: the hello is sent again every few seconds. Only a build that never manages one runs alone.
function broadcast(id, payload) {
  try {
    system.sendScriptEvent(id, JSON.stringify(payload));
    if (failures >= 3) logger("fog mixer: script events work now");
    failures = 0;
  } catch (e) {
    failures++;
    if (failures === 3) logger(`fog mixer: script events failing (${e}); running alone until they work`);
  }
}

// Ask for fog on one player (`player` is a player id, or "*" for everyone). `layer` names who is asking, such as
// "night" or "rain". Call it again to change or refresh the ask; it lapses after about three seconds otherwise.
export function setFog(layer, player, { distance, tint = "mist" }) {
  const now = system.currentTick;
  const ask = { layer, player, distance, tint, until: now + TTL, from: me };
  asks.set(`${layer}|${player}`, ask);
  broadcast("kit:fog", ask);
}

export function clearFog(layer, player) {
  asks.delete(`${layer}|${player}`);
  broadcast("kit:fog", { layer, player, distance: 0, tint: "mist", until: 0, from: me });
}

function apply(player, rung) {
  const before = applied.get(player.id);
  if (!rung) {
    if (before) {
      try {
        player.runCommand(`fog @s remove ${USER_ID}`);
      } catch {
        // player left
      }
      applied.delete(player.id);
    }
    return;
  }
  if (before && before.id === rung.id) return;
  try {
    player.runCommand(`fog @s remove ${USER_ID}`);
    player.runCommand(`fog @s push ${rung.id} ${USER_ID}`);
    applied.set(player.id, rung);
  } catch (e) {
    logger(`fog apply failed: ${e}`);
  }
}

function step() {
  const now = system.currentTick;
  for (const [k, a] of asks) if (a.until <= now) asks.delete(k);
  for (const [id, seen] of peers) if (id !== me && now - seen > HELLO_EVERY * 3) peers.delete(id);
  if (electOwner([...peers.keys(), me]) !== me) return; // another copy has the fog
  const live = liveAsks([...asks.values()], now);
  for (const player of world.getAllPlayers()) {
    const mine = live.filter((a) => a.player === "*" || a.player === player.id);
    apply(player, snapFog(mixFog(mine, ladder.tints), ladder, applied.get(player.id)));
  }
}

// Start once, at startup. `packId` must differ between packs (the pack's own uuid is a good one).
export function startFogMixer({ packId, fogLadder = DEFAULT_LADDER, log = () => {} }) {
  me = packId;
  ladder = fogLadder;
  logger = log;
  peers.set(me, system.currentTick);
  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    try {
      if (id === "kit:hello") {
        const m = JSON.parse(message);
        if (m.from !== me) peers.set(m.from, system.currentTick);
      } else if (id === "kit:fog") {
        const a = JSON.parse(message);
        if (a.from === me) return;
        if (a.until > system.currentTick) asks.set(`${a.layer}|${a.player}`, a);
        else asks.delete(`${a.layer}|${a.player}`);
      }
    } catch {
      // not ours
    }
  });
  system.runInterval(() => broadcast("kit:hello", { from: me }), HELLO_EVERY);
  system.runInterval(step, 10);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => applied.delete(playerId));
  system.run(() => broadcast("kit:hello", { from: me })); // after the world has loaded
}
