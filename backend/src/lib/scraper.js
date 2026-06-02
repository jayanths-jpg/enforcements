const axios = require('axios');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildFedUrl(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `https://www.federalreserve.gov/newsevents/pressreleases/enforcement${y}${m}${day}a.htm`;
}

async function fetchFedPage(url) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      validateStatus: (s) => s < 600,
    });

    if (res.status === 404) return { exists: false, html: null };

    // 403 means the server blocked us — surface this clearly
    if (res.status === 403) {
      throw new Error(`HTTP 403 Forbidden — the Fed server blocked this request. Check User-Agent or hosting IP.`);
    }

    if (res.status >= 400) return { exists: false, html: null };

    const html = res.data;
    if (
      typeof html !== 'string' ||
      html.includes('Page Not Found') ||
      html.includes('404 - File or directory not found') ||
      html.length < 500
    ) {
      return { exists: false, html: null };
    }

    return { exists: true, html };
  } catch (err) {
    if (err.message.includes('403')) throw err;
    throw new Error(`Failed to fetch Fed page: ${err.message}`);
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractEnforcements(html) {
  const text = stripHtml(html);

  // Find the earliest enforcement-related marker so we don't miss content
  const markers = ['Consent prohibition', 'Consent order', 'institution-affiliated', 'Former employee'];
  let startIdx = 0;
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx > -1) {
      startIdx = Math.max(0, idx - 300);
      break;
    }
  }
  // Fall back to looking for the Federal Reserve Board header
  if (startIdx === 0) {
    const fbIdx = text.indexOf('Federal Reserve Board');
    if (fbIdx > -1) startIdx = fbIdx;
  }

  const snippet = text.slice(startIdx, startIdx + 5000);

  const prompt = `Extract all Federal Reserve enforcement actions from the text below.

Text:
"""
${snippet}
"""

For each enforcement action found, extract:
- person_or_entity: the person/entity name (from "Consent prohibition against [NAME]" or "Consent order against [NAME]")
- individual_affiliation: the full affiliation phrase (e.g. "Former employee of Atlantic Union Bank")
- entity_name: just the bank or institution name
- city: city of the institution
- state: 2-letter US state abbreviation
- offense: the stated reason or crime (e.g. "Embezzlement of bank funds")

Return ONLY valid JSON with no markdown fences, no explanation, nothing else:
{"enforcements":[{"person_or_entity":"...","individual_affiliation":"...","entity_name":"...","city":"...","state":"...","offense":"..."}]}

If no enforcement actions exist: {"enforcements":[]}
Use null for any field that cannot be determined.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 1500,
  });

  const raw = completion.choices[0].message.content
    .replace(/```json|```/g, '')
    .trim();

  return JSON.parse(raw);
}

async function scrapeDate(dateStr) {
  const url = buildFedUrl(dateStr);
  const result = {
    date: dateStr,
    url,
    page_exists: false,
    enforcements: [],
    error: null,
  };

  try {
    const { exists, html } = await fetchFedPage(url);
    result.page_exists = exists;
    if (exists) {
      const extracted = await extractEnforcements(html);
      result.enforcements = extracted.enforcements || [];
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

function getDatesInRange(fromStr, toStr) {
  const dates = [];
  const cur = new Date(fromStr + 'T12:00:00Z');
  const end = new Date(toStr + 'T12:00:00Z');
  while (cur <= end) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

module.exports = { scrapeDate, getDatesInRange, buildFedUrl };
