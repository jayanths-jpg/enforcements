const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// GET /api/enforcements?from=YYYY-MM-DD&to=YYYY-MM-DD&state=TX&search=moore
router.get('/', async (req, res) => {
  try {
    const { from, to, state, search, page = 1, limit = 200 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('enforcements')
      .select('*', { count: 'exact' })
      .order('check_date', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (from) query = query.gte('check_date', from);
    if (to) query = query.lte('check_date', to);
    if (state) query = query.eq('state', state.toUpperCase());
    if (search) {
      query = query.or(
        `person_or_entity.ilike.%${search}%,entity_name.ilike.%${search}%,city.ilike.%${search}%,offense.ilike.%${search}%,individual_affiliation.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/enforcements/checks?from=&to= — daily check summary
router.get('/checks', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = supabase
      .from('enforcement_checks')
      .select('*')
      .order('check_date', { ascending: false });

    if (from) query = query.gte('check_date', from);
    if (to) query = query.lte('check_date', to);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/enforcements/stats — summary metrics
router.get('/stats', async (req, res) => {
  try {
    const { data: totalChecks } = await supabase
      .from('enforcement_checks')
      .select('id', { count: 'exact', head: true });

    const { count: totalEnforcements } = await supabase
      .from('enforcements')
      .select('id', { count: 'exact', head: true });

    const { count: daysWithActions } = await supabase
      .from('enforcement_checks')
      .select('id', { count: 'exact', head: true })
      .gt('enforcement_count', 0);

    const { data: recentChecks } = await supabase
      .from('enforcement_checks')
      .select('check_date')
      .order('check_date', { ascending: false })
      .limit(1);

    res.json({
      total_checks: totalChecks?.count || 0,
      total_enforcements: totalEnforcements || 0,
      days_with_actions: daysWithActions || 0,
      last_checked: recentChecks?.[0]?.check_date || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
