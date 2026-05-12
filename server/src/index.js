import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createSentientRouter } from './sentient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');
const USERS_PATH = resolve(DATA_DIR, 'users.json');
const DESKS_PATH = resolve(DATA_DIR, 'desks.json');
const BOOKINGS_PATH = resolve(DATA_DIR, 'bookings.json');
const POSITIONS_PATH = resolve(DATA_DIR, 'desk-positions.json');
const PORT = process.env.PORT || 4000;

function readJson(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  return JSON.parse(text);
}

const users = readJson(USERS_PATH);
// Desks are re-read on each desks request so regenerating desks.json
// during a session takes effect on next page refresh — no server restart needed.
let desks = readJson(DESKS_PATH);
function reloadDesks() { desks = readJson(DESKS_PATH); }

// Position overrides — persisted to desk-positions.json, applied on top of desks.json
const positionOverrides = new Map(
  existsSync(POSITIONS_PATH)
    ? JSON.parse(readFileSync(POSITIONS_PATH, 'utf8')).map((p) => [p.id, p])
    : []
);

// User privacy + admin flags live in-memory only (not persisted to users.json)
const userPrefs = new Map(users.map((u) => [u.id, { privacy: false, admin: false }]));
// First three users are admins so the demo has something to play with on /manage.
users.slice(0, 3).forEach((u) => { userPrefs.get(u.id).admin = true; });

// Current user is a simple in-memory pointer the frontend can change.
let currentUserId = users[0].id;

let bookings = existsSync(BOOKINGS_PATH)
  ? JSON.parse(readFileSync(BOOKINGS_PATH, 'utf8'))
  : [];

function persistBookings() {
  writeFileSync(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));
}

// Canonical preference keys exposed to the UI.
const PREF_KEYS = ['dual-monitor', 'near-window', 'quiet-area', 'standing-desk'];

function userPublic(u) {
  const prefs = userPrefs.get(u.id) || { privacy: false, admin: false };
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    team: u.team,
    role: u.role,
    location: u.location,
    platform: u.platform || null,
    lab: u.lab || null,
    privacy: prefs.privacy,
    admin: prefs.admin,
    deskPreferences: Array.isArray(u.deskPreferences) ? u.deskPreferences : [],
  };
}

function deskWithStatus(d, date, viewerId) {
  // Compute current desk state for a given date from active bookings.
  const todayBookings = bookings.filter((b) => b.deskId === d.id && b.date === date && b.status !== 'cancelled' && b.status !== 'released');
  const active = todayBookings.find((b) => b.status === 'active');
  const booked = todayBookings.find((b) => b.status === 'booked');
  const occupant = active || booked || null;

  let state = 'available';
  let occupantInfo = null;
  if (occupant) {
    state = active ? 'active' : 'booked';
    const occUser = users.find((u) => u.id === occupant.userId);
    const occPrefs = userPrefs.get(occupant.userId) || { privacy: false };
    const viewerPrefs = userPrefs.get(viewerId) || { admin: false };
    const isSelf = viewerId === occupant.userId;
    const hideName = occPrefs.privacy && !viewerPrefs.admin && !isSelf;
    occupantInfo = {
      bookingId: occupant.id,
      userId: hideName ? null : occupant.userId,
      fullName: hideName ? 'Private booking' : (occUser?.fullName || 'Unknown'),
      team: hideName ? null : (occUser?.team || null),
      startHour: occupant.startHour,
      endHour: occupant.endHour,
      checkedIn: occupant.status === 'active',
      private: occPrefs.privacy && !isSelf && !viewerPrefs.admin,
    };
  }
  return { ...d, state, occupant: occupantInfo };
}

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Users ----------
app.get('/api/users', (_req, res) => {
  res.json(users.map(userPublic));
});

app.get('/api/users/:id', (req, res) => {
  const u = users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(userPublic(u));
});

app.patch('/api/users/:id/privacy', (req, res) => {
  const prefs = userPrefs.get(req.params.id);
  if (!prefs) return res.status(404).json({ error: 'User not found' });
  prefs.privacy = !!req.body.privacy;
  res.json({ id: req.params.id, privacy: prefs.privacy });
});

app.patch('/api/users/:id/preferences', (req, res) => {
  const u = users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const incoming = Array.isArray(req.body?.deskPreferences) ? req.body.deskPreferences : [];
  const cleaned = incoming.filter((k) => PREF_KEYS.includes(k));
  u.deskPreferences = cleaned;
  res.json({ id: u.id, deskPreferences: cleaned });
});

// ---------- Current user (simulated auth) ----------
app.get('/api/me', (_req, res) => {
  const u = users.find((x) => x.id === currentUserId);
  res.json(userPublic(u));
});

app.post('/api/me', (req, res) => {
  const { id } = req.body || {};
  const u = users.find((x) => x.id === id);
  if (!u) return res.status(400).json({ error: 'Unknown user id' });
  currentUserId = u.id;
  res.json(userPublic(u));
});

// ---------- Desks ----------
app.get('/api/desks', (req, res) => {
  reloadDesks();
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const viewerId = req.query.viewerId || currentUserId;
  res.json(desks.map((d) => {
    const override = positionOverrides.get(d.id);
    return deskWithStatus(override ? { ...d, ...override } : d, date, viewerId);
  }));
});

app.patch('/api/desks/positions', (req, res) => {
  const { userId, updates } = req.body || {};
  const prefs = userPrefs.get(userId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'updates must be a non-empty array' });

  updates.forEach(({ id, x, y }) => {
    if (desks.find((d) => d.id === id)) positionOverrides.set(id, { id, x, y });
  });
  writeFileSync(POSITIONS_PATH, JSON.stringify([...positionOverrides.values()], null, 2));
  res.json({ saved: updates.length });
});

// ---------- Bookings ----------
app.get('/api/bookings', (req, res) => {
  const { date, userId } = req.query;
  let result = bookings;
  if (date) result = result.filter((b) => b.date === date);
  if (userId) result = result.filter((b) => b.userId === userId);
  res.json(result);
});

const MAX_ADVANCE_DAYS = 14;

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso + 'T00:00:00');
  const b = new Date(toIso + 'T00:00:00');
  return Math.round((b - a) / 86_400_000);
}

app.post('/api/bookings', (req, res) => {
  const { deskId, userId, date, startHour, endHour } = req.body || {};
  if (!deskId || !userId || !date) return res.status(400).json({ error: 'deskId, userId, date are required' });
  const sh = Number.isFinite(startHour) ? startHour : 9;
  const eh = Number.isFinite(endHour) ? endHour : 17;
  if (eh - sh < 1) return res.status(400).json({ error: 'Minimum booking is 1 hour' });
  if (sh < 0 || eh > 24) return res.status(400).json({ error: 'Hours must be 0-24' });

  const desk = desks.find((d) => d.id === deskId);
  if (!desk) return res.status(404).json({ error: 'Desk not found' });
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Booking window: standard users limited to 14 days ahead; admins exempt.
  const prefs = userPrefs.get(userId) || { admin: false };
  if (!prefs.admin) {
    const today = new Date().toISOString().slice(0, 10);
    const ahead = daysBetween(today, date);
    if (ahead > MAX_ADVANCE_DAYS) {
      return res.status(400).json({ error: `Standard users can only book up to ${MAX_ADVANCE_DAYS} days in advance.` });
    }
    if (ahead < 0) {
      return res.status(400).json({ error: 'Cannot book in the past.' });
    }
  }

  // One occupant per desk per time slot.
  const deskOverlap = bookings.find((b) =>
    b.deskId === deskId &&
    b.date === date &&
    b.status !== 'cancelled' &&
    b.status !== 'released' &&
    !(eh <= b.startHour || sh >= b.endHour)
  );
  if (deskOverlap) return res.status(409).json({ error: 'Desk already booked for that slot', conflictingBookingId: deskOverlap.id });

  // One desk per user per time slot.
  const userOverlap = bookings.find((b) =>
    b.userId === userId &&
    b.date === date &&
    b.status !== 'cancelled' &&
    b.status !== 'released' &&
    !(eh <= b.startHour || sh >= b.endHour)
  );
  if (userOverlap) {
    return res.status(409).json({
      error: 'You already have a booking that overlaps this time slot. Cancel it before booking another desk.',
      conflictingBookingId: userOverlap.id,
    });
  }

  const booking = {
    id: randomUUID(),
    deskId,
    userId,
    date,
    startHour: sh,
    endHour: eh,
    status: 'booked',
    createdAt: new Date().toISOString(),
    checkedInAt: null,
    releasedAt: null,
  };
  bookings.push(booking);
  persistBookings();
  res.status(201).json(booking);
});

app.post('/api/bookings/:id/checkin', (req, res) => {
  const b = bookings.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (b.status === 'released' || b.status === 'cancelled') return res.status(409).json({ error: 'Cannot check in to a released or cancelled booking' });
  b.status = 'active';
  b.checkedInAt = new Date().toISOString();
  persistBookings();
  res.json(b);
});

app.post('/api/bookings/:id/release', (req, res) => {
  const b = bookings.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  b.status = 'released';
  b.releasedAt = new Date().toISOString();
  persistBookings();
  res.json(b);
});

app.delete('/api/bookings/:id', (req, res) => {
  const b = bookings.find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  b.status = 'cancelled';
  persistBookings();
  res.json(b);
});

// ---------- Suggestions ----------
app.get('/api/suggestions', (req, res) => {
  const { userId, date } = req.query;
  if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
  const me = users.find((u) => u.id === userId);
  if (!me) return res.status(404).json({ error: 'User not found' });

  const dayBookings = bookings.filter((b) => b.date === date && b.status !== 'cancelled' && b.status !== 'released');
  const occupiedDeskIds = new Set(dayBookings.map((b) => b.deskId));

  // Teammates booked today
  const teammates = users
    .filter((u) => u.id !== me.id && (u.team === me.team || u.lab === me.lab || u.platform === me.platform))
    .map((u) => u.id);
  const teammateBookings = dayBookings.filter((b) => teammates.includes(b.userId));

  if (teammateBookings.length === 0) {
    // Fallback: just suggest 3 available desks matching preferred attributes
    const prefs = me.deskPreferences || [];
    const available = desks
      .filter((d) => !occupiedDeskIds.has(d.id))
      .map((d) => ({ desk: d, score: scoreByPrefs(d, prefs) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => ({ ...x.desk, reason: 'Matches your usual preferences', nearestTeammate: null }));
    return res.json(available);
  }

  const occupiedTeammateDesks = teammateBookings
    .map((b) => ({ booking: b, desk: desks.find((d) => d.id === b.deskId) }))
    .filter((x) => x.desk);

  const scored = desks
    .filter((d) => !occupiedDeskIds.has(d.id))
    .map((d) => {
      let best = null;
      for (const { booking, desk: tDesk } of occupiedTeammateDesks) {
        if (tDesk.floor !== d.floor) continue;
        const dist = Math.hypot(tDesk.x - d.x, tDesk.y - d.y);
        if (!best || dist < best.dist) {
          best = { dist, teammateUserId: booking.userId, teammateDeskId: tDesk.id };
        }
      }
      if (!best) return null;
      const teammateUser = users.find((u) => u.id === best.teammateUserId);
      return {
        ...d,
        reason: `Near ${teammateUser?.fullName || 'a teammate'} (${teammateUser?.team || ''})`,
        nearestTeammate: {
          userId: best.teammateUserId,
          fullName: teammateUser?.fullName || null,
          deskId: best.teammateDeskId,
          distance: Math.round(best.dist * 1000) / 1000,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.nearestTeammate.distance - b.nearestTeammate.distance)
    .slice(0, 3);

  res.json(scored);
});

function scoreByPrefs(desk, prefs) {
  let score = 0;
  if (prefs.includes('dual-monitor') && desk.attributes.dualMonitor) score++;
  if (prefs.includes('quiet-area') && desk.attributes.quietZone) score++;
  if (prefs.includes('window') && desk.attributes.nearWindow) score++;
  if (prefs.includes('standing-desk') && desk.attributes.heightAdjustable) score++;
  return score;
}

// ---------- Sentient Workplace mockup ----------
app.use('/api/sentient', createSentientRouter({ users }));

// ---------- Reminders ----------
app.post('/api/reminders/send', async (req, res) => {
  const { userId, date } = req.body || {};
  const prefs = userPrefs.get(userId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  if (!date) return res.status(400).json({ error: 'date is required' });

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return res.status(503).json({ error: 'TEAMS_WEBHOOK_URL is not set. Add it to your .env file.' });

  const bookedUserIds = new Set(
    bookings
      .filter((b) => b.date === date && b.status !== 'cancelled' && b.status !== 'released')
      .map((b) => b.userId)
  );
  const bookedCount = bookedUserIds.size;
  const unbookedCount = users.length - bookedCount;

  const formatted = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  const summary = {
    date,
    formatted_date: formatted,
    total_users: users.length,
    already_booked: bookedCount,
    reminder_sent_to: unbookedCount,
    booking_url: appUrl,
  };

  // Teams Incoming Webhook uses the MessageCard format
  const teamsPayload = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '00c4b0',
    summary: `Desk booking reminder — ${formatted}`,
    sections: [{
      activityTitle: `📅 Book your desk for ${formatted}`,
      activitySubtitle: 'Spacio — Book Space Smarter',
      facts: [
        { name: 'Total staff',    value: String(users.length) },
        { name: 'Already booked', value: String(bookedCount) },
        { name: 'Yet to book',    value: String(unbookedCount) },
      ],
      markdown: true,
    }],
    potentialAction: [{
      '@type': 'OpenUri',
      name: 'Book your desk →',
      targets: [{ os: 'default', uri: `${appUrl}?date=${date}` }],
    }],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamsPayload),
    });
    if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
    res.json({ ...summary, ok: true });
  } catch (e) {
    res.status(502).json({ error: `Webhook call failed: ${e.message}` });
  }
});

// ---------- Health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, users: users.length, desks: desks.length, bookings: bookings.length }));

app.listen(PORT, () => {
  console.log(`Spacio server listening on http://localhost:${PORT}`);
});
