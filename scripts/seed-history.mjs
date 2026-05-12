// Re-runnable. Seeds ~20 workdays of historical bookings into SQLite so
// /manage/insights shows realistic occupancy, peak hours, ghost ratio,
// and dwell time. Skips any date that already has bookings.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.FMD_DB_PATH || resolve(__dirname, '../data/findmydesk.db');
const USERS_PATH = resolve(__dirname, '../data/users.json');
const DESKS_PATH = resolve(__dirname, '../data/desks.json');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

const users = JSON.parse(readFileSync(USERS_PATH, 'utf8').replace(/^﻿/, ''));
const desks = JSON.parse(readFileSync(DESKS_PATH, 'utf8').replace(/^﻿/, ''));

const MGMT = new Set(['CEO', 'Platform Lead', 'Lab Lead', 'Team Lead']);
const bookers = users.filter((u) => !MGMT.has(u.role));

// Deterministic RNG so reruns produce identical data on a fresh DB.
function makeRng(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function isWorkday(iso) {
  const dow = new Date(iso + 'T00:00:00').getDay();
  return dow >= 1 && dow <= 5;
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);
const TARGET_WORKDAYS = 20;
const dates = [];
{
  let offset = 1;
  while (dates.length < TARGET_WORKDAYS && offset < 60) {
    const d = addDays(today, -offset);
    if (isWorkday(d)) dates.push(d);
    offset += 1;
  }
}
dates.reverse(); // chronological

const stmts = {
  existingForDate: db.prepare('SELECT COUNT(*) AS n FROM bookings WHERE date = ?'),
  insertBooking: db.prepare(`
    INSERT INTO bookings (id, desk_id, user_id, date, start_hour, end_hour, status,
                          created_at, checked_in_at, released_at, cancelled_at, delegated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  insertAudit: db.prepare(`
    INSERT INTO audit_log (booking_id, event, actor_id, at, details)
    VALUES (?, ?, ?, ?, ?)
  `),
};

function isoAt(date, hour, minute = 0) {
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

function dayOfYear(iso) {
  const d = new Date(iso + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86_400_000);
}

let totalInserted = 0;
let skippedDates = 0;

for (const date of dates) {
  if (stmts.existingForDate.get(date).n > 0) {
    skippedDates += 1;
    continue;
  }

  const rng = makeRng(dayOfYear(date) * 1_000_003 + 17);

  // Daily occupancy varies: Mon/Fri quieter, Tue-Thu busier.
  const dow = new Date(date + 'T00:00:00').getDay();
  const baseRate = [null, 0.45, 0.78, 0.82, 0.74, 0.42][dow] ?? 0.6;
  const targetBookings = Math.round(bookers.length * baseRate);

  // Shuffle bookers + desks
  const userPool = [...bookers].sort(() => rng() - 0.5);
  const deskPool = [...desks].sort(() => rng() - 0.5);

  const usedDesks = new Set();
  let dayCount = 0;

  for (const user of userPool) {
    if (dayCount >= targetBookings) break;
    const desk = deskPool.find((d) => !usedDesks.has(d.id));
    if (!desk) break;
    usedDesks.add(desk.id);

    // Slot: most full-day 9-17, some half-day variants.
    const slotRoll = rng();
    let startHour, endHour;
    if (slotRoll < 0.65) { startHour = 9;  endHour = 17; }
    else if (slotRoll < 0.80) { startHour = 9;  endHour = 13; }
    else if (slotRoll < 0.92) { startHour = 13; endHour = 17; }
    else { startHour = 10; endHour = 16; }

    const createdAt = isoAt(addDays(date, -Math.floor(rng() * 5 + 1)), 8 + Math.floor(rng() * 8), Math.floor(rng() * 60));

    // Outcome distribution:
    //   ~6% cancelled before the day
    //   ~12% ghost (booked, no check-in, force-released at end of day)
    //   ~70% checked in then naturally released near end-hour
    //   ~12% checked in then released early
    const outcomeRoll = rng();
    let status, checkedInAt = null, releasedAt = null, cancelledAt = null;
    let auditEvents = [];

    if (outcomeRoll < 0.06) {
      status = 'cancelled';
      cancelledAt = isoAt(addDays(date, -1), 16 + Math.floor(rng() * 3), Math.floor(rng() * 60));
      auditEvents.push({ event: 'cancelled', at: cancelledAt });
    } else if (outcomeRoll < 0.18) {
      // Ghost: booked, never checked in, force-released by auto-release at end of day
      status = 'released';
      releasedAt = isoAt(date, endHour, Math.floor(rng() * 30));
      auditEvents.push({ event: 'force_released', at: releasedAt, details: { reason: 'auto-release (no check-in)' } });
    } else if (outcomeRoll < 0.88) {
      // Normal flow: checked in + released around end-hour
      status = 'released';
      const checkInDelay = Math.floor(rng() * 25); // 0-25 min after start
      checkedInAt = isoAt(date, startHour, checkInDelay);
      const releaseOffset = Math.floor(rng() * 60); // last hour
      releasedAt = isoAt(date, endHour - 1, releaseOffset);
      auditEvents.push({ event: 'checked_in', at: checkedInAt });
      auditEvents.push({ event: 'released', at: releasedAt });
    } else {
      // Checked in, released significantly early
      status = 'released';
      checkedInAt = isoAt(date, startHour, Math.floor(rng() * 15));
      const earlyHour = startHour + Math.max(1, Math.floor((endHour - startHour) * rng() * 0.6));
      releasedAt = isoAt(date, earlyHour, Math.floor(rng() * 60));
      auditEvents.push({ event: 'checked_in', at: checkedInAt });
      auditEvents.push({ event: 'released', at: releasedAt });
    }

    const id = randomUUID();
    stmts.insertBooking.run(
      id, desk.id, user.id, date,
      startHour, endHour, status,
      createdAt, checkedInAt, releasedAt, cancelledAt, null,
    );
    stmts.insertAudit.run(id, 'created', user.id, createdAt, null);
    for (const ev of auditEvents) {
      stmts.insertAudit.run(id, ev.event, user.id, ev.at, ev.details ? JSON.stringify(ev.details) : null);
    }

    dayCount += 1;
    totalInserted += 1;
  }

  console.log(`  ${date} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}): ${dayCount} bookings`);
}

console.log('---');
console.log('Days seeded:', dates.length - skippedDates);
console.log('Days skipped (had data):', skippedDates);
console.log('Total bookings inserted:', totalInserted);
console.log('DB total bookings:', db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n);
