/**
 * CloudSyncDialog — modal panel to handle user Sign In or Sign Up for optional cloud backup synchronization.
 */
import { useState } from 'react';
import { useMapStore } from '../../store/mapStore';
import { loginUser, registerUser } from '../../utils/firebase';

export default function CloudSyncDialog() {
  const { state, actions } = useMapStore();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state.showCloudSyncDialog) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (tab === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        const credential = await loginUser(email, password);
        actions.setUser({ uid: credential.user.uid, email: credential.user.email });
        actions.hideCloudSyncDialog();
      } else {
        const credential = await registerUser(email, password);
        actions.setUser({ uid: credential.user.uid, email: credential.user.email });
        actions.hideCloudSyncDialog();
        alert('Welcome! Optional Cloud Sync is now active. Your saves will be backed up in Firestore.');
      }
    } catch (err) {
      console.error('Authentication Error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) actions.hideCloudSyncDialog(); }}>
      <div className="dialog" style={{ maxWidth: 400, width: '100%' }}>
        <h2 className="dialog-title" style={{ textAlign: 'center', marginBottom: 4 }}>
          ☁️ Cloud Sync Backup
        </h2>
        <p style={{
          fontSize: 11,
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          lineHeight: '1.4',
          marginBottom: 16,
          padding: '0 var(--sp-2)'
        }}>
          Activate cloud sync to automatically back up your custom Traveller battlemaps to secure cloud storage! Access your maps from any browser.
        </p>

        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border-light)',
          marginBottom: 16,
        }}>
          <button
            className={`btn`}
            style={{
              flex: 1,
              borderRadius: 0,
              background: 'none',
              border: 'none',
              borderBottom: tab === 'login' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              color: tab === 'login' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontWeight: tab === 'login' ? 'bold' : 'normal',
              padding: '10px 0',
              cursor: 'pointer',
            }}
            onClick={() => { setTab('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            className={`btn`}
            style={{
              flex: 1,
              borderRadius: 0,
              background: 'none',
              border: 'none',
              borderBottom: tab === 'signup' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              color: tab === 'signup' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              fontWeight: tab === 'signup' ? 'bold' : 'normal',
              padding: '10px 0',
              cursor: 'pointer',
            }}
            onClick={() => { setTab('signup'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontSize: 12,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 12,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Email input */}
          <div className="form-field">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              placeholder="e.g. scout@imperium.org"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Password input */}
          <div className="form-field">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {/* Confirm Password (only for signup) */}
          {tab === 'signup' && (
            <div className="form-field">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="dialog-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={actions.hideCloudSyncDialog}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ minWidth: 100, justifyContent: 'center' }}
            >
              {loading ? 'Processing...' : tab === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
