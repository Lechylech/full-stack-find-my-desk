const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getMe: () => request('/me'),
  setMe: (id) => request('/me', { method: 'POST', body: JSON.stringify({ id }) }),
  listUsers: () => request('/users'),
  getUser: (id) => request(`/users/${id}`),
  setPrivacy: (id, privacy) => request(`/users/${id}/privacy`, { method: 'PATCH', body: JSON.stringify({ privacy }) }),
  setPreferences: (id, body) => request(`/users/${id}/preferences`, { method: 'PATCH', body: JSON.stringify(body) }),
  listDelegations: (id) => request(`/users/${id}/delegations`),
  listDesks: (date, viewerId) => request(`/desks?date=${date}${viewerId ? `&viewerId=${viewerId}` : ''}`),
  listBookings: ({ date, userId } = {}) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (userId) params.set('userId', userId);
    return request(`/bookings${params.toString() ? `?${params}` : ''}`);
  },
  createBooking: (payload) => request('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  bulkBook: (payload) => request('/bookings/bulk', { method: 'POST', body: JSON.stringify(payload) }),
  checkIn: (id, actorId) => request(`/bookings/${id}/checkin`, { method: 'POST', body: JSON.stringify({ actorId }) }),
  release: (id, actorId) => request(`/bookings/${id}/release`, { method: 'POST', body: JSON.stringify({ actorId }) }),
  cancel: (id, actorId) => request(`/bookings/${id}${actorId ? `?actorId=${actorId}` : ''}`, { method: 'DELETE' }),
  getSuggestions: (userId, date) => request(`/suggestions?userId=${userId}&date=${date}`),
  savePositions: (userId, updates) => request('/desks/positions', { method: 'PATCH', body: JSON.stringify({ userId, updates }) }),
  sendReminder: (userId, date) => request('/reminders/send', { method: 'POST', body: JSON.stringify({ userId, date }) }),
  listRooms: (date) => request(`/rooms?date=${date}`),
  bookRoom: (roomId, payload) => request(`/rooms/${roomId}/book`, { method: 'POST', body: JSON.stringify(payload) }),
  admin: {
    listDelegations: (actorId) => request(`/admin/delegations?actorId=${actorId}`),
    addDelegation: (actorId, delegatorId, onBehalfOfId) => request('/admin/delegations', { method: 'POST', body: JSON.stringify({ actorId, delegatorId, onBehalfOfId }) }),
    removeDelegation: (actorId, delegatorId, onBehalfOfId) => request('/admin/delegations', { method: 'DELETE', body: JSON.stringify({ actorId, delegatorId, onBehalfOfId }) }),
    insights: (actorId, from, to) => request(`/admin/insights?actorId=${actorId}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`),
    insightsCsvUrl: (actorId, from, to) => `${BASE}/admin/insights/csv?actorId=${actorId}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`,
    bookingAudit: (actorId, bookingId) => request(`/admin/audit/${bookingId}?actorId=${actorId}`),
  },
  config: {
    get: (actorId) => request(`/config?actorId=${actorId}`),
    set: (key, actorId, value) => request(`/config/${key}`, { method: 'PATCH', body: JSON.stringify({ actorId, value }) }),
  },
  sentient: {
    getScenario: (name) => request(`/sentient/scenarios/${name}`),
    getZones: () => request('/sentient/zones'),
    getNetwork: () => request('/sentient/network'),
    getWellness: () => request('/sentient/wellness'),
    getBookings: () => request('/sentient/bookings'),
    releaseGhost: (id) => request('/sentient/release', { method: 'POST', body: JSON.stringify({ id }) }),
    resetReleases: () => request('/sentient/reset-releases', { method: 'POST' }),
  },
};
