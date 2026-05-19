/**
 * GeomorphForge — Central Map State Store
 * Simple React context + useReducer for app state.
 */
import { createContext, useContext, useReducer, useCallback } from 'react';

const GRID_DEFAULTS = {
  square: { size: 60, snapUnit: 600 },
  hex:    { size: 36, snapUnit: 36  },
};

const DEFAULT_MAP = {
  id: null,
  name: 'Untitled Map',
  gridType: 'square',   // 'square' | 'hex'
  gridSize: 60,
  snapUnit: 600,
  showGrid: true,
  backgroundColor: '#ffffff',
  objects: [],          // Fabric.js serialized objects
};

const initialState = {
  map: DEFAULT_MAP,
  // Active tool: 'select' | 'pan' | 'text'
  activeTool: 'select',
  // Snap/overlap defaults
  snapToGrid: true,
  allowOverlap: false,
  // Selection
  selectedObjectIds: [],
  // Canvas zoom level (for display)
  zoom: 1,
  // UI dialogs
  showNewMapDialog: false,
  showLoadDialog: false,
  showCloudSyncDialog: false,
  isDirty: false,
  user: null,           // Logged in Firebase user { uid, email }
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MAP':
      return { ...state, map: { ...DEFAULT_MAP, ...action.map }, isDirty: false };

    case 'SET_MAP_NAME':
      return { ...state, map: { ...state.map, name: action.name }, isDirty: true };

    case 'SET_GRID_TYPE': {
      const defaults = GRID_DEFAULTS[action.gridType] || GRID_DEFAULTS.square;
      return {
        ...state,
        map: { ...state.map, gridType: action.gridType, ...defaults },
        isDirty: true,
      };
    }

    case 'TOGGLE_GRID':
      return { ...state, map: { ...state.map, showGrid: !state.map.showGrid }, isDirty: true };

    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.tool };

    case 'TOGGLE_SNAP':
      return { ...state, snapToGrid: !state.snapToGrid };

    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };

    case 'SET_SELECTED':
      return { ...state, selectedObjectIds: action.ids };

    case 'SET_DIRTY':
      return { ...state, isDirty: action.dirty };

    case 'SHOW_NEW_MAP_DIALOG':
      return { ...state, showNewMapDialog: true };

    case 'HIDE_NEW_MAP_DIALOG':
      return { ...state, showNewMapDialog: false };

    case 'SHOW_LOAD_DIALOG':
      return { ...state, showLoadDialog: true };

    case 'HIDE_LOAD_DIALOG':
      return { ...state, showLoadDialog: false };

    case 'SHOW_CLOUD_SYNC_DIALOG':
      return { ...state, showCloudSyncDialog: true };

    case 'HIDE_CLOUD_SYNC_DIALOG':
      return { ...state, showCloudSyncDialog: false };

    case 'SET_USER':
      return { ...state, user: action.user };

    case 'NEW_MAP':
      return {
        ...state,
        map: {
          ...DEFAULT_MAP,
          ...action.options,
          id: `map_${Date.now()}`,
        },
        selectedObjectIds: [],
        isDirty: false,
        showNewMapDialog: false,
      };

    default:
      return state;
  }
}

const MapStoreContext = createContext(null);

export function MapStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = {
    setMap:               useCallback((map) => dispatch({ type: 'SET_MAP', map }), []),
    setMapName:           useCallback((name) => dispatch({ type: 'SET_MAP_NAME', name }), []),
    setGridType:          useCallback((gridType) => dispatch({ type: 'SET_GRID_TYPE', gridType }), []),
    toggleGrid:           useCallback(() => dispatch({ type: 'TOGGLE_GRID' }), []),
    setActiveTool:        useCallback((tool) => dispatch({ type: 'SET_ACTIVE_TOOL', tool }), []),
    toggleSnap:           useCallback(() => dispatch({ type: 'TOGGLE_SNAP' }), []),
    setZoom:              useCallback((zoom) => dispatch({ type: 'SET_ZOOM', zoom }), []),
    setSelected:          useCallback((ids) => dispatch({ type: 'SET_SELECTED', ids }), []),
    setDirty:             useCallback((dirty) => dispatch({ type: 'SET_DIRTY', dirty }), []),
    showNewMapDialog:     useCallback(() => dispatch({ type: 'SHOW_NEW_MAP_DIALOG' }), []),
    hideNewMapDialog:     useCallback(() => dispatch({ type: 'HIDE_NEW_MAP_DIALOG' }), []),
    showLoadDialog:       useCallback(() => dispatch({ type: 'SHOW_LOAD_DIALOG' }), []),
    hideLoadDialog:       useCallback(() => dispatch({ type: 'HIDE_LOAD_DIALOG' }), []),
    showCloudSyncDialog:  useCallback(() => dispatch({ type: 'SHOW_CLOUD_SYNC_DIALOG' }), []),
    hideCloudSyncDialog:  useCallback(() => dispatch({ type: 'HIDE_CLOUD_SYNC_DIALOG' }), []),
    setUser:              useCallback((user) => dispatch({ type: 'SET_USER', user }), []),
    newMap:               useCallback((options) => dispatch({ type: 'NEW_MAP', options }), []),
  };

  return (
    <MapStoreContext.Provider value={{ state, actions }}>
      {children}
    </MapStoreContext.Provider>
  );
}

export function useMapStore() {
  const ctx = useContext(MapStoreContext);
  if (!ctx) throw new Error('useMapStore must be used within MapStoreProvider');
  return ctx;
}

export { GRID_DEFAULTS, DEFAULT_MAP };
