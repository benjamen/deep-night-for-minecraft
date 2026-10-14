# Deep Night for Minecraft

A Minecraft Bedrock add-on pack (behaviour + resource) with prefix `dn:`. It is separate from any game and built
on [bedrock-kit](https://github.com/benjamen/bedrock-kit); DeadAir and other games use it by adding the packs to a world.

A natural, intense darkness. Night starts normal, deepens to pitch black around midnight, and eases off by dawn.
Anything that gives light makes a pool of light, by the strength of the light it gives. Owls, crickets and the rest of the night
sounds fill it.

## Working on it

```
npm test                 # pure-logic tests, including a check that the vendored kit matches bedrock-kit
npm run sync-kit         # re-vendor the kit and the fog ladder (needs ../bedrock-kit next to this repo)
```

Everything in `BP/scripts/kit/` is copied from bedrock-kit: change it there, never here. See `DESIGN.md`.
