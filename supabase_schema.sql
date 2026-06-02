-- ============================================================
-- Fed Enforcement Monitor — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Table 1: one row per date checked
CREATE TABLE IF NOT EXISTS enforcement_checks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date   date NOT NULL UNIQUE,
  url          text NOT NULL,
  page_exists  boolean NOT NULL DEFAULT false,
  enforcement_count integer NOT NULL DEFAULT 0,
  error        text,
  checked_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checks_date ON enforcement_checks (check_date DESC);

-- Table 2: one row per enforcement action extracted
CREATE TABLE IF NOT EXISTS enforcements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id              uuid REFERENCES enforcement_checks(id) ON DELETE CASCADE,
  check_date            date NOT NULL,
  url                   text,
  person_or_entity      text,
  individual_affiliation text,
  entity_name           text,
  city                  text,
  state                 char(2),
  offense               text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enforcements_date  ON enforcements (check_date DESC);
CREATE INDEX IF NOT EXISTS idx_enforcements_state ON enforcements (state);
CREATE INDEX IF NOT EXISTS idx_enforcements_check ON enforcements (check_id);

-- Full-text search index for fast keyword queries
CREATE INDEX IF NOT EXISTS idx_enforcements_fts ON enforcements
  USING gin(to_tsvector('english',
    coalesce(person_or_entity,'') || ' ' ||
    coalesce(individual_affiliation,'') || ' ' ||
    coalesce(entity_name,'') || ' ' ||
    coalesce(city,'') || ' ' ||
    coalesce(offense,'')
  ));

-- Enable Row Level Security (data is read-only publicly, writes via service key only)
ALTER TABLE enforcement_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE enforcements ENABLE ROW LEVEL SECURITY;

-- Allow public read access (frontend reads directly from API, but this is good practice)
CREATE POLICY "Public read checks"
  ON enforcement_checks FOR SELECT USING (true);

CREATE POLICY "Public read enforcements"
  ON enforcements FOR SELECT USING (true);

-- ============================================================
-- Verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================
