// Kit: is a player (or any point) out in the open? Weather, falling rock, ash and darkness all ask this. The rule is
// pure and tested; skyExposed() feeds it from the world. Game-agnostic.

// `topY` is the y of the highest non-air block in the column; `feetY` is where the entity stands. Open to the sky when
// nothing sits at or above the feet except what is below them.
export function exposedByHeights(topY, feetY) {
  return topY === undefined || topY < Math.floor(feetY);
}

// Open to the sky? Roofs, leaves and glass all count as cover.
export function skyExposed(dimension, location) {
  try {
    const top = dimension.getTopmostBlock({ x: Math.floor(location.x), z: Math.floor(location.z) });
    return exposedByHeights(top?.location.y, location.y);
  } catch {
    return true; // unloaded: treat as open
  }
}
