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

const MAX_ADVANCE_DAYS = 14;

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookingPage({ me }) {
  const [date, setDate] = useState(todayIso());
  const [floor, setFloor] = useState('ground');
  const [desks, setDesks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [bookingError, setBookingError] = useState(null);

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
        </div>
        <FloorPlan
          floor={floor}
          desks={floorDesks}
          onPick={(desk) => {
            if (desk.state !== 'available') return;
            setSelectedDesk(desk);
            setBookingError(null);
          }}
          selectedId={selectedDesk?.id}
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
