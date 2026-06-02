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

  scrapeRange: (from, to, onProgress) => {
    return new Promise((resolve, reject) => {
      const url = `${BASE}/scrape/range`;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
        .then((res) => {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          function pump() {
            return reader.read().then(({ done, value }) => {
              if (done) { resolve(); return; }
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop();
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    onProgress?.(data);
                    if (data.type === 'done') resolve(data);
                  } catch {}
                }
              }
              return pump();
            });
          }
          return pump();
        })
        .catch(reject);
    });
  },

  scrapeToday: () =>
    request('/scrape/single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: new Date().toISOString().split('T')[0] }),
    }),
};
