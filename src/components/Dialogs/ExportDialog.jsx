/**
 * ExportDialog — modal allowing selection of export formats (PNG with/without grid, or JSON).
 */
import { useMapStore } from '../../store/mapStore';

export default function ExportDialog({ engine }) {
  const { state, actions } = useMapStore();

  if (!state.showExportDialog) return null;

  function exportPNG(withGrid) {
    if (!engine?.current) return;
    engine.current.exportToPNG(withGrid);
    actions.hideExportDialog();
  }

  function exportJSON() {
    if (!engine?.current) return;
    const objects = engine.current.getObjectsJSON();
    const exportData = {
      ...state.map,
      objects,
    };
    
    // Trigger download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${state.map.name || 'map'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    actions.hideExportDialog();
  }

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) actions.hideExportDialog(); }}>
      <div className="dialog" style={{ maxWidth: 440, width: '100%' }}>
        <h2 className="dialog-title">Export Map</h2>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
          Choose your export format below.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* PNG Without Grid */}
          <div
            className="grid-type-option"
            style={{ flexDirection: 'row', gap: 16, padding: '12px 16px', textAlign: 'left', alignItems: 'center' }}
            onClick={() => exportPNG(false)}
          >
            <div style={{ fontSize: 24 }}>📷</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>PNG Image (No Grid)</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>High-quality map image perfect for VTTs without grid overlay.</div>
            </div>
          </div>

          {/* PNG With Grid */}
          <div
            className="grid-type-option"
            style={{ flexDirection: 'row', gap: 16, padding: '12px 16px', textAlign: 'left', alignItems: 'center' }}
            onClick={() => exportPNG(true)}
          >
            <div style={{ fontSize: 24 }}>⊞</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>PNG Image (With Grid)</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>High-quality map image with the grid overlay rendered on top.</div>
            </div>
          </div>

          {/* JSON File */}
          <div
            className="grid-type-option"
            style={{ flexDirection: 'row', gap: 16, padding: '12px 16px', textAlign: 'left', alignItems: 'center' }}
            onClick={exportJSON}
          >
            <div style={{ fontSize: 24 }}>⚙️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>JSON Layout File</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Backup configuration file to re-import and edit later in GeomorphForge.</div>
            </div>
          </div>
        </div>

        <div className="dialog-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={actions.hideExportDialog}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
