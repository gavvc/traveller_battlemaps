/**
 * LoadMapDialog — modal displaying saved maps from localStorage to load or delete.
 */
import { useEffect, useState, useCallback } from 'react';
import { useMapStore } from '../../store/mapStore';
import { getSavedMaps, deleteMapFromStorage } from '../../utils/storage';
import { fetchCloudMaps, deleteCloudMap } from '../../utils/firebase';

export default function LoadMapDialog() {
  const { state, actions } = useMapStore();
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadMaps = useCallback(async () => {
    // 1. Fetch local maps
    const localMaps = getSavedMaps();
    setMaps(localMaps);

    // 2. Fetch cloud maps if logged in and merge them
    if (state.user) {
      setLoading(true);
      try {
        const cloudMaps = await fetchCloudMaps(state.user.uid);
        
        // Merge cloud maps into the list
        const merged = [...localMaps];
        cloudMaps.forEach(cm => {
          const index = merged.findIndex(lm => lm.id === cm.id);
          if (index >= 0) {
            // Document exists in both. Use the latest one.
            const localTime = new Date(merged[index].updatedAt || 0).getTime();
            const cloudTime = new Date(cm.updatedAt || 0).getTime();
            if (cloudTime > localTime) {
              merged[index] = {
                ...merged[index],
                ...cm,
                isCloudSynced: true,
              };
            } else {
              merged[index].isCloudSynced = true;
            }
          } else {
            // Strictly cloud map
            merged.push({
              ...cm,
              isCloudSynced: true,
            });
          }
        });

        // Sort by updatedAt descending
        merged.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        setMaps(merged);
      } catch (err) {
        console.error('Failed to load cloud maps:', err);
      } finally {
        setLoading(false);
      }
    }
  }, [state.user]);

  useEffect(() => {
    if (state.showLoadDialog) {
      loadMaps();
    }
  }, [state.showLoadDialog, loadMaps]);

  if (!state.showLoadDialog) return null;

  function handleLoad(map) {
    actions.setMap(map);
    actions.hideLoadDialog();
  }

  async function handleDelete(e, id) {
    e.stopPropagation(); // Avoid triggering map load
    if (confirm('Are you sure you want to delete this map? This action cannot be undone.')) {
      // 1. Delete from local storage
      deleteMapFromStorage(id);

      // 2. Delete from cloud if logged in
      if (state.user) {
        setLoading(true);
        try {
          await deleteCloudMap(id);
        } catch (err) {
          console.error('Failed to delete map from cloud:', err);
        } finally {
          setLoading(false);
        }
      }

      loadMaps();
    }
  }

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) actions.hideLoadDialog(); }}>
      <div className="dialog" style={{ maxWidth: 540, width: '100%' }}>
        <h2 className="dialog-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Load Map</span>
          {loading && <span style={{ fontSize: 11, color: 'var(--color-accent-primary)' }}>Loading cloud saves...</span>}
        </h2>

        <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
          {maps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
              No saved maps found. Create a map and save it first!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {maps.map(m => (
                <div
                  key={m.id}
                  onClick={() => handleLoad(m)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  className="saved-map-row"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {m.name}
                      </span>
                      {m.isCloudSynced ? (
                        <span style={{
                          fontSize: 9,
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(56, 189, 248, 0.2)'
                        }}>
                          ☁️ Synced
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 9,
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--color-text-muted)',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border-light)'
                        }}>
                          💻 Local
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      {m.gridType === 'hex' ? '⬡ Hex Grid' : '⬜ Square Grid'} · Updated {new Date(m.updatedAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={e => handleDelete(e, m.id)}
                    title="Delete Map"
                    style={{ padding: 4 }}
                    disabled={loading}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={actions.hideLoadDialog}>Close</button>
        </div>
      </div>
    </div>
  );
}
