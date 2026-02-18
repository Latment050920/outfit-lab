const KEY = {
  wardrobe: 'outfitlab.wardrobe.custom',
  enabled: 'outfitlab.wardrobe.enabled',
  favorites: 'outfitlab.favorites'
};

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export function loadWardrobe() {
  const custom = read(KEY.wardrobe, []);
  const enabledMap = read(KEY.enabled, {});
  const base = readDefaultWardrobe();
  const baseMap = new Map(base.map((item) => [item.id, item]));
  for (const customItem of custom) baseMap.set(customItem.id, customItem);

  return [...baseMap.values()].map((item) => ({
    ...item,
    imageDataUrl: item.imageDataUrl || undefined,
    enabled: enabledMap[item.id] ?? item.enabled ?? true,
    isCustom: !!item.isCustom
  }));
}

function readDefaultWardrobe() {
  return (window.DEFAULT_WARDROBE || []).map((item) => ({ ...item, isCustom: false }));
}

export function saveEnabled(id, enabled) {
  const map = read(KEY.enabled, {});
  map[id] = enabled;
  localStorage.setItem(KEY.enabled, JSON.stringify(map));
}

export function addCustomItem(item) {
  const list = read(KEY.wardrobe, []);
  const next = { ...item, isCustom: true };
  const idx = list.findIndex((i) => i.id === next.id);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  localStorage.setItem(KEY.wardrobe, JSON.stringify(list));
}

export function removeCustomItem(id) {
  const list = read(KEY.wardrobe, []);
  localStorage.setItem(KEY.wardrobe, JSON.stringify(list.filter((item) => item.id !== id)));
  const map = read(KEY.enabled, {});
  delete map[id];
  localStorage.setItem(KEY.enabled, JSON.stringify(map));
}

export function loadFavorites() {
  return read(KEY.favorites, []);
}

export function saveFavorite(record) {
  const list = loadFavorites();
  list.unshift(record);
  localStorage.setItem(KEY.favorites, JSON.stringify(list.slice(0, 40)));
}

export function clearLocalData() {
  localStorage.removeItem(KEY.wardrobe);
  localStorage.removeItem(KEY.enabled);
  localStorage.removeItem(KEY.favorites);
}
