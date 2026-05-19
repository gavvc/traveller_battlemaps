/**
 * useTileManifest — loads and provides tile manifest data
 * with search and filter helpers.
 */
import { useState, useEffect, useMemo } from 'react';

let _manifestCache = null;

export function useTileManifest() {
  const [manifest, setManifest] = useState(_manifestCache);
  const [loading, setLoading] = useState(!_manifestCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_manifestCache) return;
    setLoading(true);
    fetch('/tile-manifest.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        _manifestCache = data;
        setManifest(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { manifest, loading, error };
}

/**
 * Derive hierarchical tree from flat tiles array:
 * { Collection -> Category -> tiles[] }
 */
export function buildTileTree(tiles) {
  const tree = {};
  for (const tile of tiles) {
    const col = tile.collection;
    const cat = tile.category;
    if (!tree[col]) tree[col] = {};
    if (!tree[col][cat]) tree[col][cat] = [];
    tree[col][cat].push(tile);
  }
  return tree;
}

/**
 * Filter tiles based on search text and active filters.
 */
export function filterTiles(tiles, { searchText = '', filters = {} }) {
  if (!tiles) return [];
  let result = tiles;

  // Text search
  if (searchText.trim()) {
    const q = searchText.toLowerCase().trim();
    result = result.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.filename.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.collection.toLowerCase().includes(q) ||
      (t.tags && t.tags.some(tag => tag.includes(q))) ||
      (t.rooms && t.rooms.some(r => r.includes(q)))
    );
  }

  // Collection filter
  if (filters.collection) {
    result = result.filter(t => t.collection === filters.collection);
  }

  // Grid size filter
  if (filters.gridSize) {
    result = result.filter(t =>
      t.gridSize && `${t.gridSize[0]}x${t.gridSize[1]}` === filters.gridSize
    );
  }

  // dTon band filter (e.g. "26–50 dT")
  if (filters.dtonBand) {
    result = result.filter(t => t.dtonBand === filters.dtonBand);
  }

  // Room/function filter
  if (filters.room) {
    result = result.filter(t => t.rooms && t.rooms.includes(filters.room));
  }

  // Orientation filter
  if (filters.orientation) {
    result = result.filter(t =>
      t.orientation?.toLowerCase() === filters.orientation.toLowerCase()
    );
  }

  // Type filters
  if (filters.overlayOnly) result = result.filter(t => t.isOverlay);
  if (filters.symbolsOnly) result = result.filter(t => t.isSymbol);
  if (filters.hideOverlays) result = result.filter(t => !t.isOverlay);
  if (filters.hideMirrors)  result = result.filter(t => !t.isMirror);

  return result;
}

/**
 * Get unique collections for filter UI.
 */
export function useCollectionList(manifest) {
  return useMemo(() => {
    if (!manifest) return [];
    const cols = [...new Set(manifest.tiles.map(t => t.collection))];
    return cols.sort();
  }, [manifest]);
}

/**
 * Get unique grid sizes for filter UI.
 */
export function useGridSizeList(manifest) {
  return useMemo(() => {
    if (!manifest) return [];
    const sizes = new Set();
    for (const t of manifest.tiles) {
      if (t.gridSize) sizes.add(`${t.gridSize[0]}x${t.gridSize[1]}`);
    }
    return [...sizes].sort((a, b) => {
      const [aw, ah] = a.split('x').map(Number);
      const [bw, bh] = b.split('x').map(Number);
      return (bw * bh) - (aw * ah);
    });
  }, [manifest]);
}

/**
 * Get unique room types sorted by frequency.
 */
export function useRoomList(manifest) {
  return useMemo(() => {
    if (!manifest) return [];
    const counts = {};
    for (const t of manifest.tiles) {
      for (const r of (t.rooms ?? [])) {
        counts[r] = (counts[r] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([room]) => room);
  }, [manifest]);
}

/**
 * Get dTon bands present in the manifest, ordered small→large.
 */
export function useDtonBands(manifest) {
  const ORDER = ['1–10 dT','11–25 dT','26–50 dT','51–100 dT','101–200 dT','200+ dT'];
  return useMemo(() => {
    if (!manifest) return [];
    const present = new Set(manifest.tiles.map(t => t.dtonBand).filter(Boolean));
    return ORDER.filter(b => present.has(b));
  }, [manifest]);
}
