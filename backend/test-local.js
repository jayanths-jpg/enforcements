/**
 * LOCAL TEST SCRIPT — run this on YOUR machine before deploying
 *
 * Tests each layer independently:
 *   1. Fed page fetch (checks your server can reach federalreserve.gov)
 *   2. HTML parsing (checks the text extraction logic)
 *   3. OpenAI extraction (checks GPT can parse the content)
 *   4. Supabase write + read (checks DB connection and schema)
 *
 * Usage:
 *   cd backend
 *   cp .env.example .env       # fill in your real keys
 *   npm install
 *   node test-local.js
 *
 * Each test is independent — a failure tells you exactly which layer broke.
 */

require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const TEST_DATE = '2026-05-28';
const TEST_URL = `https://www.federalreserve.gov/newsevents/pressreleases/enforcement${TEST_DATE.replace(/-/g, '')}a.htm`;

const PASS = '\x1b[32m✔\x1b[0m';
const FAIL = '\x1b[31m✘\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

function header(title) {
  console.log(`\n\x1b[1m${'─'.repeat(55)}\x1b[0m`);
  console.log(`\x1b[1m  ${title}\x1b[0m`);
  console.log(`\x1b[1m${'─'.repeat(55)}\x1b[0m`);
}

// ── TEST 1: Fetch the Fed page ───────────────────────────────
async function testFetch() {
  header('TEST 1 — Fetch federalreserve.gov');
  console.log(`${INFO} URL: ${TEST_URL}`);

  try {
    const res = await axios.get(TEST_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      validateStatus: s => s < 600,
    });

    if (res.status === 403) {
      console.log(`${FAIL} Got 403 Forbidden`);
      console.log(`   Reason: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
      console.log(`   Fix: Your server's IP may be blocked. Try from a different machine or add a residential proxy.`);
      return null;
    }
    if (res.status === 404) {
      console.log(`${FAIL} Got 404 — page does not exist for ${TEST_DATE}`);
      return null;
    }
    if (res.status !== 200) {
      console.log(`${FAIL} Unexpected status ${res.status}`);
      return null;
    }

    const html = res.data;
    if (typeof html !== 'string' || html.length < 500) {
      console.log(`${FAIL} Response too short (${html?.length} bytes) — likely an error page`);
      return null;
    }

    console.log(`${PASS} Page fetched successfully`);
    console.log(`   Size: ${(html.length / 1024).toFixed(1)} KB`);
    console.log(`   Has "prohibition": ${html.toLowerCase().includes('prohibition')}`);
    console.log(`   Has "Former employee": ${html.toLowerCase().includes('former employee')}`);
    return html;
  } catch (e) {
    console.log(`${FAIL} Network error: ${e.message}`);
    return null;
  }
}

// ── TEST 2: HTML stripping / text extraction ─────────────────
async function testParsing(html) {
  header('TEST 2 — HTML stripping & text extraction');

  if (!html) {
    // Use a minimal mock HTML so we can still test the parser
    console.log(`${INFO} No live HTML — using mock HTML to test parser logic`);
    html = `
      <html><body>
      <div class="col-xs-12 col-sm-8 col-md-8">
        <h5>May 28, 2026</h5>
        <p>Consent prohibition against Crystal Moore, a former institution-affiliated party of Atlantic Union Bank, Richmond, Virginia</p>
        <p>Former employee of Atlantic Union Bank, Richmond, Virginia</p>
        <p>Embezzlement of bank funds</p>
        <p>Consent prohibition against Jesse Romo, a former institution-affiliated party of Frost Bank, San Antonio, Texas</p>
        <p>Former employee of Frost Bank, San Antonio, Texas</p>
        <p>CARES Act loan fraud</p>
      </div>
      </body></html>
    `;
  }

  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hasProhibition = /prohibition against/i.test(stripped);
  const hasFormerEmployee = /former employee/i.test(stripped);

  console.log(`${hasProhibition ? PASS : FAIL} Found "prohibition against" in stripped text`);
  console.log(`${hasFormerEmployee ? PASS : FAIL} Found "former employee" in stripped text`);

  const startIdx = Math.max(0, stripped.indexOf('Federal Reserve Board'));
  const snippet = stripped.slice(startIdx, startIdx + 3000);
  console.log(`${PASS} Snippet length: ${snippet.length} chars`);
  console.log(`\n${INFO} First 600 chars of extraction snippet:\n`);
  console.log(`   ${snippet.slice(0, 600).replace(/(.{90})/g, '$1\n   ')}`);

  return snippet;
}

// ── TEST 3: OpenAI extraction ────────────────────────────────
async function testOpenAI(snippet) {
  header('TEST 3 — OpenAI extraction');

  if (!process.env.OPENAI_API_KEY) {
    console.log(`${FAIL} OPENAI_API_KEY not set in .env`);
    return null;
  }

  // Use mock snippet if we don't have real one
  const text = snippet || `
    Federal Reserve Board Consent prohibition against Crystal Moore, a former institution-affiliated party 
    of Atlantic Union Bank, Richmond, Virginia. Former employee of Atlantic Union Bank, Richmond, Virginia. 
    Embezzlement of bank funds. 
    Consent prohibition against Jesse Romo, a former institution-affiliated party of Frost Bank, San Antonio, Texas. 
    Former employee of Frost Bank, San Antonio, Texas. CARES Act loan fraud.
  `;

  console.log(`${INFO} Calling OpenAI (gpt-4o-mini)…`);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are extracting Federal Reserve enforcement actions from this page text.

Text:
"""
${text.slice(0, 3000)}
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

    const raw = completion.choices[0].message.content.replace(/```json|```/g, '').trim();
    console.log(`${INFO} Raw OpenAI response:\n   ${raw}`);

    const parsed = JSON.parse(raw);
    const count = parsed.enforcements?.length || 0;

    if (count === 0) {
      console.log(`${FAIL} OpenAI returned 0 enforcements — check the prompt or the HTML snippet`);
    } else {
      console.log(`${PASS} Extracted ${count} enforcement action${count !== 1 ? 's' : ''}`);
      parsed.enforcements.forEach((e, i) => {
        console.log(`\n   [${i + 1}] Person:      ${e.person_or_entity}`);
        console.log(`        Affiliation: ${e.individual_affiliation}`);
        console.log(`        Institution: ${e.entity_name}`);
        console.log(`        Location:    ${e.city}, ${e.state}`);
        console.log(`        Offense:     ${e.offense}`);
      });
    }

    return parsed;
  } catch (e) {
    if (e.status === 401) {
      console.log(`${FAIL} OpenAI auth failed — check OPENAI_API_KEY in .env`);
    } else if (e.message?.includes('JSON')) {
      console.log(`${FAIL} JSON parse error — OpenAI returned non-JSON: ${e.message}`);
    } else {
      console.log(`${FAIL} OpenAI error: ${e.message}`);
    }
    return null;
  }
}

// ── TEST 4: Supabase connection ──────────────────────────────
async function testSupabase(extracted) {
  header('TEST 4 — Supabase connection & write/read');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.log(`${FAIL} SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env`);
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // Test connection by listing tables
  console.log(`${INFO} Testing connection to ${process.env.SUPABASE_URL}`);

  try {
    // Test 4a: verify tables exist
    const { error: tblErr } = await supabase.from('enforcement_checks').select('id').limit(1);
    if (tblErr) {
      if (tblErr.message.includes('does not exist')) {
        console.log(`${FAIL} Table "enforcement_checks" not found`);
        console.log(`   Fix: Run supabase_schema.sql in your Supabase SQL Editor`);
      } else {
        console.log(`${FAIL} Supabase connection error: ${tblErr.message}`);
      }
      return;
    }
    console.log(`${PASS} Connected to Supabase and tables exist`);

    // Test 4b: write a test check row
    const testDate = '1970-01-01'; // use a throwaway date
    const { data: check, error: upsertErr } = await supabase
      .from('enforcement_checks')
      .upsert({
        check_date: testDate,
        url: TEST_URL,
        page_exists: true,
        enforcement_count: 2,
        error: null,
        checked_at: new Date().toISOString(),
      }, { onConflict: 'check_date' })
      .select()
      .single();

    if (upsertErr) {
      console.log(`${FAIL} Upsert to enforcement_checks failed: ${upsertErr.message}`);
      return;
    }
    console.log(`${PASS} Wrote to enforcement_checks (id: ${check.id})`);

    // Test 4c: write enforcement rows
    const enforcements = extracted?.enforcements?.length
      ? extracted.enforcements
      : [
          { person_or_entity: 'Test Person', individual_affiliation: 'Former employee of Test Bank', entity_name: 'Test Bank', city: 'Richmond', state: 'VA', offense: 'Test offense' },
        ];

    await supabase.from('enforcements').delete().eq('check_id', check.id);

    const rows = enforcements.map(e => ({
      check_id: check.id,
      check_date: testDate,
      url: TEST_URL,
      ...e,
    }));

    const { error: enfErr } = await supabase.from('enforcements').insert(rows);
    if (enfErr) {
      console.log(`${FAIL} Insert to enforcements failed: ${enfErr.message}`);
      return;
    }
    console.log(`${PASS} Wrote ${rows.length} row(s) to enforcements`);

    // Test 4d: read back
    const { data: readBack, error: readErr } = await supabase
      .from('enforcements')
      .select('*')
      .eq('check_date', testDate);

    if (readErr) {
      console.log(`${FAIL} Read from enforcements failed: ${readErr.message}`);
      return;
    }
    console.log(`${PASS} Read back ${readBack.length} enforcement row(s)`);

    // Test 4e: clean up test data
    await supabase.from('enforcement_checks').delete().eq('check_date', testDate);
    console.log(`${PASS} Cleaned up test rows`);

  } catch (e) {
    console.log(`${FAIL} Unexpected error: ${e.message}`);
  }
}

// ── TEST 5: End-to-end scraper function ───────────────────────
async function testScraperFunction() {
  header('TEST 5 — Full scraper function (scrapeDate)');
  console.log(`${INFO} Running scrapeDate('${TEST_DATE}') end-to-end…`);
  try {
    const { scrapeDate } = require('./src/lib/scraper');
    const result = await scrapeDate(TEST_DATE);
    console.log(`${result.error ? FAIL : PASS} scrapeDate completed`);
    console.log(`   page_exists:        ${result.page_exists}`);
    console.log(`   enforcements found: ${result.enforcements.length}`);
    if (result.error) console.log(`   error:              ${result.error}`);
    result.enforcements.forEach((e, i) => {
      console.log(`\n   [${i+1}] ${e.person_or_entity} — ${e.entity_name}, ${e.city}, ${e.state}`);
    });
    return result;
  } catch(e) {
    console.log(`${FAIL} scrapeDate threw: ${e.message}`);
    return null;
  }
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  console.log('\n\x1b[1m  Fed Enforcement Monitor — Local Test Suite\x1b[0m');
  console.log(`  Testing against: ${TEST_DATE}`);
  console.log(`  OPENAI_API_KEY:  ${process.env.OPENAI_API_KEY ? '✔ set' : '✘ NOT SET'}`);
  console.log(`  SUPABASE_URL:    ${process.env.SUPABASE_URL ? '✔ set' : '✘ NOT SET'}`);

  const html    = await testFetch();
  const snippet = await testParsing(html);
  const parsed  = await testOpenAI(snippet);
                  await testSupabase(parsed);
                  await testScraperFunction();

  header('SUMMARY');
  console.log('If all tests above show ✔, your deployment should work.');
  console.log('Fix any ✘ before re-deploying to Render/Netlify.\n');
}

main().catch(console.error);
