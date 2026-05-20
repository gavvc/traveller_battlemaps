/**
 * AboutDialog — modal detailing credits, licensing, and Traveller trademark fair-use compliance.
 */
import { useMapStore } from '../../store/mapStore';

export default function AboutDialog() {
  const { state, actions } = useMapStore();

  if (!state.showAboutDialog) return null;

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) actions.hideAboutDialog(); }}>
      <div className="dialog" style={{ maxWidth: 500, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <h2 className="dialog-title" style={{ marginBottom: 15 }}>About & Licensing</h2>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6, fontSize: 13, lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          <p>
            <strong>GeomorphForge</strong> is an open-source, non-commercial tabletop battlemap editor designed specifically for Traveller and other classic science fiction roleplaying games.
          </p>

          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-accent)' }}>
              🎨 Asset Credits
            </h4>
            <p style={{ margin: 0 }}>
              The high-resolution deck plan geomorphs and symbols used in this application were converted, compiled, and expanded by <strong>Eric B. Smith</strong> on his website <a href="https://gurpsland.no-ip.org/geomorphs/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-accent)', textDecoration: 'underline' }}>GURPSLand Geomorphs</a>. 
            </p>
            <p style={{ margin: '6px 0 0 0' }}>
              The original vector layouts and designs were drafted and released in PDF format by <strong>Robert Pearce</strong> (creator of the legendary <em>Starship Geomorphs</em> & <em>Starship Geomorphs 2.0</em>).
            </p>
          </div>

          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-accent)' }}>
              📄 Asset License
            </h4>
            <p style={{ margin: 0 }}>
              Robert Pearce's geomorphs and Eric B. Smith's transparent PNG conversions are licensed under the <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-accent)', textDecoration: 'underline' }}>Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)</a>.
            </p>
          </div>

          <div style={{ padding: 12, background: 'var(--color-bg-hover)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-border-focus)', fontSize: 11, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            <strong style={{ display: 'block', marginBottom: 4, color: 'var(--color-text-primary)' }}>
              Far Future Enterprises Fan-Use Disclaimer
            </strong>
            The <em>Traveller</em> game in all forms is owned by Far Future Enterprises. Copyright © 1977–2026 Far Future Enterprises. <em>Traveller</em> is a registered trademark of Far Future Enterprises.
            <br /><br />
            This software is a fan-made helper application, provided strictly **free of charge** and for **personal, non-commercial use only**. It is not endorsed by, affiliated with, or sponsored by Far Future Enterprises.
          </div>

          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            <strong>GeomorphForge Development:</strong> Built with Fabric.js, React, and Firebase. All editor source code is committed to Git and hosted on GitHub under a permissive non-commercial model.
          </div>
        </div>

        <div className="dialog-actions" style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid var(--color-border)', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={actions.hideAboutDialog}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
