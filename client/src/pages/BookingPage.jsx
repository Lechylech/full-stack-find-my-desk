import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { api } from '../api.js';
import FloorPlan from '../components/FloorPlan.jsx';
import BookingModal from '../components/BookingModal.jsx';
import SuggestionsPanel from '../components/SuggestionsPanel.jsx';
import MyBookings from '../components/MyBookings.jsx';
import AutoReleaseManager from '../components/AutoReleaseManager.jsx';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingPage({ me }) {
  const [date, setDate] = useState(todayIso());
  const [floor, setFloor] = useState('ground');
  const [desks, setDesks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [positionOverrides, setPositionOverrides] = useState({});
  const [saveError, setSaveError] = useState(null);

  const refresh = useCallback(async () => {
    const [d, b, s] = await Promise.all([
      api.listDesks(date, me.id),
      api.listBookings({ date, userId: me.id }),
      api.getSuggestions(me.id, date),
    ]);
    setDesks(d);
    setBookings(b);
    setSuggestions(s);
  }, [date, me.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll lightly so other users' actions show up
  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const floorDesks = useMemo(() => desks.filter((d) => d.floor === floor), [desks, floor]);

  const myActiveBooking = bookings.find((b) => b.status === 'active');

  async function submitBooking({ deskId, startHour, endHour }) {
    setBookingError(null);
    try {
      await api.createBooking({ deskId, userId: me.id, date, startHour, endHour });
      setSelectedDesk(null);
      await refresh();
    } catch (e) {
      setBookingError(e.message);
    }
  }

  async function handleCheckIn(bookingId) {
    await api.checkIn(bookingId);
    await refresh();
  }
  async function handleRelease(bookingId) {
    await api.release(bookingId);
    await refresh();
  }
  async function handleCancel(bookingId) {
    await api.cancel(bookingId);
    await refresh();
  }

  function handleDeskMoved(id, pos) {
    setPositionOverrides((prev) => ({ ...prev, [id]: pos }));
  }

  async function savePositions() {
    setSaveError(null);
    try {
      const updates = Object.entries(positionOverrides).map(([id, pos]) => ({ id, ...pos }));
      await api.savePositions(me.id, updates);
      setPositionOverrides({});
      setEditMode(false);
      await refresh();
    } catch (e) {
      setSaveError(e.message);
    }
  }

  function cancelEdit() {
    setPositionOverrides({});
    setEditMode(false);
    setSaveError(null);
  }

  return (
    <main className="main">
      <section className="panel">
        <div className="floor-controls">
          <label>
            Date{' '}
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Floor{' '}
            <select value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="ground">Ground</option>
              <option value="first">First</option>
            </select>
          </label>
          <div className="legend">
            <span><span className="legend-dot dot-available"/>Available</span>
            <span><span className="legend-dot dot-booked"/>Booked</span>
            <span><span className="legend-dot dot-active"/>Active</span>
          </div>
          {me.admin && !editMode && (
            <button onClick={() => setEditMode(true)} style={{ marginLeft: 'auto' }}>
              Edit desk positions
            </button>
          )}
        </div>

        {editMode && (
          <div className="edit-mode-bar">
            <span>
              Drag desks to reposition.
              {Object.keys(positionOverrides).length > 0 && (
                <strong> {Object.keys(positionOverrides).length} desk{Object.keys(positionOverrides).length > 1 ? 's' : ''} moved.</strong>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saveError && <span className="error">{saveError}</span>}
              <button onClick={cancelEdit}>Cancel</button>
              <button
                className="primary"
                onClick={savePositions}
                disabled={Object.keys(positionOverrides).length === 0}
              >
                Save positions
              </button>
            </div>
          </div>
        )}

        <FloorPlan
          floor={floor}
          desks={floorDesks}
          onPick={(desk) => {
            if (editMode || desk.state !== 'available') return;
            setSelectedDesk(desk);
            setBookingError(null);
          }}
          selectedId={selectedDesk?.id}
          editMode={editMode}
          positionOverrides={positionOverrides}
          onDeskMoved={handleDeskMoved}
        />
      </section>

      <aside>
        <SuggestionsPanel
          suggestions={suggestions}
          onPick={(desk) => {
            setSelectedDesk(desk);
            setFloor(desk.floor);
            setBookingError(null);
          }}
        />
        <MyBookings
          bookings={bookings}
          desks={desks}
          onCheckIn={handleCheckIn}
          onRelease={handleRelease}
          onCancel={handleCancel}
        />
      </aside>

      {selectedDesk && (
        <BookingModal
          desk={selectedDesk}
          date={date}
          onClose={() => setSelectedDesk(null)}
          onSubmit={submitBooking}
          error={bookingError}
        />
      )}

      <AutoReleaseManager
        booking={myActiveBooking}
        onRelease={handleRelease}
      />
    </main>
  );
}
