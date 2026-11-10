-- ClaimDeadline schema. Safe to re-run.

CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  payout_estimate TEXT,
  deadline DATE NOT NULL,
  deadline_note TEXT,
  proof_required BOOLEAN,
  eligibility TEXT NOT NULL,
  claim_url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  category TEXT NOT NULL,
  states TEXT[] NOT NULL DEFAULT '{}',
  case_name TEXT,
  fund_amount TEXT,
  published_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entries_deadline_idx ON entries (deadline);
CREATE INDEX IF NOT EXISTS entries_status_idx ON entries (status);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  official_url TEXT NOT NULL,
  deadline DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signups (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS zero_result_searches (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pageviews (
  id SERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  viewed_on DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (path, viewed_on)
);

CREATE TABLE IF NOT EXISTS sponsor_weeks (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  sponsor_name TEXT NOT NULL,
  tagline TEXT,
  url TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsor_clicks (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL,
  target_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sponsor_clicks_slug_idx ON sponsor_clicks (slug);

CREATE TABLE IF NOT EXISTS sponsor_inquiries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS errors (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
