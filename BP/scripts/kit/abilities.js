// Kit: special attacks with a warning first. Pure (no Minecraft imports), game-agnostic.
//
// An ability is data:
//   { name, range: [min, max], cooldown: ticks, windup: ticks (0 = instant), chance: 0..1,
//     when?(ctx) -> bool       must hold to start it
//     keepWhen?(ctx) -> bool   must still hold when the windup ends, or it is called off (the counter)
//     reach: 1.5               how far past range[1] the target may have moved and still be hit }
// A creature's abilities are listed in priority order. Each step it starts at most one: an instant one fires at
// once, one with a windup "tells" first (the game plays its warning) and fires `windup` ticks later if it still can.
// After any ability the creature waits `gap` ticks before starting another, so attacks never stack up.
//
// ctx is whatever the game measures; the kit's runner fills: dist, seen, seenTicks, unseenTicks, targetInWater,
// targetSprinting, targetHeld (item id), inWater, health (0..1), above (creature height over its target).

export function abilityStep(memory, ctx, now, defs, { gap = 20, rand = Math.random } = {}) {
  const m = { last: {}, pending: null, busyUntil: -Infinity, ...memory };
  m.last = { ...m.last };
  if (m.pending) {
    if (now < m.pending.fireAt) return { memory: m };
    const def = defs.find((d) => d.name === m.pending.name);
    const pending = m.pending;
    m.pending = null;
    m.busyUntil = now + gap;
    const inReach = def && ctx.dist >= def.range[0] && ctx.dist <= def.range[1] * (def.reach ?? 1.5);
    if (inReach && (!def.keepWhen || def.keepWhen(ctx))) return { memory: m, fire: pending.name };
    return { memory: m, cancel: pending.name };
  }
  if (now < m.busyUntil) return { memory: m };
  for (const def of defs) {
    if (now - (m.last[def.name] ?? -Infinity) < def.cooldown) continue;
    if (ctx.dist < def.range[0] || ctx.dist > def.range[1]) continue;
    if (def.when && !def.when(ctx)) continue;
    if ((def.chance ?? 1) < 1 && rand() >= def.chance) continue;
    m.last[def.name] = now;
    if ((def.windup ?? 0) > 0) {
      m.pending = { name: def.name, fireAt: now + def.windup };
      return { memory: m, tell: def.name };
    }
    m.busyUntil = now + gap;
    return { memory: m, fire: def.name };
  }
  return { memory: m };
}

// Sanity checks for a game's ability table (used by its tests): every range is ordered, cooldowns cover windups,
// and every ability with a windup has a warning the game will play. `tells` is the set of names with a warning.
export function abilityProblems(table, tells = new Set()) {
  const problems = [];
  for (const [type, defs] of Object.entries(table)) {
    const seen = new Set();
    for (const d of defs) {
      if (seen.has(d.name)) problems.push(`${type}: ${d.name} is listed twice`);
      seen.add(d.name);
      if (!(d.range?.[0] <= d.range?.[1])) problems.push(`${type}: ${d.name} has a bad range`);
      if ((d.windup ?? 0) > d.cooldown) problems.push(`${type}: ${d.name} cools down before its windup ends`);
      if ((d.windup ?? 0) > 0 && !tells.has(`${type}:${d.name}`)) problems.push(`${type}: ${d.name} winds up with no warning`);
    }
  }
  return problems;
}
