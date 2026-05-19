/**
 * TileBrowser — left panel showing searchable, filterable tile library
 */
import { useState, useCallback, useRef } from 'react';
import {
  useTileManifest,
  filterTiles,
  buildTileTree,
  useCollectionList,
  useRoomList,
  useDtonBands,
} from '../../hooks/useTileManifest';
import TilePreviewPopover from './TilePreviewPopover';

// ── Tile Card ─────────────────────────────────────────────────────────────────
function TileCard({ tile, onDragStart, onHover }) {
  const [imgError, setImgError] = useState(false);
  const cardRef = useRef(null);
  const badge = tile.isOverlay ? 'overlay' : tile.isSymbol ? 'symbol' : tile.isMirror ? 'mirror' : null;
  const badgeText = tile.isOverlay ? 'OV' : tile.isSymbol ? 'SY' : tile.isMirror ? 'MR' : null;

  function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/geomorphforge-tile', JSON.stringify(tile));
    onDragStart?.(tile);
  }

  return (
    <div
      ref={cardRef}
      className={`tile-card${tile.isSymbol ? ' is-symbol' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => onHover?.(tile, cardRef.current)}
      onMouseLeave={() => onHover?.(null, null)}
      title={tile.name}
    >
      {!imgError ? (
        <img
          src={`/${tile.thumbnail}`}
          alt={tile.name}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <span style={{ fontSize: 22, opacity: 0.3 }}>⬛</span>
      )}
      {badge && <span className={`tile-card-badge ${badge}`}>{badgeText}</span>}
      <span className="tile-card-label">{tile.name}</span>
    </div>
  );
}

// ── Category Group ────────────────────────────────────────────────────────────
function CategoryGroup({ category, tiles, onDragStart, onHover }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tile-category-group">
      <div className="tile-category-header" onClick={() => setOpen(o => !o)}>
        <span className="tile-collection-chevron" style={{ fontSize: 9, marginRight: 2 }}>
          {open ? '▾' : '▸'}
        </span>
        {category}
        <span className="tile-category-count tile-collection-count">{tiles.length}</span>
      </div>
      {open && (
        <div className="tile-thumb-grid">
          {tiles.map(tile => (
            <TileCard key={tile.id} tile={tile} onDragStart={onDragStart} onHover={onHover} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Collection Group ──────────────────────────────────────────────────────────
function CollectionGroup({ collection, categories, onDragStart, onHover }) {
  const [open, setOpen] = useState(true);
  const totalTiles = Object.values(categories).reduce((s, arr) => s + arr.length, 0);
  return (
    <div className="tile-collection-group">
      <div className="tile-collection-header" onClick={() => setOpen(o => !o)}>
        <span className={`tile-collection-chevron ${open ? 'open' : ''}`}>▶</span>
        {collection}
        <span className="tile-collection-count">{totalTiles}</span>
      </div>
      {open && Object.entries(categories).map(([cat, tiles]) => (
        <CategoryGroup key={cat} category={cat} tiles={tiles} onDragStart={onDragStart} onHover={onHover} />
      ))}
    </div>
  );
}

// ── Flat grid for search/filter results ───────────────────────────────────────
function FlatGrid({ tiles, onDragStart, onHover }) {
  if (tiles.length === 0) return <div className="tile-empty">No tiles match your search.</div>;
  return (
    <div className="tile-thumb-grid" style={{ padding: '8px' }}>
      {tiles.slice(0, 300).map(tile => (
        <TileCard key={tile.id} tile={tile} onDragStart={onDragStart} onHover={onHover} />
      ))}
      {tiles.length > 300 && (
        <div className="tile-empty" style={{ gridColumn: '1/-1', padding: 8 }}>
          Showing first 300 of {tiles.length}. Refine your search.
        </div>
      )}
    </div>
  );
}

// ── Collapsible filter section ────────────────────────────────────────────────
function FilterSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--color-border-light)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 12px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-muted)', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}
      >
        {title}
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '2px 8px 8px' }}>{children}</div>}
    </div>
  );
}

// ── Main TileBrowser ──────────────────────────────────────────────────────────
export default function TileBrowser({ onTileDragStart }) {
  const { manifest, loading, error } = useTileManifest();
  const collections = useCollectionList(manifest);
  const rooms       = useRoomList(manifest);
  const dtonBands   = useDtonBands(manifest);

  const [searchText, setSearchText] = useState('');
  const [filters, setFilters] = useState({});
  const [hoveredTile, setHoveredTile] = useState(null);
  const [hoverAnchor, setHoverAnchor] = useState(null);

  const handleHover = useCallback((tile, el) => {
    setHoveredTile(tile);
    setHoverAnchor(el);
  }, []);

  const setFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev };
      if (next[key] === value) delete next[key]; // toggle off
      else next[key] = value;
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchText('');
    setFilters({});
  }, []);

  const activeFilterCount = Object.keys(filters).length;
  const isSearching = searchText.trim() || activeFilterCount > 0;

  const filtered = isSearching
    ? filterTiles(manifest?.tiles, { searchText, filters })
    : manifest?.tiles ?? [];

  const tree = !isSearching && manifest ? buildTileTree(manifest.tiles) : null;

  if (loading) return <div className="tile-loading"><span>Loading tiles…</span></div>;
  if (error)   return <div className="tile-empty">Failed to load manifest:<br />{error}</div>;

  const ORIENTATIONS = ['Fore', 'Aft', 'Port', 'Starboard'];

  return (
    <div className="tile-browser">

      {/* Search */}
      <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--color-border-light)' }}>
        <div className="search-input-wrap">
          <span className="search-input-icon">🔍</span>
          <input
            className="search-input"
            type="search"
            placeholder="Search tiles, rooms, dTons…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </div>
        {isSearching && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''}` : ''}
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 10, padding: '1px 7px' }} onClick={clearFilters}>
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      {/* Collapsible filter panels */}
      <div style={{ borderBottom: '1px solid var(--color-border)', overflowY: 'auto', maxHeight: 280, flexShrink: 0 }}>

        <FilterSection title="Collection" defaultOpen>
          <div className="filter-row">
            {collections.map(col => {
              const label = col.replace('AdventureClass','Advent.').replace('CustomTiles','Custom').replace('Geomorphs','Core');
              return (
                <button key={col} className={`filter-pill ${filters.collection === col ? 'active' : ''}`}
                  onClick={() => setFilter('collection', col)} title={col}>{label}</button>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title="Grid Size">
          <div className="filter-row">
            {['50x50','100x50','100x100','200x100','200x50'].map(gs => (
              <button key={gs} className={`filter-pill ${filters.gridSize === gs ? 'active' : ''}`}
                onClick={() => setFilter('gridSize', gs)}>{gs}</button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Displacement (dTons)">
          <div className="filter-row">
            {dtonBands.map(band => (
              <button key={band} className={`filter-pill ${filters.dtonBand === band ? 'active' : ''}`}
                onClick={() => setFilter('dtonBand', band)}>{band}</button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Contains Room / Function">
          <div className="filter-row" style={{ flexWrap: 'wrap' }}>
            {rooms.slice(0, 20).map(room => (
              <button key={room} className={`filter-pill ${filters.room === room ? 'active' : ''}`}
                onClick={() => setFilter('room', room)}
                style={{ textTransform: 'capitalize' }}>{room}</button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Orientation">
          <div className="filter-row">
            {ORIENTATIONS.map(o => (
              <button key={o} className={`filter-pill ${filters.orientation === o ? 'active' : ''}`}
                onClick={() => setFilter('orientation', o)}>{o}</button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Type">
          <div className="filter-row">
            <button className={`filter-pill ${filters.symbolsOnly ? 'active' : ''}`} onClick={() => setFilter('symbolsOnly', true)}>Symbols</button>
            <button className={`filter-pill ${filters.overlayOnly ? 'active' : ''}`} onClick={() => setFilter('overlayOnly', true)}>Overlays</button>
            <button className={`filter-pill ${filters.hideOverlays ? 'active' : ''}`} onClick={() => setFilter('hideOverlays', true)}>No Overlays</button>
            <button className={`filter-pill ${filters.hideMirrors ? 'active' : ''}`}  onClick={() => setFilter('hideMirrors', true)}>No Mirrors</button>
          </div>
        </FilterSection>
      </div>

      {/* Tile content */}
      <div className="tile-grid-scroll">
        {isSearching ? (
          <FlatGrid tiles={filtered} onDragStart={onTileDragStart} onHover={handleHover} />
        ) : (
          tree && Object.entries(tree).map(([col, cats]) => (
            <CollectionGroup key={col} collection={col} categories={cats} onDragStart={onTileDragStart} onHover={handleHover} />
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '5px 12px', borderTop: '1px solid var(--color-border-light)', fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {isSearching ? `${filtered.length} results` : `${manifest?.totalTiles ?? 0} tiles total`}
      </div>

      <TilePreviewPopover tile={hoveredTile} anchorEl={hoverAnchor} />
    </div>
  );
}
