/**
 * GeomorphForge — Main Application
 * Wires all panels together: Header, TileBrowser, Canvas, Toolbar, Properties.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { MapStoreProvider, useMapStore } from './store/mapStore';
import TileBrowser from './components/TileBrowser/TileBrowser';
import CanvasEditor from './components/Canvas/CanvasEditor';
import Toolbar from './components/Toolbar/Toolbar';
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel';
import NewMapDialog from './components/Dialogs/NewMapDialog';
import LoadMapDialog from './components/Dialogs/LoadMapDialog';
import CloudSyncDialog from './components/Dialogs/CloudSyncDialog';
import AboutDialog from './components/Dialogs/AboutDialog';
import ExportDialog from './components/Dialogs/ExportDialog';
import { saveMapToStorage } from './utils/storage';
import { syncMapToCloud, logoutUser, subscribeToAuth, logAnalyticsEvent } from './utils/firebase';

// ── Header ────────────────────────────────────────────────────────────────────
function Header({ engine }) {
  const { state, actions } = useMapStore();
  const fileInputRef = useRef(null);

  async function handleSave() {
    if (!engine?.current) return;
    const objects = engine.current.getObjectsJSON();
    const mapToSave = {
      ...state.map,
      objects,
    };
    const saved = saveMapToStorage(mapToSave);
    actions.setMap(saved);

    logAnalyticsEvent('save_map', {
      map_name: saved.name,
      grid_type: saved.gridType,
      objects_count: saved.objects?.length || 0,
      is_cloud: !!state.user
    });

    // Save to Firebase Firestore if logged in
    if (state.user) {
      try {
        await syncMapToCloud(saved, state.user.uid);
      } catch (err) {
        console.error('Cloud save failed:', err);
      }
    }
  }

  async function handleDuplicate() {
    if (!engine?.current) return;
    const objects = engine.current.getObjectsJSON();
    const duplicatedMap = {
      ...state.map,
      id: `map_${Date.now()}`,
      name: `${state.map.name} (Copy)`,
      objects,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const saved = saveMapToStorage(duplicatedMap);
    actions.setMap(saved);

    logAnalyticsEvent('duplicate_map', {
      map_name: saved.name,
      grid_type: saved.gridType,
      objects_count: saved.objects?.length || 0
    });

    // Sync clone to cloud if user logged in
    if (state.user) {
      try {
        await syncMapToCloud(saved, state.user.uid);
      } catch (err) {
        console.error('Cloud save duplicate failed:', err);
      }
    }

    alert(`Map "${state.map.name}" duplicated successfully as "${duplicatedMap.name}"!`);
  }

  function handleLoadClick() {
    if (state.isDirty) {
      if (!confirm('You have unsaved changes. Loading another map will discard them. Do you want to proceed?')) {
        return;
      }
    }
    actions.showLoadDialog();
  }

  function handleNewClick() {
    if (state.isDirty) {
      if (!confirm('You have unsaved changes. Creating a new map will discard them. Do you want to proceed?')) {
        return;
      }
    }
    actions.showNewMapDialog();
  }

  function handleImportClick() {
    if (state.isDirty) {
      if (!confirm('You have unsaved changes. Importing a map will discard them. Do you want to proceed?')) {
        return;
      }
    }
    fileInputRef.current?.click();
  }

  function handleFileImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!importedData.objects || !Array.isArray(importedData.objects)) {
          alert('Error: The selected file is not a valid GeomorphForge map.');
          return;
        }

        const mapToLoad = {
          ...importedData,
          id: `map_${Date.now()}`,
          name: importedData.name || 'Imported Map',
          gridType: 'square', // Hardcode to square
        };

        actions.setMap(mapToLoad);
        actions.setDirty(true);
        
        logAnalyticsEvent('import_map', {
          map_name: mapToLoad.name,
          objects_count: mapToLoad.objects?.length || 0
        });

        alert(`Map "${mapToLoad.name}" imported successfully!`);
      } catch (err) {
        console.error('Import failed:', err);
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <header className="app-header">
      {/* Logo */}
      <div className="logo">
        <div className="logo-icon">⬡</div>
        <span className="logo-text">GeomorphForge</span>
      </div>

      <div className="toolbar-divider" style={{ height: 28 }} />

      {/* Map name */}
      <input
        className="map-name-input"
        type="text"
        value={state.map.name}
        onChange={e => actions.setMapName(e.target.value)}
        title="Map name (click to edit)"
      />
      {state.isDirty && (
        <span style={{ fontSize: 10, color: 'var(--color-amber)', title: 'Unsaved changes', cursor: 'pointer' }} onClick={handleSave}>●</span>
      )}

      <div className="header-spacer" />

      {/* Actions */}
      <div className="header-actions">
        {/* Optional Cloud Sync Button/Indicator */}
        {state.user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'rgba(56, 189, 248, 0.08)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
              ☁️ Cloud Synced: <strong style={{ color: 'var(--color-text-primary)' }}>{state.user.email}</strong>
            </span>
            <button className="btn btn-ghost" onClick={() => logoutUser()} style={{ fontSize: 10, padding: '5px 8px' }}>
              Sign Out
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={actions.showCloudSyncDialog} style={{ border: '1px dashed var(--color-border-light)', marginRight: 8 }} title="Activate optional cloud backup to Firestore">
            ☁️ Cloud Sync (Optional)
          </button>
        )}

        <div className="toolbar-divider" style={{ height: 20, marginRight: 8 }} />

        <button className="btn" onClick={handleLoadClick} title="Load a saved map">
          📁 Load
        </button>
        <button className="btn btn-primary" onClick={handleSave} title="Save map to localStorage">
          💾 Save
        </button>
        <button className="btn" onClick={handleDuplicate} title="Duplicate current map (copy)">
          📋 Duplicate
        </button>
        
        <div className="toolbar-divider" style={{ height: 20 }} />

        <button className="btn" onClick={handleImportClick} title="Import map JSON file">
          📥 Import
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileImport}
          accept=".json"
          style={{ display: 'none' }}
        />
        <button className="btn" onClick={actions.showExportDialog} title="Export map options">
          📤 Export
        </button>

        <div className="toolbar-divider" style={{ height: 20 }} />

        <button className="btn" onClick={handleNewClick} title="Create a new map">
          ＋ New
        </button>
      </div>
    </header>
  );
}

// ── Inner App (needs MapStore context) ────────────────────────────────────────
function InnerApp() {
  const engineRef = useRef(null);
  const [selectedObjects, setSelectedObjects] = useState([]);
  const { state, actions } = useMapStore();
  const { setUser, setMap, setActiveTool, setZoom, toggleGrid, toggleSnap, setSnap } = actions;

  // Firebase auth state subscription
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      if (user) {
        setUser({ uid: user.uid, email: user.email });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [setUser]);

  // Debounced Auto-Save effect (Background saves to local + cloud)
  useEffect(() => {
    if (!state.isDirty || !engineRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const objects = engineRef.current.getObjectsJSON();
        const mapToSave = {
          ...state.map,
          objects,
        };
        const saved = saveMapToStorage(mapToSave);
        
        // Push to Firestore in background if logged in
        if (state.user) {
          await syncMapToCloud(saved, state.user.uid);
        }
        
        setMap(saved);
      } catch (err) {
        console.error('Background auto-save failed:', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [state.isDirty, state.map, state.user, setMap]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      // Ignore when typing in an input/textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      
      // Object nudging via Arrow Keys (10px default, 60px with Shift)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const amt = e.shiftKey ? 60 : 10;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -amt;
        else if (e.key === 'ArrowDown') dy = amt;
        else if (e.key === 'ArrowLeft') dx = -amt;
        else if (e.key === 'ArrowRight') dx = amt;
        
        engineRef.current?.nudgeSelected(dx, dy);
        return;
      }

      // Ctrl Key shortcuts (Undo/Redo, Copy/Paste)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toUpperCase();
        if (key === 'Z') {
          e.preventDefault();
          engineRef.current?.undo();
        } else if (key === 'Y') {
          e.preventDefault();
          engineRef.current?.redo();
        } else if (key === 'C') {
          e.preventDefault();
          engineRef.current?.copySelected();
        } else if (key === 'V') {
          e.preventDefault();
          engineRef.current?.pasteSelected();
        }
        return;
      }

      switch (e.key.toUpperCase()) {
        // Tool selection (standard design-tool keys)
        case 'V': setActiveTool('select'); break;
        case 'H': setActiveTool('pan'); break;
        case 'T': setActiveTool('text'); break;

        // Canvas actions
        case 'DELETE':
        case 'BACKSPACE':
          engineRef.current?.deleteSelected(); break;
        case 'R':
          if (e.shiftKey) {
            engineRef.current?.rotateSelected(-90);
          } else {
            engineRef.current?.rotateSelected(90);
          }
          break;

        // Toggles
        case 'G': toggleGrid(); break;
        case 'S': toggleSnap(); break;  // S = Snap only

        // Zoom
        case '+':
        case '=':
          if (engineRef.current?.fabricRef.current) {
            const fc = engineRef.current.fabricRef.current;
            const z = Math.min(fc.getZoom() * 1.2, 5);
            fc.setZoom(z); setZoom(z); fc.requestRenderAll();
          }
          break;
        case '-':
          if (engineRef.current?.fabricRef.current) {
            const fc = engineRef.current.fabricRef.current;
            const z = Math.max(fc.getZoom() / 1.2, 0.1);
            fc.setZoom(z); setZoom(z); fc.requestRenderAll();
          }
          break;
        default: break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveTool, setZoom, toggleGrid, toggleSnap, setSnap]);

  const handleSelectionChange = useCallback((objects) => {
    setSelectedObjects(objects ?? []);
  }, []);

  const handleObjectModified = useCallback(() => {
    // Force re-render of props panel
    setSelectedObjects(prev => [...prev]);
  }, []);

  // Add text object to canvas
  const handleAddText = useCallback((x = 400, y = 300) => {
    const fc = engineRef.current?.fabricRef.current;
    if (!fc) return;
    import('fabric').then(({ IText }) => {
      const text = new IText('Text', {
        left: x, top: y,
        originX: 'center',
        originY: 'center',
        fontSize: 24,
        fill: '#333333',
        fontFamily: 'Inter, sans-serif',
        selectable: true,
        hasControls: true,
        _allowOverlap: true,
        _snapToGrid: false,
        _tileId: null,
      });
      fc.add(text);
      fc.setActiveObject(text);
      text.enterEditing();
      fc.requestRenderAll();
      actions.setDirty(true);
      actions.setActiveTool('select');
    });
  }, [actions]);

  return (
    <div className="app-layout">
      <Header engine={engineRef} />

      <aside className="app-sidebar">
        <TileBrowser />
      </aside>

      <main className="app-canvas-area">
        <CanvasEditor
          engineRef={engineRef}
          onSelectionChange={handleSelectionChange}
          onObjectModified={handleObjectModified}
          onAddText={handleAddText}
        />
      </main>

      <aside className="app-props">
        <PropertiesPanel selectedObjects={selectedObjects} engine={engineRef} />
      </aside>

      <Toolbar engine={engineRef} onAddText={handleAddText} />

      {/* Dialogs */}
      <NewMapDialog />
      <LoadMapDialog />
      <CloudSyncDialog />
      <AboutDialog />
      <ExportDialog engine={engineRef} />
    </div>
  );
}

// ── Root App with Provider ────────────────────────────────────────────────────
export default function App() {
  return (
    <MapStoreProvider>
      <InnerApp />
    </MapStoreProvider>
  );
}
