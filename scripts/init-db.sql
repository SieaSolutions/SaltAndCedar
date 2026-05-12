-- Salt & Cedar Leads — Neon Postgres schema

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  daily_target INTEGER NOT NULL DEFAULT 200,
  cities TEXT[] NOT NULL DEFAULT '{}',
  min_rent NUMERIC NOT NULL DEFAULT 900,
  min_beds INTEGER NOT NULL DEFAULT 3,
  is_furnished BOOLEAN NOT NULL DEFAULT TRUE,
  days_back INTEGER NOT NULL DEFAULT 1,
  max_results_per_city INTEGER NOT NULL DEFAULT 25
);

INSERT INTO settings (id, daily_target, cities, min_rent, min_beds, is_furnished, days_back, max_results_per_city)
VALUES (1, 200, '{}', 900, 3, TRUE, 1, 25)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  owner_name TEXT,
  first_name TEXT,
  last_name TEXT,
  owner_number TEXT,
  owner_email TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  source TEXT NOT NULL DEFAULT 'ForRent',
  address TEXT,
  city TEXT,
  state TEXT,
  zipcode TEXT,
  beds NUMERIC,
  baths NUMERIC,
  rent_price NUMERIC,
  lat NUMERIC,
  long NUMERIC,
  url TEXT,
  zid TEXT,
  date_scraped TIMESTAMPTZ DEFAULT NOW(),
  ghl_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT leads_status_chk CHECK (
    status IN (
      'New',
      'GHL',
      'AlreadyInGHL',
      'Failed',
      'Lost',
      'Won',
      'manuallyContacted'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_number ON leads (owner_number);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_date_scraped_ny_date ON leads (((date_scraped AT TIME ZONE 'America/New_York')::date));

CREATE TABLE IF NOT EXISTS runs (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  target INTEGER,
  leads_found INTEGER DEFAULT 0,
  leads_sent INTEGER DEFAULT 0,
  cities_processed TEXT[] NOT NULL DEFAULT '{}',
  CONSTRAINT runs_type_chk CHECK (type IN ('leadgen', 'ghl')),
  CONSTRAINT runs_status_chk CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_runs_type_started ON runs (type, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS runs_one_leadgen_per_cal_day
ON runs (
  type,
  ((started_at AT TIME ZONE 'America/New_York')::date)
)
WHERE type = 'leadgen' AND status IN ('running', 'completed');
