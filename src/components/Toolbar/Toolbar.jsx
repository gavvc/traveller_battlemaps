/**
 * Toolbar — bottom tool bar with tool selection, zoom, grid, snap controls.
 */
import { useMapStore } from '../../store/mapStore';

const TOOLS = [
  { id: 'select', icon: '⬛', label: 'Select', key: 'V' },
  { id: 'pan',    icon: '✋', label: 'Pan',    key: 'H' },
  { id: 'text',   icon: '𝐓',  label: 'Text',   key: 'T' },
];

export default function Toolbar({ engine, onAddText }) {
  const { state, actions } = useMapStore();
  const { activeTool, snapToGrid, map, zoom } = state;

  function zoomIn() {
    if (!engine?.current?.fabricRef.current) return;
    const fc = engine.current.fabricRef.current;
    const z = Math.min(fc.getZoom() * 1.2, 5);
    fc.setZoom(z);
    actions.setZoom(z);
    fc.requestRenderAll();
  }
  function zoomOut() {
    if (!engine?.current?.fabricRef.current) return;
    const fc = engine.current.fabricRef.current;
    const z = Math.max(fc.getZoom() / 1.2, 0.1);
    fc.setZoom(z);
    actions.setZoom(z);
    fc.requestRenderAll();
  }
  function zoomReset() {
    if (!engine?.current?.fabricRef.current) return;
    const fc = engine.current.fabricRef.current;
    fc.setZoom(1);
    fc.setViewportTransform([1,0,0,1,0,0]);
    actions.setZoom(1);
    fc.requestRenderAll();
  }

  function handleDelete() {
    engine?.current?.deleteSelected();
  }
  function handleRotate(deg) {
    engine?.current?.rotateSelected(deg);
  }

  return (
    <div className="app-toolbar">
      {/* Tool selection */}
      <div className="toolbar-group">
        <span className="toolbar-label">Tool</span>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            className={`btn btn-icon ${activeTool === tool.id ? 'btn-active' : 'btn-ghost'}`}
            data-tip={`${tool.label} (${tool.key})`}
            onClick={() => {
              actions.setActiveTool(tool.id);
            }}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      {/* Rotation */}
      <div className="toolbar-group">
        <span className="toolbar-label">Rotate</span>
        <button className="btn btn-ghost" data-tip="Rotate −90°" onClick={() => handleRotate(-90)}>↺</button>
        <button className="btn btn-ghost" data-tip="Rotate +90°" onClick={() => handleRotate(90)}>↻</button>
      </div>

      <div className="toolbar-divider" />

      {/* Delete */}
      <button className="btn btn-ghost" data-tip="Delete selected (Del)" onClick={handleDelete}>🗑</button>

      <div className="toolbar-divider" />

      {/* Grid */}
      <div className="toolbar-group">
        <span className="toolbar-label">Grid</span>
        <button
          className={`btn ${map.showGrid ? 'btn-active' : 'btn-ghost'}`}
          data-tip={`${map.showGrid ? 'Hide' : 'Show'} grid (G)`}
          onClick={actions.toggleGrid}
        >
          ⊞
        </button>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 2 }}>
          {map.gridType === 'hex' ? 'Hex' : 'Square'}
        </span>
      </div>

      {/* Snap */}
      <div className="toolbar-group">
        <span className="toolbar-label">Snap</span>
        <button
          className={`btn ${snapToGrid ? 'btn-active' : 'btn-ghost'}`}
          data-tip="Toggle snap to grid (S)"
          onClick={actions.toggleSnap}
        >
          🧲
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Zoom */}
      <div className="toolbar-group">
        <span className="toolbar-label">Zoom</span>
        <button className="btn btn-ghost btn-icon" data-tip="Zoom out (−)" onClick={zoomOut}>−</button>
        <button
          className="btn btn-ghost"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 48 }}
          data-tip="Reset zoom"
          onClick={zoomReset}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button className="btn btn-ghost btn-icon" data-tip="Zoom in (+)" onClick={zoomIn}>+</button>
      </div>

      <div className="toolbar-divider" />

      {/* Export */}
      <div className="toolbar-group">
        <button className="btn btn-ghost" data-tip="Export PNG (without grid)" onClick={() => engine?.current?.exportToPNG(false)}>
          📷 Export
        </button>
        <button className="btn btn-ghost" data-tip="Export PNG (with grid)" onClick={() => engine?.current?.exportToPNG(true)}>
          +Grid
        </button>
      </div>

      {/* Status */}
      <div className="status-info">
        {map.name} {state.isDirty ? '●' : ''}
      </div>
    </div>
  );
}
