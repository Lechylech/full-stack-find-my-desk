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
  listDesks: (date, viewerId) => request(`/desks?date=${date}${viewerId ? `&viewerId=${viewerId}` : ''}`),
  listBookings: ({ date, userId } = {}) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (userId) params.set('userId', userId);
    return request(`/bookings${params.toString() ? `?${params}` : ''}`);
  },
  createBooking: (payload) => request('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  checkIn: (id) => request(`/bookings/${id}/checkin`, { method: 'POST' }),
  release: (id) => request(`/bookings/${id}/release`, { method: 'POST' }),
  cancel: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),
  getSuggestions: (userId, date) => request(`/suggestions?userId=${userId}&date=${date}`),
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
