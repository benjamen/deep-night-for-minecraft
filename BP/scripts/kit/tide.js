// Kit: a tide that rises and falls on a fixed cycle, for tide locks and tide-dependent paths. Pure, game-agnostic.
// `period` and `low` are in ticks; the low-tide window opens at the start of each cycle.

// The tide at tick `now`: whether it is low, the marker reading (0 at dead low, 10 at full high), and how many
// seconds until the next low tide opens (0 while it is low).
export function tideAt(now, { period, low }) {
  const phase = ((now % period) + period) % period;
  const isLow = phase < low;
  const level = Math.round(5 - 5 * Math.cos(((phase - low / 2) / period) * Math.PI * 2));
  return { low: isLow, marker: isLow ? 0 : Math.max(1, level), secondsToLow: isLow ? 0 : Math.ceil((period - phase) / 20), secondsLeft: isLow ? Math.ceil((low - phase) / 20) : 0 };
}
