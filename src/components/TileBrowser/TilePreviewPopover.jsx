/**
 * TilePreviewPopover — floating large preview shown on tile hover.
 * Renders into a portal so it escapes the sidebar's overflow:hidden.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const PREVIEW_WIDTH = 320;
const OFFSET_X = 10;

export default function TilePreviewPopover({ tile, anchorEl }) {
  const [style, setStyle] = useState({ opacity: 0, pointerEvents: 'none' });
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!tile || !anchorEl) {
      setStyle({ opacity: 0, pointerEvents: 'none' });
      return;
    }

    const rect = anchorEl.getBoundingClientRect();
    const winH = window.innerHeight;

    // Position: to the right of the sidebar, vertically centred on the anchor
    const left = rect.right + OFFSET_X;
    let top = rect.top + rect.height / 2;

    // Keep within viewport vertically
    const popH = 320; // estimated popover height for viewport clamping
    top = Math.max(8, Math.min(top - popH / 2, winH - popH - 8));

    setStyle({ left, top, opacity: 1, pointerEvents: 'none' });
  }, [tile, anchorEl]);

  if (!tile) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        ...style,
        width: PREVIEW_WIDTH,
        zIndex: 9999,
        background: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border-focus)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(59,130,246,0.15)',
        overflow: 'hidden',
        transition: 'opacity 120ms ease',
      }}
    >
      {/* Image — full-res, natural aspect ratio, slight gutter crop */}
      <div style={{
        width: '100%',
        overflow: 'hidden',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <img
          src={`/${tile.path}`}
          alt={tile.name}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            // Crop ~10% each side — removes most of the transparent gutter
            // while leaving a few pixels of white breathing room.
            // Symbols have no gutter so skip the crop.
            ...(tile.isSymbol ? {} : {
              width: '120%',
              marginLeft: '-10%',
              marginRight: '-10%',
            }),
          }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {tile.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          {tile.collection} › {tile.category}
        </div>

        {/* Primary flags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tile.gridSize && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'var(--color-bg-active)', color: 'var(--color-text-accent)', fontFamily: 'var(--font-mono)' }}>
              {tile.gridSize[0]}×{tile.gridSize[1]} sq
            </span>
          )}
          {tile.dtonsRaw && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {tile.dtonsRaw} dT
            </span>
          )}
          {tile.orientation && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
              {tile.orientation}
            </span>
          )}
          {tile.isOverlay && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(234,88,12,0.2)', color: '#fb923c' }}>Overlay</span>}
          {tile.isMirror  && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(15,118,110,0.2)', color: '#2dd4bf' }}>Mirror</span>}
          {tile.isSymbol  && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>Symbol</span>}
        </div>

        {/* Room tags */}
        {tile.rooms?.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {tile.rooms.map(r => (
              <span key={r} style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 3,
                background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)',
                textTransform: 'capitalize', border: '1px solid rgba(255,255,255,0.1)',
              }}>{r}</span>
            ))}
          </div>
        )}

        {tile.tileNumber && (
          <div style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
            #{tile.tileNumber}{tile.seriesCode ? ` · ${tile.seriesCode}` : ''}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
