const axios = require('axios');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildFedUrl(date) {
  // date is a Date object or YYYY-MM-DD string
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
        'User-Agent': 'Mozilla/5.0 (compatible; EnforcementMonitor/1.0)',
        'Accept': 'text/html',
      },
      validateStatus: (s) => s < 500,
    });

    if (res.status === 404) return { exists: false, html: null };

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

async function extractEnforcements(html, url) {
  const text = stripHtml(html);
  // Focus on the enforcement content section
  const startIdx = Math.max(0, text.indexOf('Federal Reserve Board'));
  const snippet = text.slice(startIdx, startIdx + 4000);

  const prompt = `You are extracting Federal Reserve enforcement actions from this page text.

Text:
"""
${snippet}
"""

Extract ALL enforcement actions. Each action has this pattern:
  "Consent prohibition against [NAME]" or "Consent order against [NAME]"
  "Former employee of [BANK], [CITY], [STATE]"
  [optional offense line]

Return ONLY valid JSON (no markdown, no explanation):
{
  "enforcements": [
    {
      "person_or_entity": "full name",
      "individual_affiliation": "Former employee of X" phrase or null,
      "entity_name": "bank/institution name only",
      "city": "city name",
      "state": "2-letter state code",
      "offense": "stated reason/crime or null"
    }
  ]
}

If no enforcement actions found: {"enforcements": []}
Use null for any missing field.`;

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
      const extracted = await extractEnforcements(html, url);
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
