export default function ColleagueRouteLayer({ floorZones, floorDesks, targetDeskId, targetFloor, currentFloor }) {
  if (currentFloor !== targetFloor) {
    return (
      <div className="route-banner">
        Their desk ({targetDeskId}) is on the {targetFloor} floor — switch floor to draw the route.
      </div>
    );
  }
  const target = floorDesks.find((d) => d.id === targetDeskId);
  if (!target) return null;
  const lobby = floorZones.find((z) => z.isLobby);
  // If no lobby on this floor, anchor from the bottom-centre of the plan.
  const start = lobby
    ? { x: lobby.x + lobby.w / 2, y: lobby.y + lobby.h / 2 }
    : { x: 0.5, y: 0.95 };
  const mid = { x: (start.x + target.x) / 2, y: target.y + 0.04 };

  return (
    <svg className="route-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={`${start.x * 100},${start.y * 100} ${mid.x * 100},${mid.y * 100} ${target.x * 100},${target.y * 100}`}
        fill="none"
        stroke="rgba(33, 150, 243, 0.85)"
        strokeWidth="0.5"
        strokeDasharray="1.5 1"
        strokeLinecap="round"
      />
      <circle cx={start.x * 100} cy={start.y * 100} r="0.9" fill="rgba(33, 150, 243, 0.95)" />
      <circle cx={target.x * 100} cy={target.y * 100} r="1.1" fill="rgba(33, 150, 243, 1)" />
    </svg>
  );
}
