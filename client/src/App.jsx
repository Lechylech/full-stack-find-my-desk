import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { api } from './api.js';
import BookingPage from './pages/BookingPage.jsx';
import ManagePage from './pages/ManagePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SentientPage from './pages/sentient/SentientPage.jsx';

export default function App() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);

  const refreshMe = useCallback(async () => {
    try {
      const m = await api.getMe();
      setMe(m);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [m, u] = await Promise.all([api.getMe(), api.listUsers()]);
        setMe(m);
        setUsers(u);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  async function changeUser(id) {
    try {
      const m = await api.setMe(id);
      setMe(m);
      localStorage.setItem('fmd:userId', id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function togglePrivacy(value) {
    if (!me) return;
    try {
      await api.setPrivacy(me.id, value);
      await refreshMe();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="app">
      <Header me={me} users={users} onChangeUser={changeUser} onTogglePrivacy={togglePrivacy} />
      {error && <div className="error" style={{ padding: '8px 20px' }}>Error: {error}</div>}
      <Routes>
        <Route path="/" element={me ? <BookingPage me={me} /> : <Loading />} />
        <Route
          path="/manage"
          element={
            !me ? <Loading />
              : me.admin ? <ManagePage me={me} />
              : <AccessDenied />
          }
        />
        <Route path="/profile" element={me ? <ProfilePage me={me} onSaved={refreshMe} /> : <Loading />} />
        <Route path="/sentient" element={<SentientPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function Loading() {
  return <div className="main"><div className="panel">Loading…</div></div>;
}

function AccessDenied() {
  return (
    <div className="main"><div className="panel" style={{ maxWidth: 520 }}>
      <h2>Admins only</h2>
      <p style={{ color: 'var(--muted)', marginTop: 4 }}>
        This view is restricted to admin users. Switch to an admin account from the top-right user dropdown to access it.
      </p>
    </div></div>
  );
}

function Header({ me, users, onChangeUser, onTogglePrivacy }) {
  const location = useLocation();
  return (
    <header className="header">
      <div className="brand">
        <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="spacio-grad" x1="14" y1="0" x2="14" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1a9fff"/>
              <stop offset="100%" stopColor="#00e5cc"/>
            </linearGradient>
          </defs>
          <path d="M21 6C21 6 7 6 7 12C7 16 11 17.5 14 17.5C17 17.5 21 19 21 24C21 28 14 26 7 26"
                stroke="url(#spacio-grad)" strokeWidth="7" strokeLinecap="round" fill="none"/>
        </svg>
        <div>
          <span className="brand-name">Spacio</span>
          <span className="brand-tagline">Book Space Smarter</span>
        </div>
      </div>
      <nav>
        <NavLink to="/" className={location.pathname === '/' ? 'active' : ''}>Book</NavLink>
        <NavLink to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profile</NavLink>
        {me?.admin && (
          <NavLink to="/manage" className={location.pathname === '/manage' ? 'active' : ''}>Manage</NavLink>
        )}
        <NavLink to="/sentient" className={location.pathname === '/sentient' ? 'active sentient-link' : 'sentient-link'}>Sentient ✦</NavLink>
      </nav>
      <div className="spacer" />
      {me && (
        <label className="privacy-toggle">
          <input
            type="checkbox"
            checked={!!me.privacy}
            onChange={(e) => onTogglePrivacy(e.target.checked)}
          />
          Hide my bookings
        </label>
      )}
      <div className="user-switcher">
        <span style={{ color: 'var(--muted)' }}>You are:</span>
        <select value={me?.id || ''} onChange={(e) => onChangeUser(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}{u.admin ? ' (admin)' : ''} — {u.team}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
