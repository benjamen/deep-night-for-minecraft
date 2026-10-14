// Kit: how much light things give off, for any pack that lights its surroundings by what is held or placed. Pure,
// game-agnostic data from the vanilla block light table (0 to 15), plus a helper for stacked candles.
const LIGHT = {
  "minecraft:torch": 14, "minecraft:soul_torch": 10, "minecraft:redstone_torch": 7, "minecraft:copper_torch": 14,
  "minecraft:lantern": 15, "minecraft:soul_lantern": 10, "minecraft:copper_lantern": 15,
  "minecraft:campfire": 15, "minecraft:soul_campfire": 10,
  "minecraft:sea_lantern": 15, "minecraft:glowstone": 15, "minecraft:shroomlight": 15,
  "minecraft:ochre_froglight": 15, "minecraft:verdant_froglight": 15, "minecraft:pearlescent_froglight": 15,
  "minecraft:lit_pumpkin": 15, "minecraft:jack_o_lantern": 15, "minecraft:lava": 15, "minecraft:fire": 15,
  "minecraft:soul_fire": 10, "minecraft:end_rod": 14, "minecraft:beacon": 15, "minecraft:conduit": 15,
  "minecraft:lit_furnace": 13, "minecraft:lit_blast_furnace": 13, "minecraft:lit_smoker": 13,
  "minecraft:magma": 3, "minecraft:enchanting_table": 7, "minecraft:ender_chest": 7,
  "minecraft:amethyst_cluster": 5, "minecraft:large_amethyst_bud": 4, "minecraft:medium_amethyst_bud": 2,
  "minecraft:small_amethyst_bud": 1, "minecraft:sculk_catalyst": 6, "minecraft:glow_lichen": 7,
  "minecraft:crying_obsidian": 10, "minecraft:respawn_anchor": 0, "minecraft:brewing_stand": 1,
  "minecraft:dragon_egg": 1, "minecraft:sea_pickle": 0,
};
const CANDLES = /^minecraft:(?:[a-z_]+_)?candle$/;

// The light level (0..15) a block, or an item held in a hand, gives off (the item id is the block id for torches and
// lanterns). `states` may carry `candles` (0..3 means 1..4 candles)
// and `lit`. `extra` is a game's own table, which wins over the built-in one.
export function lightOf(typeId, states = {}, extra = {}) {
  if (typeId in extra) return extra[typeId];
  if (CANDLES.test(typeId)) return states.lit === false ? 0 : Math.min(4, (states.candles ?? 0) + 1) * 3;
  return LIGHT[typeId] ?? 0;
}

export const LIGHT_TABLE = Object.freeze({ ...LIGHT });
