-- Add race configuration to user profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS race_date DATE DEFAULT '2026-09-06',
  ADD COLUMN IF NOT EXISTS swim_distance_m INT DEFAULT 750,
  ADD COLUMN IF NOT EXISTS bike_distance_km NUMERIC DEFAULT 20,
  ADD COLUMN IF NOT EXISTS run_distance_km NUMERIC DEFAULT 5,
  ADD COLUMN IF NOT EXISTS swim_goal_minutes INT,
  ADD COLUMN IF NOT EXISTS bike_goal_minutes INT,
  ADD COLUMN IF NOT EXISTS run_goal_minutes INT;
