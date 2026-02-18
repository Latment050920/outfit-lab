export function createSeededRandom(seed = Date.now()) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function pickWeighted(items, rand) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.score), 0);
  if (total <= 0) return items[0]?.item;
  let cursor = rand() * total;
  for (const entry of items) {
    cursor -= Math.max(0, entry.score);
    if (cursor <= 0) return entry.item;
  }
  return items[items.length - 1]?.item;
}
