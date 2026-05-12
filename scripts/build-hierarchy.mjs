// Re-runnable: builds a CEO → Platform Lead → Lab Lead → Team Lead → IC
// hierarchy on top of data/users.json. Creates manager records that don't
// already exist (matched by email) and rewires every IC's lineManager to
// their team lead. Idempotent: running twice produces the same file.

import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const USERS_PATH = resolve(__dirname, '../data/users.json');

const users = JSON.parse(readFileSync(USERS_PATH, 'utf8').replace(/^﻿/, ''));

// Names that already appear (as phantom managers) in users.json — we
// promote them to real records so existing references continue to resolve.
const CEO_NAME = 'Olivia Johnson';
const PLATFORM_LEAD_NAMES = {
  'Cyber Security':          'Daniel Wilson',
  'Cloud & Infrastructure':  'Sophie Taylor',
  'Workplace':               'James Brown',
  'Data & AI':               'Alice Smith',
  'Developer Experience':    'Marcus Reid',         // new — DevEx had no phantom name
};

// Plausible business names; deterministic so re-running is stable.
const LAB_LEAD_NAMES = {
  'Cyber Security::Identity Lab':                'Priya Anand',
  'Cloud & Infrastructure::Automation Lab':      'Hannah Roe',
  'Cloud & Infrastructure::Observability Lab':  'Felix Carter',
  'Workplace::Client Engineering Lab':           'Naomi Voss',
  'Data & AI::Data Innovation Lab':              'Theo Walsh',
  'Developer Experience::Automation Lab':        'Ines Mendes',
};

const TEAM_LEAD_NAMES = {
  'Cyber Security::Identity Lab::Security':                       'Adrian Pell',
  'Cyber Security::Identity Lab::IAM':                            'Beatrice Vey',
  'Cyber Security::Identity Lab::Threat & Vulnerability':         'Cormac Reilly',
  'Cloud & Infrastructure::Automation Lab::Platform Engineering': 'Dilan Osei',
  'Cloud & Infrastructure::Observability Lab::Platform Engineering': 'Edie Brand',
  'Cloud & Infrastructure::Observability Lab::SRE':               'Farah Iqbal',
  'Cloud & Infrastructure::Observability Lab::Network Services':  'Gus Halloran',
  'Workplace::Client Engineering Lab::Mac':                       'Hester Mwangi',
  'Workplace::Client Engineering Lab::Directory Services':        'Iris Kovac',
  'Workplace::Client Engineering Lab::Specialist Support':        'Joao Pereira',
  'Data & AI::Data Innovation Lab::Data':                         'Karim Sayed',
  'Data & AI::Data Innovation Lab::Data Platform':                'Lena Whitford',
  'Data & AI::Data Innovation Lab::ML Ops':                       'Maeve Donlon',
  'Developer Experience::Automation Lab::API Enablement':         'Noor Hashemi',
  'Developer Experience::Automation Lab::CI/CD Enablement':       'Otis Bramwell',
  'Developer Experience::Automation Lab::Developer Tooling':      'Priya Tate',
};

function emailFor(fullName) {
  return fullName.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, '.') + '@thebank.com';
}

const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
let nextEmployeeId = Math.max(0, ...users.map((u) => u.employeeId || 0)) + 1;

function ensureUser({ fullName, role, platform, lab, team, lineManager, preferredNeighbourhood = 'Window Bank' }) {
  const email = emailFor(fullName);
  if (byEmail.has(email)) {
    // Already exists — just update structural fields so a previous mis-wired
    // record gets corrected on a re-run.
    const existing = byEmail.get(email);
    existing.role = role;
    existing.platform = platform;
    existing.lab = lab;
    existing.team = team;
    existing.lineManager = lineManager || null;
    return existing;
  }
  const u = {
    id: randomUUID(),
    employeeId: nextEmployeeId++,
    fullName,
    email,
    location: 'London',
    team,
    role,
    lineManager: lineManager || null,
    anchorDays: ['Tuesday', 'Wednesday', 'Thursday'],
    defaultWorkingPattern: {
      monday: 'office', tuesday: 'office', wednesday: 'office',
      thursday: 'office', friday: 'remote',
    },
    preferredNeighbourhood,
    deskPreferences: ['dual-monitor', 'quiet-area'],
    bookingWindowDays: 30,
    accessibilityNeeds: '',
    platform: platform || null,
    lab: lab || null,
  };
  users.push(u);
  byEmail.set(email, u);
  return u;
}

// 1. CEO
const ceo = ensureUser({
  fullName: CEO_NAME,
  role: 'CEO',
  platform: null,
  lab: null,
  team: 'Executive Office',
  lineManager: null,
});
const ceoRef = { name: ceo.fullName, email: ceo.email };

// 2. Platform leads
const platformLeads = {};
for (const [platform, name] of Object.entries(PLATFORM_LEAD_NAMES)) {
  platformLeads[platform] = ensureUser({
    fullName: name,
    role: 'Platform Lead',
    platform,
    lab: null,
    team: 'Executive Office',
    lineManager: ceoRef,
  });
}

// 3. Lab leads
const labLeads = {};
for (const [key, name] of Object.entries(LAB_LEAD_NAMES)) {
  const [platform, lab] = key.split('::');
  const pl = platformLeads[platform];
  labLeads[key] = ensureUser({
    fullName: name,
    role: 'Lab Lead',
    platform,
    lab,
    team: 'Executive Office',
    lineManager: { name: pl.fullName, email: pl.email },
  });
}

// 4. Team leads
const teamLeads = {};
for (const [key, name] of Object.entries(TEAM_LEAD_NAMES)) {
  const [platform, lab, team] = key.split('::');
  const ll = labLeads[`${platform}::${lab}`];
  if (!ll) throw new Error('No lab lead for ' + key);
  teamLeads[key] = ensureUser({
    fullName: name,
    role: 'Team Lead',
    platform,
    lab,
    team,
    lineManager: { name: ll.fullName, email: ll.email },
  });
}

// 5. Rewire ICs — anyone whose role is not in the management chain points
// to their team lead.
const MGMT_ROLES = new Set(['CEO', 'Platform Lead', 'Lab Lead', 'Team Lead']);
let rewired = 0;
for (const u of users) {
  if (MGMT_ROLES.has(u.role)) continue;
  const key = `${u.platform}::${u.lab}::${u.team}`;
  const tl = teamLeads[key];
  if (!tl) {
    console.warn('No team lead for', key, '— user', u.fullName, 'left unmanaged');
    u.lineManager = null;
    continue;
  }
  const newRef = { name: tl.fullName, email: tl.email };
  if (!u.lineManager || u.lineManager.email !== newRef.email) {
    u.lineManager = newRef;
    rewired++;
  }
}

writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));

// Verify no dangling refs
const emailSet = new Set(users.map((x) => x.email.toLowerCase()));
const dangling = users.filter((u) => u.lineManager?.email && !emailSet.has(u.lineManager.email.toLowerCase()));
const roleCounts = {};
for (const u of users) roleCounts[u.role || '(none)'] = (roleCounts[u.role || '(none)'] || 0) + 1;

console.log('Total users:', users.length);
console.log('Roles:', roleCounts);
console.log('ICs rewired:', rewired);
console.log('Dangling refs after:', dangling.length);
if (dangling.length) console.log('  e.g.', dangling[0].fullName, '->', dangling[0].lineManager?.email);
