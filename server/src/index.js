import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createSentientRouter } from './sentient.js';
import { createChatRouter } from './chat.js';
import { bookingsDb, auditDb, delegationsDb, configDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');
const USERS_PATH = resolve(DATA_DIR, 'users.json');
const DESKS_PATH = resolve(DATA_DIR, 'desks.json');
const ROOMS_PATH = resolve(DATA_DIR, 'rooms.json');
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

let rooms = existsSync(ROOMS_PATH) ? readJson(ROOMS_PATH) : [];
// In-memory room bookings (kept simple; not persisted to SQLite this cycle).
const roomBookings = [];

// Position overrides — persisted to desk-positions.json, applied on top of desks.json
const positionOverrides = new Map(
  existsSync(POSITIONS_PATH)
    ? JSON.parse(readFileSync(POSITIONS_PATH, 'utf8')).map((p) => [p.id, p])
    : []
);

// User privacy + admin flags live in-memory only (not persisted to users.json)
const userPrefs = new Map(users.map((u) => [u.id, { privacy: false, admin: false }]));
// Admins follow the org hierarchy: CEO + Platform Leads have admin rights so
// they can delegate / force-release across the org. If no such roles exist
// (e.g. a fresh demo without the hierarchy applied), fall back to the first
// three users so /manage is never locked out.
const ADMIN_ROLES = new Set(['CEO', 'Platform Lead']);
const adminsByRole = users.filter((u) => ADMIN_ROLES.has(u.role));
const adminTargets = adminsByRole.length > 0 ? adminsByRole : users.slice(0, 3);
adminTargets.forEach((u) => { userPrefs.get(u.id).admin = true; });

// Current user is a simple in-memory pointer the frontend can change.
let currentUserId = users[0].id;

// One-time migration: strip 'intune' from any persisted presenceSignals
// config so saved-state matches the new default. Re-running is a no-op.
{
  const saved = configDb.get('presenceSignals', null);
  if (saved && typeof saved === 'object' && 'intune' in saved) {
    const { intune, ...rest } = saved;
    configDb.set('presenceSignals', rest, 'system');
  }
}

// Booking auto-release policy (admin-configurable; persisted via config table).
const DEFAULT_AUTO_RELEASE = { warn1Min: 90, warn2Min: 20, autoReleaseMin: 10 };
function getAutoReleasePolicy() {
  return configDb.get('autoRelease', DEFAULT_AUTO_RELEASE);
}
function getHotDeskFallbackThreshold() {
  return configDb.get('hotDeskFallbackThreshold', 3);
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
    accessibilityNeeds: Array.isArray(u.accessibilityNeeds)
      ? u.accessibilityNeeds
      : (typeof u.accessibilityNeeds === 'string' && u.accessibilityNeeds
        ? [u.accessibilityNeeds]
        : []),
    lineManager: u.lineManager || null,
  };
}

function deskWithStatus(d, date, viewerId, activeForDate) {
  // Compute current desk state for a given date from active bookings.
  const todayBookings = activeForDate.filter((b) => b.deskId === d.id);
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
      platform: hideName ? null : (occUser?.platform || null),
      lab: hideName ? null : (occUser?.lab || null),
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

const ACCESSIBILITY_KEYS = ['wheelchair', 'ergonomic-chair', 'large-display', 'low-light', 'hearing-loop'];

app.patch('/api/users/:id/preferences', (req, res) => {
  const u = users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (Array.isArray(req.body?.deskPreferences)) {
    u.deskPreferences = req.body.deskPreferences.filter((k) => PREF_KEYS.includes(k));
  }
  if (Array.isArray(req.body?.accessibilityNeeds)) {
    u.accessibilityNeeds = req.body.accessibilityNeeds.filter((k) => ACCESSIBILITY_KEYS.includes(k));
  } else if (typeof req.body?.accessibilityNeeds === 'string') {
    u.accessibilityNeeds = req.body.accessibilityNeeds;
  }
  res.json({
    id: u.id,
    deskPreferences: u.deskPreferences || [],
    accessibilityNeeds: u.accessibilityNeeds || [],
  });
});

app.get('/api/users/:id/delegations', (req, res) => {
  const me = users.find((u) => u.id === req.params.id);
  if (!me) return res.status(404).json({ error: 'User not found' });
  const myPrefs = userPrefs.get(me.id) || { admin: false };

  const targets = new Map();
  // self
  targets.set(me.id, { ...userPublic(me), reason: 'self' });
  // direct reports (lookup by lineManager.email == my email)
  if (me.email) {
    for (const u of users) {
      if (u.lineManager?.email?.toLowerCase() === me.email.toLowerCase()) {
        targets.set(u.id, { ...userPublic(u), reason: 'direct-report' });
      }
    }
  }
  // admin → everyone
  if (myPrefs.admin) {
    for (const u of users) {
      if (!targets.has(u.id)) targets.set(u.id, { ...userPublic(u), reason: 'admin' });
    }
  }
  // explicit overrides
  for (const o of delegationsDb.forDelegator(me.id)) {
    const u = users.find((x) => x.id === o.on_behalf_of_id);
    if (u && !targets.has(u.id)) targets.set(u.id, { ...userPublic(u), reason: 'override' });
  }
  res.json([...targets.values()]);
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
  const activeForDate = bookingsDb.activeByDate(date);
  res.json(desks.map((d) => {
    const override = positionOverrides.get(d.id);
    return deskWithStatus(override ? { ...d, ...override } : d, date, viewerId, activeForDate);
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
  let result;
  if (date && userId) result = bookingsDb.byDateAndUser(date, userId);
  else if (date) result = bookingsDb.byDate(date);
  else if (userId) result = bookingsDb.byUser(userId);
  else result = bookingsDb.all();
  res.json(result);
});

const MAX_ADVANCE_DAYS = 14;

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso + 'T00:00:00');
  const b = new Date(toIso + 'T00:00:00');
  return Math.round((b - a) / 86_400_000);
}

function canDelegate(actorId, targetId) {
  if (actorId === targetId) return true;
  const actorPrefs = userPrefs.get(actorId);
  if (actorPrefs?.admin) return true;
  const target = users.find((u) => u.id === targetId);
  if (target?.lineManager?.email) {
    const actor = users.find((u) => u.id === actorId);
    if (actor?.email && target.lineManager.email.toLowerCase() === actor.email.toLowerCase()) return true;
  }
  return delegationsDb.hasOverride(actorId, targetId);
}

app.post('/api/bookings', (req, res) => {
  const { deskId, userId, date, startHour, endHour, actorId } = req.body || {};
  if (!deskId || !userId || !date) return res.status(400).json({ error: 'deskId, userId, date are required' });
  const sh = Number.isFinite(startHour) ? startHour : 9;
  const eh = Number.isFinite(endHour) ? endHour : 17;
  if (eh - sh < 1) return res.status(400).json({ error: 'Minimum booking is 1 hour' });
  if (sh < 0 || eh > 24) return res.status(400).json({ error: 'Hours must be 0-24' });

  const desk = desks.find((d) => d.id === deskId);
  if (!desk) return res.status(404).json({ error: 'Desk not found' });
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Delegation: if booking on behalf of someone else, actor must be permitted.
  const effectiveActorId = actorId || userId;
  if (effectiveActorId !== userId) {
    const actorExists = users.find((u) => u.id === effectiveActorId);
    if (!actorExists) return res.status(400).json({ error: 'Unknown actor id' });
    if (!canDelegate(effectiveActorId, userId)) {
      return res.status(403).json({ error: 'You are not permitted to book on behalf of this user.' });
    }
  }

  // Booking window: standard users limited to 14 days ahead; admins exempt.
  const prefs = userPrefs.get(userId) || { admin: false };
  const actorPrefs = userPrefs.get(effectiveActorId) || { admin: false };
  if (!prefs.admin && !actorPrefs.admin) {
    const today = new Date().toISOString().slice(0, 10);
    const ahead = daysBetween(today, date);
    if (ahead > MAX_ADVANCE_DAYS) {
      return res.status(400).json({ error: `Standard users can only book up to ${MAX_ADVANCE_DAYS} days in advance.` });
    }
    if (ahead < 0) {
      return res.status(400).json({ error: 'Cannot book in the past.' });
    }
  }

  const dayActive = bookingsDb.activeByDate(date);

  // One occupant per desk per time slot.
  const deskOverlap = dayActive.find((b) =>
    b.deskId === deskId && !(eh <= b.startHour || sh >= b.endHour)
  );
  if (deskOverlap) return res.status(409).json({ error: 'Desk already booked for that slot', conflictingBookingId: deskOverlap.id });

  // One desk per user per time slot.
  const userOverlap = dayActive.find((b) =>
    b.userId === userId && !(eh <= b.startHour || sh >= b.endHour)
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
    delegatedBy: effectiveActorId !== userId ? effectiveActorId : null,
  };
  const saved = bookingsDb.insert(booking, effectiveActorId);
  res.status(201).json(saved);
});

app.post('/api/bookings/bulk', (req, res) => {
  const { actorId, userIds, date, startHour, endHour } = req.body || {};
  if (!actorId || !date || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'actorId, date, and a non-empty userIds array are required' });
  }
  const sh = Number.isFinite(startHour) ? startHour : 9;
  const eh = Number.isFinite(endHour) ? endHour : 17;
  if (eh - sh < 1 || sh < 0 || eh > 24) return res.status(400).json({ error: 'Hours must span >= 1 and stay in 0-24' });

  reloadDesks();
  const dayActive = bookingsDb.activeByDate(date);
  const takenDeskIds = new Set(dayActive.filter((b) => !(eh <= b.startHour || sh >= b.endHour)).map((b) => b.deskId));
  const usersWithSlot = new Set(dayActive.filter((b) => !(eh <= b.startHour || sh >= b.endHour)).map((b) => b.userId));

  const results = [];
  // Process in order so deterministic; reserve desks as we go.
  for (const targetId of userIds) {
    const target = users.find((u) => u.id === targetId);
    if (!target) { results.push({ userId: targetId, status: 'error', error: 'Unknown user' }); continue; }
    if (!canDelegate(actorId, targetId)) {
      results.push({ userId: targetId, status: 'error', fullName: target.fullName, error: 'Not permitted to book on behalf of this user' });
      continue;
    }
    if (usersWithSlot.has(targetId)) {
      results.push({ userId: targetId, status: 'error', fullName: target.fullName, error: 'User already has a booking in this slot' });
      continue;
    }

    // Pick the best-scoring desk that's still available.
    const prefs = target.deskPreferences || [];
    const accessibility = Array.isArray(target.accessibilityNeeds) ? target.accessibilityNeeds : (target.accessibilityNeeds ? [target.accessibilityNeeds] : []);
    const candidates = desks
      .filter((d) => !takenDeskIds.has(d.id))
      .map((d) => ({ d, score: scoreByPrefs(d, prefs, accessibility) }))
      .sort((a, b) => b.score - a.score);
    if (candidates.length === 0) {
      results.push({ userId: targetId, status: 'error', fullName: target.fullName, error: 'No desk available in this slot' });
      continue;
    }
    const desk = candidates[0].d;

    const booking = {
      id: randomUUID(),
      deskId: desk.id,
      userId: target.id,
      date,
      startHour: sh,
      endHour: eh,
      status: 'booked',
      createdAt: new Date().toISOString(),
      checkedInAt: null,
      releasedAt: null,
      delegatedBy: actorId !== target.id ? actorId : null,
    };
    const saved = bookingsDb.insert(booking, actorId);
    takenDeskIds.add(desk.id);
    usersWithSlot.add(target.id);
    results.push({ userId: targetId, status: 'success', fullName: target.fullName, bookingId: saved.id, deskId: desk.id, deskLabel: desk.label, zone: desk.zone, floor: desk.floor });
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  res.status(201).json({ requested: userIds.length, succeeded: successCount, results });
});

app.post('/api/bookings/:id/checkin', (req, res) => {
  const b = bookingsDb.get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  if (b.status === 'released' || b.status === 'cancelled') return res.status(409).json({ error: 'Cannot check in to a released or cancelled booking' });
  const actorId = req.body?.actorId || b.userId;
  res.json(bookingsDb.checkIn(b.id, actorId));
});

app.post('/api/bookings/:id/release', (req, res) => {
  const b = bookingsDb.get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  const actorId = req.body?.actorId || b.userId;
  const forced = actorId !== b.userId;
  res.json(bookingsDb.release(b.id, actorId, forced));
});

app.delete('/api/bookings/:id', (req, res) => {
  const b = bookingsDb.get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  const actorId = req.query?.actorId || b.userId;
  res.json(bookingsDb.cancel(b.id, actorId));
});

// ---------- Suggestions ----------
function hotDeskZoneSummary(date) {
  reloadDesks();
  const dayActive = bookingsDb.activeByDate(date);
  const occupied = new Set(dayActive.map((b) => b.deskId));
  const buckets = new Map();
  for (const d of desks) {
    if (!d.hotDesk) continue;
    const key = `${d.floor}::${d.zone}`;
    if (!buckets.has(key)) buckets.set(key, { floor: d.floor, zone: d.zone, total: 0, available: 0 });
    const row = buckets.get(key);
    row.total += 1;
    if (!occupied.has(d.id)) row.available += 1;
  }
  return [...buckets.values()]
    .filter((b) => b.available > 0)
    .sort((a, b) => b.available - a.available);
}

app.get('/api/suggestions', (req, res) => {
  const { userId, date } = req.query;
  if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
  const me = users.find((u) => u.id === userId);
  if (!me) return res.status(404).json({ error: 'User not found' });

  const dayBookings = bookingsDb.activeByDate(date);
  const occupiedDeskIds = new Set(dayBookings.map((b) => b.deskId));

  // Teammates booked today
  const teammates = users
    .filter((u) => u.id !== me.id && (u.team === me.team || u.lab === me.lab || u.platform === me.platform))
    .map((u) => u.id);
  const teammateBookings = dayBookings.filter((b) => teammates.includes(b.userId));

  let suggestions;
  if (teammateBookings.length === 0) {
    // Fallback: just suggest 3 available desks matching preferred attributes
    const prefs = me.deskPreferences || [];
    suggestions = desks
      .filter((d) => !occupiedDeskIds.has(d.id))
      .map((d) => ({ desk: d, score: scoreByPrefs(d, prefs, me.accessibilityNeeds) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => ({ ...x.desk, reason: 'Matches your usual preferences', nearestTeammate: null }));
  } else {
    const occupiedTeammateDesks = teammateBookings
      .map((b) => ({ booking: b, desk: desks.find((d) => d.id === b.deskId) }))
      .filter((x) => x.desk);

    suggestions = desks
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
  }

  // Hot-desk fallback: when we have fewer than the threshold, attach zone summaries.
  const threshold = getHotDeskFallbackThreshold();
  const hotDeskFallback = suggestions.length < threshold ? hotDeskZoneSummary(date) : [];
  res.json({ suggestions, hotDeskFallback });
});

function scoreByPrefs(desk, prefs, accessibilityNeeds) {
  let score = 0;
  if (prefs.includes('dual-monitor') && desk.attributes.dualMonitor) score++;
  if (prefs.includes('quiet-area') && desk.attributes.quietZone) score++;
  if (prefs.includes('window') && desk.attributes.nearWindow) score++;
  if (prefs.includes('standing-desk') && desk.attributes.heightAdjustable) score++;
  if (accessibilityNeeds && accessibilityNeeds.includes('wheelchair') && desk.attributes.wheelchairAccess) score += 2;
  return score;
}

// ---------- Rooms ----------
app.get('/api/rooms', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const todayRoomBookings = roomBookings.filter((b) => b.date === date && b.status !== 'cancelled');
  res.json(rooms.map((r) => {
    const taken = todayRoomBookings.filter((b) => b.roomId === r.id);
    return { ...r, bookings: taken };
  }));
});

app.post('/api/rooms/:id/book', (req, res) => {
  const room = rooms.find((r) => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const { userId, date, startHour, endHour } = req.body || {};
  if (!userId || !date) return res.status(400).json({ error: 'userId and date are required' });
  const user = users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const sh = Number.isFinite(startHour) ? startHour : 9;
  const eh = Number.isFinite(endHour) ? endHour : sh + 1;
  if (eh - sh < 1 || sh < 0 || eh > 24) return res.status(400).json({ error: 'Hours must be 0-24 and span >= 1' });

  const overlap = roomBookings.find((b) =>
    b.roomId === room.id && b.date === date && b.status !== 'cancelled' &&
    !(eh <= b.startHour || sh >= b.endHour)
  );
  if (overlap) return res.status(409).json({ error: 'Room already booked for that slot' });

  const booking = {
    id: randomUUID(), roomId: room.id, userId, date,
    startHour: sh, endHour: eh, status: 'booked', createdAt: new Date().toISOString(),
  };
  roomBookings.push(booking);
  res.status(201).json(booking);
});

// ---------- Delegation admin (manage explicit overrides) ----------
app.get('/api/admin/delegations', (req, res) => {
  const actorId = req.query.actorId;
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  res.json(delegationsDb.all().map((o) => {
    const delegator = users.find((u) => u.id === o.delegator_id);
    const target = users.find((u) => u.id === o.on_behalf_of_id);
    return {
      delegatorId: o.delegator_id,
      delegatorName: delegator?.fullName || null,
      onBehalfOfId: o.on_behalf_of_id,
      onBehalfOfName: target?.fullName || null,
      grantedBy: o.granted_by,
      grantedAt: o.granted_at,
    };
  }));
});

app.post('/api/admin/delegations', (req, res) => {
  const { actorId, delegatorId, onBehalfOfId } = req.body || {};
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  if (!delegatorId || !onBehalfOfId) return res.status(400).json({ error: 'delegatorId and onBehalfOfId are required' });
  if (!users.find((u) => u.id === delegatorId) || !users.find((u) => u.id === onBehalfOfId)) {
    return res.status(404).json({ error: 'Unknown user id' });
  }
  delegationsDb.add(delegatorId, onBehalfOfId, actorId);
  res.status(201).json({ delegatorId, onBehalfOfId });
});

app.delete('/api/admin/delegations', (req, res) => {
  const { actorId, delegatorId, onBehalfOfId } = req.body || {};
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  delegationsDb.remove(delegatorId, onBehalfOfId);
  res.json({ ok: true });
});

// ---------- Admin insights ----------
function buildInsights(fromIso, toIsoExclusive) {
  const all = bookingsDb.all();
  const inRange = all.filter((b) => b.date >= fromIso && b.date < toIsoExclusive);

  const totalBookings = inRange.length;
  const everCheckedIn = inRange.filter((b) => b.checkedInAt != null).length;
  const cancelled = inRange.filter((b) => b.status === 'cancelled').length;
  const released = inRange.filter((b) => b.status === 'released').length;
  const ghosts = inRange.filter((b) => b.status !== 'cancelled' && b.checkedInAt == null && b.status === 'released').length;
  const ghostRatio = totalBookings ? Math.round((ghosts / totalBookings) * 1000) / 10 : 0;

  // Occupancy by zone — count every booking that wasn't cancelled, including
  // released ones (they reflect historical desk usage even when auto-released).
  reloadDesks();
  const deskById = new Map(desks.map((d) => [d.id, d]));
  const zoneCounts = new Map();
  for (const b of inRange) {
    if (b.status === 'cancelled') continue;
    const d = deskById.get(b.deskId);
    if (!d) continue;
    const key = `${d.floor}::${d.zone}`;
    zoneCounts.set(key, (zoneCounts.get(key) || 0) + 1);
  }
  const occupancyByZone = [...zoneCounts.entries()].map(([k, n]) => {
    const [floor, zone] = k.split('::');
    return { floor, zone, bookings: n };
  }).sort((a, b) => b.bookings - a.bookings);

  // Peak hours — same: include released so historical hour-of-day patterns show.
  const hourCounts = new Array(24).fill(0);
  for (const b of inRange) {
    if (b.status === 'cancelled') continue;
    for (let h = b.startHour; h < b.endHour; h++) hourCounts[h] += 1;
  }
  const peakHours = hourCounts.map((n, h) => ({ hour: h, count: n })).filter((r) => r.count > 0);

  // Hot-desk pickup rate
  const hotDeskBookings = inRange.filter((b) => {
    const d = deskById.get(b.deskId);
    return d?.hotDesk;
  });
  const hotDeskPickupRate = totalBookings
    ? Math.round((hotDeskBookings.length / totalBookings) * 1000) / 10
    : 0;

  // Average dwell time (checkedInAt -> releasedAt or end-of-slot)
  let dwellMinSum = 0;
  let dwellCount = 0;
  for (const b of inRange) {
    if (!b.checkedInAt) continue;
    const start = new Date(b.checkedInAt);
    const end = b.releasedAt
      ? new Date(b.releasedAt)
      : new Date(`${b.date}T${String(b.endHour).padStart(2, '0')}:00:00`);
    const min = (end - start) / 60000;
    if (min > 0 && min < 24 * 60) {
      dwellMinSum += min;
      dwellCount += 1;
    }
  }
  const avgDwellMinutes = dwellCount ? Math.round(dwellMinSum / dwellCount) : 0;

  return {
    range: { from: fromIso, toExclusive: toIsoExclusive },
    totals: { totalBookings, everCheckedIn, cancelled, released, ghosts, ghostRatioPct: ghostRatio },
    occupancyByZone,
    peakHours,
    hotDesk: { bookings: hotDeskBookings.length, pickupRatePct: hotDeskPickupRate },
    avgDwellMinutes,
  };
}

app.get('/api/admin/insights', (req, res) => {
  const actorId = req.query.actorId;
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  const from = req.query.from || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const to = req.query.to || new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  res.json(buildInsights(from, to));
});

app.get('/api/admin/insights/csv', (req, res) => {
  const actorId = req.query.actorId;
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).send('Admin only');
  const from = req.query.from || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const to = req.query.to || new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const all = bookingsDb.all().filter((b) => b.date >= from && b.date < to);
  const rows = [['booking_id', 'date', 'desk_id', 'user_id', 'start_hour', 'end_hour', 'status', 'created_at', 'checked_in_at', 'released_at', 'delegated_by']];
  for (const b of all) {
    rows.push([
      b.id, b.date, b.deskId, b.userId, b.startHour, b.endHour, b.status,
      b.createdAt, b.checkedInAt || '', b.releasedAt || '', b.delegatedBy || '',
    ]);
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="insights-${from}-to-${to}.csv"`);
  res.send(rows.map((r) => r.map((c) => String(c).includes(',') ? `"${c}"` : c).join(',')).join('\n'));
});

app.get('/api/admin/audit/:bookingId', (req, res) => {
  const actorId = req.query.actorId;
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  res.json(auditDb.byBooking(req.params.bookingId));
});

// ---------- Admin config ----------
app.get('/api/config', (req, res) => {
  const actorId = req.query.actorId;
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  res.json({
    autoRelease: getAutoReleasePolicy(),
    hotDeskFallbackThreshold: getHotDeskFallbackThreshold(),
    presenceSignals: configDb.get('presenceSignals', { monitor: true, ap: true, bluetooth: false }),
  });
});

app.patch('/api/config/:key', (req, res) => {
  const { actorId, value } = req.body || {};
  const prefs = userPrefs.get(actorId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  configDb.set(req.params.key, value, actorId);
  res.json({ key: req.params.key, value });
});

// ---------- Sentient Workplace mockup ----------
app.use('/api/sentient', createSentientRouter({ users }));

// ---------- AI chat agent ----------
app.use('/api/chat', createChatRouter({ port: PORT }));

// ---------- Reminders ----------
app.post('/api/reminders/send', async (req, res) => {
  const { userId, date } = req.body || {};
  const prefs = userPrefs.get(userId);
  if (!prefs?.admin) return res.status(403).json({ error: 'Admin only' });
  if (!date) return res.status(400).json({ error: 'date is required' });

  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) return res.status(503).json({ error: 'TEAMS_WEBHOOK_URL is not set. Add it to your .env file.' });

  const bookedUserIds = new Set(bookingsDb.activeByDate(date).map((b) => b.userId));
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
app.get('/api/health', (_req, res) => res.json({ ok: true, users: users.length, desks: desks.length, bookings: bookingsDb.count() }));

app.listen(PORT, () => {
  console.log(`Spacio server listening on http://localhost:${PORT}`);
});
