const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { scrapeDate, getDatesInRange, buildFedUrl } = require('../lib/scraper');

// Middleware: verify cron secret for automated triggers
function verifyCronSecret(req, res, next) {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Save a scrape result to Supabase
async function saveResult(result) {
  // Upsert the daily check record
  const { data: check, error: checkErr } = await supabase
    .from('enforcement_checks')
    .upsert(
      {
        check_date: result.date,
        url: result.url,
        page_exists: result.page_exists,
        enforcement_count: result.enforcements.length,
        error: result.error,
        checked_at: new Date().toISOString(),
      },
      { onConflict: 'check_date' }
    )
    .select()
    .single();

  if (checkErr) throw new Error(`Check upsert failed: ${checkErr.message}`);

  // Delete old enforcements for this date then reinsert
  if (result.page_exists && result.enforcements.length > 0) {
    await supabase
      .from('enforcements')
      .delete()
      .eq('check_id', check.id);

    const rows = result.enforcements.map((e) => ({
      check_id: check.id,
      check_date: result.date,
      url: result.url,
      person_or_entity: e.person_or_entity,
      individual_affiliation: e.individual_affiliation,
      entity_name: e.entity_name,
      city: e.city,
      state: e.state,
      offense: e.offense,
    }));

    const { error: enfErr } = await supabase.from('enforcements').insert(rows);
    if (enfErr) throw new Error(`Enforcements insert failed: ${enfErr.message}`);
  }

  return check;
}

// POST /api/scrape/today  — called by cron-job.org daily
router.post('/today', verifyCronSecret, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await scrapeDate(today);
    await saveResult(result);
    res.json({
      date: today,
      page_exists: result.page_exists,
      enforcement_count: result.enforcements.length,
      error: result.error,
    });
  } catch (err) {
    console.error('Cron scrape error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scrape/range  — manual backfill: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
router.post('/range', async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to dates required' });

  const dates = getDatesInRange(from, to);
  if (dates.length > 60) return res.status(400).json({ error: 'Max 60 days per request' });

  // Stream progress via SSE so the frontend can show a live log
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'start', total: dates.length });

  let succeeded = 0, failed = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    try {
      const result = await scrapeDate(date);
      await saveResult(result);
      succeeded++;
      send({
        type: 'progress',
        index: i + 1,
        total: dates.length,
        date,
        page_exists: result.page_exists,
        enforcement_count: result.enforcements.length,
        error: result.error,
      });
    } catch (err) {
      failed++;
      send({ type: 'progress', index: i + 1, total: dates.length, date, error: err.message });
    }
    // Small delay to be polite to the Fed's server
    await new Promise((r) => setTimeout(r, 500));
  }

  send({ type: 'done', succeeded, failed });
  res.end();
});

// POST /api/scrape/single — scrape one specific date: { date: "YYYY-MM-DD" }
router.post('/single', async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });

  try {
    const result = await scrapeDate(date);
    await saveResult(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
