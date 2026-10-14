# Deep Night: design

## What it does
Night starts normal, deepens toward midnight, stays pitch black until about 3am, then eases off before dawn.
Anything that gives light makes a pool of light, sized by how much light it gives (a candle small, a torch about ten
blocks, a lantern a little more). Owls and the rest fill the quiet.

## How
- `night-logic.js` (pure, tested): the darkness curve on the kit's 0 to 3 scale, moon and cloud adjustments, how far
  you see in each mode (`gentle`, `normal`, `pitch`), how lights open the dark, eye adaptation, and which sound plays
  when.
- `night.js` (Minecraft glue): every half second it asks the shared fog mixer (bedrock-kit `fog-mixer.js`) for that
  much fog, per player. It never runs the fog command itself, so weather, disasters and a game's own fog can all be
  active at once.
- Lights counted: the item in either hand, plus light blocks within 8 blocks (sampled, about 300 reads per player per
  half second). Extinguished campfires and unlit candles give nothing.

## Two layers
1. **Fog (built).** Works on every device. The limit: fog is measured from the player, so a lamp 30 blocks away is
   swallowed. Large landmark lights (a lighthouse) will get a "beacon" list that is visible through the fog.
2. **Vibrant Visuals lighting (not started).** Where the player has Vibrant Visuals on, a resource pack can set sun and
   moon intensity and colour over the day, which gives true light-based darkness. The pack needs the `pbr` capability.
   Research the exact file names and fields first, and keep layer 1 as the fallback.

## To check first in a running game
Install both packs in a world with cheats on, then:
- `/scriptevent dn:time 19000` then `/scriptevent dn:status`: darkness should read 3.00 and you should see about 2.5
  blocks. `/scriptevent dn:auto` goes back to the real clock.
- Hold a torch, a lantern, then a candle: the circle should grow with the light. Put the torch down and walk away.
- Place a lamp, stand in its pool, step out: the glow should fade over a second or two.
- `/scriptevent dn:mode gentle` and `pitch` change the pitch-black limit.
- Whether the fog command stack behaves (one `kit_mix` entry per player; no flicker when the distance changes rung).
- Whether the generated night sounds (`dn.*`, see `scripts/gen-sounds.py`) sound right: owl, crickets, wind, howl, twig, heartbeat. Use `/playsound dn.owl @s`.
- Caves: night fog fades out between 3 and 14 blocks below the open sky, so caves keep the game's own dark and cellars stay night.
- Flames flicker: torches, candles, campfires and lanterns waver a few percent, so the circle of light breathes.
- Long nights: `/scriptevent dn:long 2` holds the clock back in the dark hours (12500 to 23500) so the night lasts 2 times as long (1 to 4).
  Untested: check the sun still rises on time and nothing else reads a stalled clock.
- `/scriptevent dn:nosleep` stops beds working from 13000 to 23000 so the deep night must be lived through (`dn:nosleep off` undoes it).

## Not done yet
- Recorded field sounds to replace the generated ones (optional, plainer is the trade-off). Royalty free only, with each licence in
  `assets/audio/LICENSES.md`; keep the same ids in `RP/sounds/sound_definitions.json`.
- Lantern oil and matches, fireflies. A settings form for the mode (the pack has no UI dependency yet).
- Beacons (far lights seen through the fog) cannot be done: fog hides particles as well as blocks, so a distant lamp is swallowed.

