/**
 * PropertiesPanel — shows and edits properties of the selected object.
 */
import { useState, useEffect } from 'react';

export default function PropertiesPanel({ selectedObjects, engine }) {
  const [props, setProps] = useState(null);

  useEffect(() => {
    if (!engine?.current || !selectedObjects?.length) {
      setProps(null);
      return;
    }
    setProps(engine.current.getSelectedProps());
  }, [selectedObjects, engine]);

  function handleChange(key, value) {
    engine.current?.updateSelectedProp(key, value);
    setProps(prev => prev ? { ...prev, [key]: value } : prev);
  }

  if (!props) {
    return (
      <div className="props-empty">
        <div className="props-empty-icon">⬛</div>
        <div style={{ fontSize: 11 }}>Select an object on the canvas to edit its properties</div>
      </div>
    );
  }

  const rotations = [0, 90, 180, 270];

  return (
    <div className="props-panel">
      {/* Tile info */}
      {props.tileId && (
        <div className="panel-section">
          <div className="panel-section-title">Tile</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', wordBreak: 'break-all', lineHeight: 1.4 }}>
            {props.tileId}
          </div>
          {props.isSymbol && (
            <div style={{ marginTop: 6, display: 'inline-block', fontSize: 9, padding: '2px 6px', background: 'var(--color-symbol-badge)', color: '#000', borderRadius: 3, fontWeight: 700 }}>
              SYMBOL
            </div>
          )}
        </div>
      )}

      {/* Position */}
      <div className="panel-section">
        <div className="panel-section-title">Position</div>
        <div className="prop-row" style={{ marginBottom: 6 }}>
          <label className="prop-label">X</label>
          <input
            className="prop-input"
            type="number"
            value={props.x ?? ''}
            onChange={e => handleChange('x', e.target.value)}
          />
        </div>
        <div className="prop-row">
          <label className="prop-label">Y</label>
          <input
            className="prop-input"
            type="number"
            value={props.y ?? ''}
            onChange={e => handleChange('y', e.target.value)}
          />
        </div>
      </div>

      {/* Rotation */}
      <div className="panel-section">
        <div className="panel-section-title">Rotation</div>
        <div className="rotation-buttons">
          {rotations.map(r => (
            <button
              key={r}
              className={`rotation-btn ${Math.round(props.rotation) === r ? 'active' : ''}`}
              onClick={() => handleChange('rotation', r)}
              title={`${r}°`}
            >
              {r}°
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} onClick={() => engine.current?.rotateSelected(-90)}>↺ −90°</button>
          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} onClick={() => engine.current?.rotateSelected(90)}>↻ +90°</button>
        </div>
      </div>

      {/* Behaviour */}
      <div className="panel-section">
        <div className="panel-section-title">Behaviour</div>
        <div className="prop-row" style={{ marginBottom: 8 }}>
          <label className="prop-label">Snap to grid</label>
          <label className="toggle-switch">
            <input type="checkbox" checked={props.snapToGrid} onChange={e => handleChange('snapToGrid', e.target.checked)} />
            <span className="toggle-track" />
          </label>
        </div>
        <div className="prop-row" style={{ marginBottom: 8 }}>
          <label className="prop-label">Allow overlap</label>
          <label className="toggle-switch">
            <input type="checkbox" checked={props.allowOverlap} onChange={e => handleChange('allowOverlap', e.target.checked)} />
            <span className="toggle-track" />
          </label>
        </div>
        {props.type !== 'i-text' && (
          <div className="prop-row">
            <label className="prop-label">Transparent</label>
            <label className="toggle-switch">
              <input type="checkbox" checked={props.isTransparent} onChange={e => handleChange('isTransparent', e.target.checked)} />
              <span className="toggle-track" />
            </label>
          </div>
        )}
      </div>

      {/* Text properties */}
      {props.type === 'i-text' && (
        <div className="panel-section">
          <div className="panel-section-title">Text</div>
          <div className="prop-row" style={{ marginBottom: 8 }}>
            <label className="prop-label">Font size</label>
            <input
              className="prop-input"
              type="number"
              value={props.fontSize ?? 24}
              onChange={e => handleChange('fontSize', Number(e.target.value))}
            />
          </div>
          <div className="prop-row">
            <label className="prop-label">Text Color</label>
            <input
              type="color"
              value={props.fill || '#333333'}
              onChange={e => handleChange('fill', e.target.value)}
              style={{
                width: 48,
                height: 22,
                border: '1px solid var(--color-border)',
                background: 'none',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                padding: 0,
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="panel-section">
        <button
          className="btn btn-danger"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => engine.current?.deleteSelected()}
        >
          🗑 Delete
        </button>
      </div>
    </div>
  );
}
