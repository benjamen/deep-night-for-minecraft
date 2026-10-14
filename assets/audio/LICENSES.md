# Deep Night audio licences

Every sound in `RP/sounds/dn/` is generated from code by `scripts/gen-sounds.py` (numpy synthesis, encoded to Ogg Vorbis
with ffmpeg). They are original works with no third-party recordings or samples, so there is nothing to attribute and
they are free to use, change and ship in any game (CC0 / public domain).

| Sound id | Files | What it is |
| --- | --- | --- |
| dn.crickets | crickets_1, crickets_2 | three gated high chirps |
| dn.owl | owl_1, owl_2 | a four-note hoot with vibrato |
| dn.wind | wind_1, wind_2 | filtered noise with slow swells and rustle |
| dn.howl | howl_1, howl_2 | a rising and falling harmonic wail, far off |
| dn.twig | twig_1 to twig_3 | a dry snap with two echoes |
| dn.heartbeat | heartbeat_1 | a low double thump |

Synthesized sounds are plainer than field recordings. If you swap in recorded royalty-free sounds later, keep the same
ids in `sound_definitions.json` and add each source and licence to this file.
