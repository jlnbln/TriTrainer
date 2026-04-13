-- Add workout data fields to completions table
ALTER TABLE completions
  ADD COLUMN IF NOT EXISTS workout_date DATE,
  ADD COLUMN IF NOT EXISTS workout_name TEXT,
  ADD COLUMN IF NOT EXISTS workout_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS avg_heart_rate_bpm INT,
  ADD COLUMN IF NOT EXISTS avg_pace_seconds INT,       -- seconds/100m for swim, seconds/km for run/bike
  ADD COLUMN IF NOT EXISTS calories_active INT,
  ADD COLUMN IF NOT EXISTS calories_total INT,
  ADD COLUMN IF NOT EXISTS elevation_meters INT,
  ADD COLUMN IF NOT EXISTS avg_cadence_spm INT,
  ADD COLUMN IF NOT EXISTS avg_power_watts INT,
  ADD COLUMN IF NOT EXISTS pool_length_meters INT,
  ADD COLUMN IF NOT EXISTS laps INT,
  ADD COLUMN IF NOT EXISTS effort_level INT CHECK (effort_level IS NULL OR effort_level BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS workout_data JSONB;

-- Allow users to update their own completions (missing from initial migration)
CREATE POLICY IF NOT EXISTS "Users can update own completions"
  ON completions FOR UPDATE
  USING (auth.uid() = user_id);
