-- Allow users to dismiss unlinked Strava activities so they won't be shown or re-processed
ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS dismissed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_strava_activities_pending
  ON strava_activities(user_id)
  WHERE training_id IS NULL AND dismissed = false;
