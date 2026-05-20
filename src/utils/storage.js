/**
 * GeomorphForge — LocalStorage Persistence Helper
 */
const MAPS_KEY = 'geomorphforge_maps';

export function getSavedMaps() {
  try {
    const raw = localStorage.getItem(MAPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse saved maps:', e);
    return [];
  }
}

export function saveMapToStorage(mapData) {
  const maps = getSavedMaps();
  
  // Ensure the map has a valid ID
  const mapToSave = { ...mapData };
  if (!mapToSave.id) {
    mapToSave.id = `map_${Date.now()}`;
  }
  
  mapToSave.updatedAt = new Date().toISOString();
  
  const index = maps.findIndex(m => m.id === mapToSave.id);
  if (index >= 0) {
    maps[index] = mapToSave;
  } else {
    mapToSave.createdAt = new Date().toISOString();
    maps.push(mapToSave);
  }
  
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
  } catch (e) {
    console.error('Failed to save map to localStorage:', e);
    alert('Storage is full! Please delete some old maps or enable Cloud Sync to free up space.');
  }
  return mapToSave;
}

export function deleteMapFromStorage(mapId) {
  const maps = getSavedMaps().filter(m => m.id !== mapId);
  localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
}
