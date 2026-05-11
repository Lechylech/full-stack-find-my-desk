import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { api } from './api.js';
import BookingPage from './pages/BookingPage.jsx';
import ManagePage from './pages/ManagePage.jsx';

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
        <Route path="/" element={me ? <BookingPage me={me} /> : <div className="main"><div className="panel">Loading…</div></div>} />
        <Route path="/manage" element={me ? <ManagePage me={me} /> : <div className="main"><div className="panel">Loading…</div></div>} />
      </Routes>
    </div>
  );
}

function Header({ me, users, onChangeUser, onTogglePrivacy }) {
  const location = useLocation();
  return (
    <header className="header">
      <h1>Find My Desk</h1>
      <nav>
        <NavLink to="/" className={location.pathname === '/' ? 'active' : ''}>Book</NavLink>
        <NavLink to="/manage" className={location.pathname === '/manage' ? 'active' : ''}>Manage</NavLink>
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
