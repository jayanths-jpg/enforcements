const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getEnforcements: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request(`/enforcements${q ? '?' + q : ''}`);
  },

  getChecks: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return request(`/enforcements/checks${q ? '?' + q : ''}`);
  },

  getStats: () => request('/enforcements/stats'),

  scrapeRange: async (from, to, onProgress) => {
    const dates = getDatesInRange(from, to);
    onProgress({ type: 'start', total: dates.length });

    let succeeded = 0, failed = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      try {
        const result = await request('/scrape/single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        });
        succeeded++;
        onProgress({
          type: 'progress',
          index: i + 1,
          total: dates.length,
          date,
          page_exists: result.page_exists,
          enforcement_count: result.enforcements?.length || 0,
          error: result.error,
        });
      } catch (err) {
        failed++;
        onProgress({
          type: 'progress',
          index: i + 1,
          total: dates.length,
          date,
          error: err.message,
        });
      }
    }

    onProgress({ type: 'done', succeeded, failed });
  },

  scrapeToday: () =>
    request('/scrape/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: new Date().toISOString().split('T')[0] }),
    }),
};

function getDatesInRange(from, to) {
  const dates = [];
  const cur = new Date(from + 'T12:00:00Z');
  const end = new Date(to + 'T12:00:00Z');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}