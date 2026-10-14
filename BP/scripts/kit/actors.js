// Kit: actors for scripted scenes - entities that are moved by the scene, not by their own AI. Game-agnostic.
// An actor is spawned with a tag the game's AI code skips, held in place by being teleported every tick, and always
// removed when the scene ends.
export function spawnActor(dimension, type, at, tag) {
  try {
    const e = dimension.spawnEntity(type, at);
    if (tag) e.addTag(tag);
    return e;
  } catch {
    return undefined;
  }
}

// Put an actor at `pos`, facing `facing` (a point), if it is still there.
export function placeActor(e, pos, facing) {
  try {
    if (e?.isValid) e.teleport(pos, facing ? { facingLocation: facing } : undefined);
  } catch {
    // gone or unloaded
  }
}

export function removeActors(list) {
  for (const e of list) {
    try {
      if (e?.isValid) e.remove();
    } catch {
      // already gone
    }
  }
}
