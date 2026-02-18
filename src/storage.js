const KEY = {
  wardrobe: 'outfitlab.wardrobe.custom',
  enabled: 'outfitlab.wardrobe.enabled',
  favorites: 'outfitlab.favorites'
};

export function loadWardrobe() {
  const custom = JSON.parse(localStorage.getItem(KEY.wardrobe) || '[]');
  const enabledMap = JSON.parse(localStorage.getItem(KEY.enabled) || '{}');
  const base = (window.DEFAULT_WARDROBE || []).map((item) => ({ ...item, enabled: enabledMap[item.id] ?? item.enabled }));
  return [...base, ...custom.map((item) => ({ ...item, enabled: enabledMap[item.id] ?? true }))];
}

export function saveEnabled(id, enabled) {
  const map = JSON.parse(localStorage.getItem(KEY.enabled) || '{}');
  map[id] = enabled;
  localStorage.setItem(KEY.enabled, JSON.stringify(map));
}

export function addCustomItem(item) {
  const list = JSON.parse(localStorage.getItem(KEY.wardrobe) || '[]');
  list.push(item);
  localStorage.setItem(KEY.wardrobe, JSON.stringify(list));
}

export function loadFavorites() {
  return JSON.parse(localStorage.getItem(KEY.favorites) || '[]');
}

export function saveFavorite(record) {
  const list = loadFavorites();
  list.unshift(record);
  localStorage.setItem(KEY.favorites, JSON.stringify(list.slice(0, 40)));
}
