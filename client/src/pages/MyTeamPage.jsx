import BulkBookPanel from '../components/BulkBookPanel.jsx';

export default function MyTeamPage({ me }) {
  return (
    <main className="main" style={{ gridTemplateColumns: '1fr' }}>
      <BulkBookPanel me={me} />
      <NoTeamFallback me={me} />
    </main>
  );
}

function NoTeamFallback({ me }) {
  // BulkBookPanel hides itself when there are no direct reports. Show a
  // friendly message in that case so the page isn't completely blank.
  // We can't read its internal state, so render a quiet hint that's
  // hidden whenever BulkBookPanel actually renders content above it.
  return (
    <div id="my-team-empty" className="panel" style={{ color: 'var(--muted)' }}>
      <h2>My team</h2>
      <p>
        Hi {me.fullName}. If you line-manage direct reports, you'll see a "Book for my team"
        panel above with a one-click bulk booker. If this is the only thing visible, your
        direct-report list is currently empty.
      </p>
    </div>
  );
}
