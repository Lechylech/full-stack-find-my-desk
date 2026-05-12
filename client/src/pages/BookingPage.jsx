import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../api.js';
import FloorPlan from '../components/FloorPlan.jsx';
import BookingModal from '../components/BookingModal.jsx';
import SuggestionsPanel from '../components/SuggestionsPanel.jsx';
import MyBookings from '../components/MyBookings.jsx';
import AutoReleaseManager from '../components/AutoReleaseManager.jsx';
import DeskTable from '../components/DeskTable.jsx';
import MeetingRoomsPanel from '../components/MeetingRoomsPanel.jsx';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const MAX_ADVANCE_DAYS = 14;

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookingPage({ me }) {
  const [date, setDate] = useState(todayIso());
  const [floor, setFloor] = useState('ground');
  const [view, setView] = useState('map');
  const [desks, setDesks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [hotDeskFallback, setHotDeskFallback] = useState([]);
  const [highlightTeam, setHighlightTeam] = useState(false);
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
    if (Array.isArray(s)) {
      // Backwards-compat: older server returned a plain array.
      setSuggestions(s);
      setHotDeskFallback([]);
    } else {
      setSuggestions(s.suggestions || []);
      setHotDeskFallback(s.hotDeskFallback || []);
    }
  }, [date, me.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll lightly so other users' actions show up
  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const floorDesks = useMemo(() => desks.filter((d) => d.floor === floor), [desks, floor]);

  const myActiveBooking = bookings.find((b) => b.status === 'active');

  async function submitBooking({ deskId, startHour, endHour, userId }) {
    setBookingError(null);
    try {
      await api.createBooking({
        deskId,
        userId: userId || me.id,
        actorId: me.id,
        date, startHour, endHour,
      });
      setSelectedDesk(null);
      await refresh();
    } catch (e) {
      setBookingError(e.message);
    }
  }

  async function handleCheckIn(bookingId) {
    await api.checkIn(bookingId, me.id);
    await refresh();
  }
  async function handleRelease(bookingId) {
    await api.release(bookingId, me.id);
    await refresh();
  }
  async function handleCancel(bookingId) {
    await api.cancel(bookingId, me.id);
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

  function pickHotZone(zoneSummary) {
    setFloor(zoneSummary.floor);
    setView('table');
    // Pre-filter the table via a soft hint: select the first available hot-desk in that zone.
    const next = desks.find((d) =>
      d.floor === zoneSummary.floor &&
      d.zone === zoneSummary.zone &&
      d.hotDesk &&
      d.state === 'available'
    );
    if (next) {
      setSelectedDesk(next);
      setBookingError(null);
    }
  }

  return (
    <main className="main">
      <section className="panel">
        <div className="floor-controls">
          <label>
            Date{' '}
            <input
              type="date"
              value={date}
              min={todayIso()}
              max={me.admin ? undefined : addDays(todayIso(), MAX_ADVANCE_DAYS)}
              onChange={(e) => setDate(e.target.value)}
            />
            {!me.admin && (
              <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>
                (up to {MAX_ADVANCE_DAYS} days ahead)
              </span>
            )}
          </label>
          {view === 'map' && (
            <label>
              Floor{' '}
              <select value={floor} onChange={(e) => setFloor(e.target.value)}>
                <option value="ground">Ground</option>
                <option value="first">First</option>
              </select>
            </label>
          )}
          <div className="view-tabs">
            <button
              className={view === 'map' ? 'active' : ''}
              onClick={() => setView('map')}
            >Map</button>
            <button
              className={view === 'table' ? 'active' : ''}
              onClick={() => setView('table')}
            >Table</button>
          </div>
          {view === 'map' && (
            <>
              <label className="team-highlight-toggle">
                <input
                  type="checkbox"
                  checked={highlightTeam}
                  onChange={(e) => setHighlightTeam(e.target.checked)}
                />
                Highlight my team
              </label>
              <div className="legend">
                <span><span className="legend-dot dot-available"/>Available</span>
                <span><span className="legend-dot dot-booked"/>Booked</span>
                <span><span className="legend-dot dot-active"/>Active</span>
                {highlightTeam && <span><span className="legend-dot dot-teammate"/>Teammate</span>}
              </div>
            </>
          )}
          {me.admin && view === 'map' && !editMode && (
            <button onClick={() => setEditMode(true)} style={{ marginLeft: 'auto' }}>
              Edit desk positions
            </button>
          )}
        </div>

        {editMode && view === 'map' && (
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

        {view === 'map' ? (
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
            viewer={me}
            highlightTeam={highlightTeam}
          />
        ) : (
          <DeskTable
            desks={desks}
            onPick={(desk) => {
              setSelectedDesk(desk);
              setBookingError(null);
            }}
          />
        )}
      </section>

      <aside>
        <SuggestionsPanel
          suggestions={suggestions}
          hotDeskFallback={hotDeskFallback}
          onPick={(desk) => {
            setSelectedDesk(desk);
            setFloor(desk.floor);
            setBookingError(null);
          }}
          onPickZone={pickHotZone}
        />
        {hotDeskFallback.length > 0 && <MeetingRoomsPanel me={me} date={date} />}
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
          me={me}
        />
      )}

      <AutoReleaseManager
        booking={myActiveBooking}
        onRelease={handleRelease}
      />
    </main>
  );
}
