/**
 * NewMapDialog — modal to create a new map with name and grid type selection.
 */
import { useState } from 'react';
import { useMapStore } from '../../store/mapStore';
import { GRID_DEFAULTS } from '../../store/mapStore';

export default function NewMapDialog() {
  const { state, actions } = useMapStore();
  const [name, setName] = useState('Untitled Map');
  const [gridType, setGridType] = useState('square');

  if (!state.showNewMapDialog) return null;

  function handleCreate() {
    const defaults = GRID_DEFAULTS[gridType] || GRID_DEFAULTS.square;
    actions.newMap({
      name,
      gridType,
      ...defaults,
    });
  }

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) actions.hideNewMapDialog(); }}>
      <div className="dialog">
        <h2 className="dialog-title">New Map</h2>

        {/* Map Name */}
        <div className="form-field">
          <label className="form-label">Map Name</label>
          <input
            className="form-input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>

        {/* Grid Type */}
        <div className="form-field">
          <label className="form-label">Grid Type</label>
          <div className="grid-type-selector">
            <div
              className={`grid-type-option ${gridType === 'square' ? 'selected' : ''}`}
              onClick={() => setGridType('square')}
            >
              <div className="grid-type-icon">⬜</div>
              <div className="grid-type-label">Square</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>60px / 5ft</div>
            </div>
            <div
              className={`grid-type-option ${gridType === 'hex' ? 'selected' : ''}`}
              onClick={() => setGridType('hex')}
            >
              <div className="grid-type-icon">⬡</div>
              <div className="grid-type-label">Hex</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>36px / 1yd</div>
            </div>
          </div>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={actions.hideNewMapDialog}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={!name.trim()}>
            Create Map
          </button>
        </div>
      </div>
    </div>
  );
}
