import { useMemo, useState } from 'react';

const COLUMNS = [
  { key: 'label',    label: 'Desk' },
  { key: 'floor',    label: 'Floor' },
  { key: 'zone',     label: 'Zone' },
  { key: 'platform', label: 'Platform' },
  { key: 'state',    label: 'State' },
  { key: 'attrs',    label: 'Attributes', sortable: false },
  { key: 'occupant', label: 'Occupant' },
];

export default function DeskTable({ desks, onPick }) {
  const [sortKey, setSortKey] = useState('label');
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return desks.filter((d) => {
      if (stateFilter !== 'all' && d.state !== stateFilter) return false;
      if (floorFilter !== 'all' && d.floor !== floorFilter) return false;
      if (!q) return true;
      const hay = `${d.label} ${d.zone} ${d.platform} ${d.occupant?.fullName || ''} ${d.occupant?.team || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [desks, filter, stateFilter, floorFilter]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = sortVal(a, sortKey);
      const bv = sortVal(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return out;
  }, [filtered, sortKey, sortDir]);

  function clickHeader(key, sortable) {
    if (sortable === false) return;
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="desk-table-wrap">
      <div className="desk-table-controls">
        <input
          type="search"
          placeholder="Search desk, zone, occupant…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="all">All states</option>
          <option value="available">Available</option>
          <option value="booked">Booked</option>
          <option value="active">Active</option>
        </select>
        <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
          <option value="all">All floors</option>
          <option value="ground">Ground</option>
          <option value="first">First</option>
        </select>
        <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 'auto' }}>
          {sorted.length} of {desks.length}
        </span>
      </div>
      <div className="desk-table-scroll">
        <table className="desk-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => clickHeader(c.key, c.sortable)} className={c.sortable === false ? '' : 'sortable'}>
                  {c.label}{sortKey === c.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                </th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.id} className={d.state}>
                <td>{d.label}</td>
                <td>{d.floor === 'ground' ? 'G' : '1'}</td>
                <td>{d.zone}</td>
                <td>{d.platform}</td>
                <td><span className={`state-pill ${d.state}`}>{d.state}</span></td>
                <td className="attr-cell">
                  {d.attributes?.dualMonitor && <span title="Dual monitor">2M</span>}
                  {d.attributes?.nearWindow && <span title="Window">W</span>}
                  {d.attributes?.quietZone && <span title="Quiet">Q</span>}
                  {d.attributes?.heightAdjustable && <span title="Height adjustable">H</span>}
                  {d.attributes?.wheelchairAccess && <span title="Wheelchair access">♿</span>}
                  {d.hotDesk && <span title="Hot-desk">🔥</span>}
                </td>
                <td>{d.occupant?.fullName || '—'}{d.occupant?.team ? ` · ${d.occupant.team}` : ''}</td>
                <td style={{ textAlign: 'right' }}>
                  {d.state === 'available' && (
                    <button onClick={() => onPick(d)}>Book</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sortVal(d, key) {
  if (key === 'occupant') return d.occupant?.fullName?.toLowerCase() || '';
  if (key === 'floor') return d.floor === 'ground' ? 0 : 1;
  return (d[key] ?? '').toString().toLowerCase();
}
