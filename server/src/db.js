import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data');
const DB_PATH = process.env.FMD_DB_PATH || resolve(DATA_DIR, 'findmydesk.db');
const BOOKINGS_JSON_PATH = resolve(DATA_DIR, 'bookings.json');

mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id            TEXT PRIMARY KEY,
    desk_id       TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    date          TEXT NOT NULL,
    start_hour    INTEGER NOT NULL,
    end_hour      INTEGER NOT NULL,
    status        TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    checked_in_at TEXT,
    released_at   TEXT,
    cancelled_at  TEXT,
    delegated_by  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);
  CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_desk ON bookings(desk_id);

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id TEXT NOT NULL,
    event      TEXT NOT NULL,
    actor_id   TEXT,
    at         TEXT NOT NULL,
    details    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_audit_booking ON audit_log(booking_id);
  CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event);
  CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);

  CREATE TABLE IF NOT EXISTS delegation_overrides (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    delegator_id    TEXT NOT NULL,
    on_behalf_of_id TEXT NOT NULL,
    granted_by      TEXT NOT NULL,
    granted_at      TEXT NOT NULL,
    UNIQUE(delegator_id, on_behalf_of_id)
  );

  CREATE TABLE IF NOT EXISTS config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT
  );
`);

// One-time seed: if SQLite is empty and the legacy bookings.json exists, import it.
const seedNeeded = db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n === 0;
if (seedNeeded && existsSync(BOOKINGS_JSON_PATH)) {
  const legacy = JSON.parse(readFileSync(BOOKINGS_JSON_PATH, 'utf8'));
  if (Array.isArray(legacy) && legacy.length > 0) {
    const ins = db.prepare(`
      INSERT INTO bookings (id, desk_id, user_id, date, start_hour, end_hour, status,
                            created_at, checked_in_at, released_at, cancelled_at, delegated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const auditIns = db.prepare(`
      INSERT INTO audit_log (booking_id, event, actor_id, at, details)
      VALUES (?, 'created', ?, ?, ?)
    `);
    const tx = db.prepare('BEGIN').run.bind(db.prepare('BEGIN'));
    db.exec('BEGIN');
    try {
      for (const b of legacy) {
        ins.run(
          b.id, b.deskId, b.userId, b.date, b.startHour, b.endHour, b.status,
          b.createdAt || new Date().toISOString(),
          b.checkedInAt || null, b.releasedAt || null, null, null,
        );
        auditIns.run(b.id, b.userId, b.createdAt || new Date().toISOString(), 'seeded from bookings.json');
      }
      db.exec('COMMIT');
      console.log(`[db] Seeded ${legacy.length} bookings from bookings.json`);
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('[db] Seed failed', e);
    }
  }
}

function rowToBooking(row) {
  if (!row) return null;
  const out = {
    id: row.id,
    deskId: row.desk_id,
    userId: row.user_id,
    date: row.date,
    startHour: row.start_hour,
    endHour: row.end_hour,
    status: row.status,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at,
    releasedAt: row.released_at,
  };
  if (row.delegated_by) out.delegatedBy = row.delegated_by;
  return out;
}

const stmts = {
  insertBooking: db.prepare(`
    INSERT INTO bookings (id, desk_id, user_id, date, start_hour, end_hour, status,
                          created_at, checked_in_at, released_at, cancelled_at, delegated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getBooking: db.prepare('SELECT * FROM bookings WHERE id = ?'),
  allActiveByDate: db.prepare(`
    SELECT * FROM bookings WHERE date = ? AND status NOT IN ('cancelled', 'released')
  `),
  allByDate: db.prepare('SELECT * FROM bookings WHERE date = ? ORDER BY created_at'),
  allByUser: db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY date DESC, start_hour'),
  allByDateAndUser: db.prepare(`
    SELECT * FROM bookings WHERE date = ? AND user_id = ? ORDER BY start_hour
  `),
  allBookings: db.prepare('SELECT * FROM bookings ORDER BY date DESC, start_hour'),
  countBookings: db.prepare('SELECT COUNT(*) AS n FROM bookings'),
  setStatus: db.prepare(`
    UPDATE bookings SET status = ?, checked_in_at = COALESCE(checked_in_at, ?),
           released_at = COALESCE(released_at, ?), cancelled_at = COALESCE(cancelled_at, ?)
    WHERE id = ?
  `),
  insertAudit: db.prepare(`
    INSERT INTO audit_log (booking_id, event, actor_id, at, details)
    VALUES (?, ?, ?, ?, ?)
  `),
  auditByDateRange: db.prepare(`
    SELECT * FROM audit_log WHERE at >= ? AND at < ? ORDER BY at
  `),
  auditByBooking: db.prepare('SELECT * FROM audit_log WHERE booking_id = ? ORDER BY at'),
  insertOverride: db.prepare(`
    INSERT OR IGNORE INTO delegation_overrides (delegator_id, on_behalf_of_id, granted_by, granted_at)
    VALUES (?, ?, ?, ?)
  `),
  deleteOverride: db.prepare(`
    DELETE FROM delegation_overrides WHERE delegator_id = ? AND on_behalf_of_id = ?
  `),
  overridesFor: db.prepare(`
    SELECT * FROM delegation_overrides WHERE delegator_id = ?
  `),
  allOverrides: db.prepare('SELECT * FROM delegation_overrides ORDER BY granted_at DESC'),
  hasOverride: db.prepare(`
    SELECT 1 FROM delegation_overrides WHERE delegator_id = ? AND on_behalf_of_id = ?
  `),
  getConfig: db.prepare('SELECT value FROM config WHERE key = ?'),
  setConfig: db.prepare(`
    INSERT INTO config (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `),
  allConfig: db.prepare('SELECT * FROM config ORDER BY key'),
};

export const bookingsDb = {
  insert(booking, actorId) {
    stmts.insertBooking.run(
      booking.id, booking.deskId, booking.userId, booking.date,
      booking.startHour, booking.endHour, booking.status,
      booking.createdAt, booking.checkedInAt || null, booking.releasedAt || null,
      null, booking.delegatedBy || null,
    );
    stmts.insertAudit.run(booking.id, 'created', actorId || booking.userId, booking.createdAt,
      booking.delegatedBy ? JSON.stringify({ delegatedBy: booking.delegatedBy }) : null);
    return this.get(booking.id);
  },
  get(id) {
    return rowToBooking(stmts.getBooking.get(id));
  },
  activeByDate(date) {
    return stmts.allActiveByDate.all(date).map(rowToBooking);
  },
  all() {
    return stmts.allBookings.all().map(rowToBooking);
  },
  byDate(date) {
    return stmts.allByDate.all(date).map(rowToBooking);
  },
  byUser(userId) {
    return stmts.allByUser.all(userId).map(rowToBooking);
  },
  byDateAndUser(date, userId) {
    return stmts.allByDateAndUser.all(date, userId).map(rowToBooking);
  },
  count() {
    return stmts.countBookings.get().n;
  },
  checkIn(id, actorId) {
    const at = new Date().toISOString();
    stmts.setStatus.run('active', at, null, null, id);
    stmts.insertAudit.run(id, 'checked_in', actorId, at, null);
    return this.get(id);
  },
  release(id, actorId, forced = false) {
    const at = new Date().toISOString();
    stmts.setStatus.run('released', null, at, null, id);
    stmts.insertAudit.run(id, forced ? 'force_released' : 'released', actorId, at,
      forced ? JSON.stringify({ forcedBy: actorId }) : null);
    return this.get(id);
  },
  cancel(id, actorId) {
    const at = new Date().toISOString();
    stmts.setStatus.run('cancelled', null, null, at, id);
    stmts.insertAudit.run(id, 'cancelled', actorId, at, null);
    return this.get(id);
  },
};

export const auditDb = {
  byBooking(id) {
    return stmts.auditByBooking.all(id);
  },
  byDateRange(fromIso, toExclusiveIso) {
    return stmts.auditByDateRange.all(fromIso, toExclusiveIso);
  },
};

export const delegationsDb = {
  add(delegatorId, onBehalfOfId, grantedBy) {
    stmts.insertOverride.run(delegatorId, onBehalfOfId, grantedBy, new Date().toISOString());
  },
  remove(delegatorId, onBehalfOfId) {
    stmts.deleteOverride.run(delegatorId, onBehalfOfId);
  },
  forDelegator(delegatorId) {
    return stmts.overridesFor.all(delegatorId);
  },
  hasOverride(delegatorId, onBehalfOfId) {
    return !!stmts.hasOverride.get(delegatorId, onBehalfOfId);
  },
  all() {
    return stmts.allOverrides.all();
  },
};

export const configDb = {
  get(key, fallback = null) {
    const row = stmts.getConfig.get(key);
    if (!row) return fallback;
    try { return JSON.parse(row.value); } catch { return row.value; }
  },
  set(key, value, actorId) {
    stmts.setConfig.run(key, JSON.stringify(value), new Date().toISOString(), actorId || null);
  },
  all() {
    return stmts.allConfig.all().map((r) => ({
      key: r.key,
      value: (() => { try { return JSON.parse(r.value); } catch { return r.value; } })(),
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    }));
  },
};
