import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../data/sentient');

function readJson(name) {
  const text = readFileSync(resolve(DATA_DIR, name), 'utf8').replace(/^﻿/, '');
  return JSON.parse(text);
}

export function createSentientRouter({ users }) {
  const router = Router();

  const timeline = readJson('timeline.json');
  const zones = readJson('zones.json');
  const network = readJson('network-quality.json');
  const wellness = readJson('wellness.json');
  const rawBookings = readJson('bookings.json');

  // In-memory release state for the demo so the user can click "Release"
  // and see the desk go available without touching real bookings.json.
  const released = new Set();

  function decoratedBookings() {
    return rawBookings.map((b) => {
      const user = users[b.userIndex % users.length] || users[0];
      return {
        id: b.id,
        deskId: b.deskId,
        startHour: b.startHour,
        endHour: b.endHour,
        ghost: !!b.ghost,
        released: released.has(b.id),
        user: {
          id: user.id,
          fullName: user.fullName,
          team: user.team,
          email: user.email,
        },
      };
    });
  }

  router.get('/scenarios', (_req, res) => {
    res.json([{ name: timeline.name, label: timeline.label, description: timeline.description, steps: timeline.steps.length }]);
  });

  router.get('/scenarios/:name', (req, res) => {
    if (req.params.name !== timeline.name) return res.status(404).json({ error: 'Scenario not found' });
    res.json(timeline);
  });

  router.get('/zones', (_req, res) => res.json(zones));
  router.get('/network', (_req, res) => res.json(network));
  router.get('/wellness', (_req, res) => res.json(wellness));

  router.get('/bookings', (_req, res) => res.json(decoratedBookings()));

  router.post('/release', (req, res) => {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const found = rawBookings.find((b) => b.id === id);
    if (!found) return res.status(404).json({ error: 'Booking not found' });
    released.add(id);
    res.json({ id, released: true });
  });

  router.post('/reset-releases', (_req, res) => {
    released.clear();
    res.json({ released: 0 });
  });

  return router;
}
