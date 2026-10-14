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
- Whether the base game's placeholder sounds are tolerable (owl is a low flute note; the heartbeat is a bass drum).

## Not done yet
- Recorded sounds: crickets, owl, wind in branches, a distant howl. Royalty free only, with each licence recorded in
  `assets/audio/LICENSES.md`. Until then the table in `night.js` maps cues to base-game sounds, or to nothing.
- Caves and mines (same darkness, by how much rock is overhead).
- Beacons (far lights seen through the fog), light flicker, lantern oil and matches, fireflies.
- A settings form for the mode, and a per-world option to stop sleeping in the dark window.
- Night length: at normal speed pitch black lasts about two and a half minutes; a half-speed night option is planned.
