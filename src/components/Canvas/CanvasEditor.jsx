/**
 * CanvasEditor — Fabric.js canvas wrapper with drop support.
 */
import { useRef, useState, useCallback } from 'react';
import { useMapStore } from '../../store/mapStore';
import { useCanvasEngine } from './useCanvasEngine';

export default function CanvasEditor({ onSelectionChange, onObjectModified, engineRef, onAddText }) {
  const { state, actions } = useMapStore();
  const { map, activeTool, snapToGrid } = state;
  const canvasRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const engine = useCanvasEngine({
    canvasRef,
    map,
    activeTool,
    snapToGridEnabled: snapToGrid,
    onZoomChange: actions.setZoom,
    onSelectionChange: (ids, objects) => {
      actions.setSelected(ids);
      onSelectionChange?.(objects);
    },
    onObjectModified: (obj) => {
      actions.setDirty(true);
      onObjectModified?.(obj);
    },
    onAddText,
  });

  if (engineRef) engineRef.current = engine;

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const tileData = e.dataTransfer.getData('application/geomorphforge-tile');
    if (!tileData) return;
    let tile;
    try { tile = JSON.parse(tileData); } catch { return; }
    const rect = e.currentTarget.getBoundingClientRect();
    await engine.placeTile(tile, e.clientX - rect.left, e.clientY - rect.top);
    actions.setDirty(true);
  }, [engine, actions]);

  return (
    <div
      className={`canvas-container ${isDragOver ? 'canvas-drop-target' : ''}`}
      style={{ backgroundColor: map.backgroundColor }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} />

      <div className="zoom-indicator">{Math.round(state.zoom * 100)}%</div>

      {map.objects?.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          color: 'var(--color-text-muted)', gap: 12, zIndex: 2,
        }}>
          <div style={{ fontSize: 48, opacity: 0.2 }}>⬛</div>
          <div style={{ fontSize: 13, opacity: 0.5 }}>Drag tiles from the browser panel to begin</div>
          <div style={{ fontSize: 11, opacity: 0.35 }}>Scroll to zoom · Alt+drag or middle-click to pan</div>
        </div>
      )}
    </div>
  );
}
