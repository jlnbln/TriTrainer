-- Profiles: OAuth tokens + sync metadata
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS strava_athlete_id       BIGINT,
  ADD COLUMN IF NOT EXISTS strava_access_token     TEXT,
  ADD COLUMN IF NOT EXISTS strava_refresh_token    TEXT,
  ADD COLUMN IF NOT EXISTS strava_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS strava_last_sync_at     TIMESTAMPTZ;

-- Caches all synced Strava activities; training_id NULL = unlinked/pending manual assignment
CREATE TABLE IF NOT EXISTS strava_activities (
  id                   BIGSERIAL PRIMARY KEY,
  strava_id            BIGINT NOT NULL,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_type           TEXT NOT NULL CHECK (sport_type IN ('swim','run','bike','brick')),
  activity_date        DATE NOT NULL,
  duration_seconds     INT,
  distance_meters      NUMERIC,
  avg_heart_rate_bpm   INT,
  avg_pace_seconds     INT,
  calories_active      INT,
  elevation_meters     INT,
  avg_cadence_spm      INT,
  avg_power_watts      INT,
  pool_length_meters   INT,
  laps                 INT,
  activity_name        TEXT,
  raw_data             JSONB NOT NULL,
  training_id          INT REFERENCES trainings(id) ON DELETE SET NULL,
  synced_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (strava_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_strava_activities_user      ON strava_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date ON strava_activities(user_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_strava_activities_unlinked  ON strava_activities(user_id, training_id) WHERE training_id IS NULL;

ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own strava activities"
  ON strava_activities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Link completions back to the Strava activity that sourced them
ALTER TABLE completions
  ADD COLUMN IF NOT EXISTS strava_activity_id BIGINT REFERENCES strava_activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_completions_strava ON completions(strava_activity_id) WHERE strava_activity_id IS NOT NULL;
