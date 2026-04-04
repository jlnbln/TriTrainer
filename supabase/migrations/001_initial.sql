-- Triathlon Training App - Initial Schema

-- Phases
CREATE TABLE phases (
  id SERIAL PRIMARY KEY,
  phase_number INT NOT NULL UNIQUE,
  name JSONB NOT NULL,
  description JSONB,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

-- Weeks
CREATE TABLE weeks (
  id SERIAL PRIMARY KEY,
  phase_id INT REFERENCES phases(id) ON DELETE CASCADE,
  week_number INT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

-- Drills
CREATE TABLE drills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

-- Trainings
CREATE TABLE trainings (
  id SERIAL PRIMARY KEY,
  week_id INT REFERENCES weeks(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  date DATE NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('swim', 'run', 'bike', 'brick', 'rest', 'race')),
  title TEXT NOT NULL,
  description TEXT,
  distance_meters NUMERIC,
  duration_minutes NUMERIC,
  drill_slugs TEXT[] DEFAULT '{}',
  is_modified BOOLEAN DEFAULT false,
  original_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trainings_date ON trainings(date);
CREATE INDEX idx_trainings_week_id ON trainings(week_id);

-- Completions
CREATE TABLE completions (
  id SERIAL PRIMARY KEY,
  training_id INT REFERENCES trainings(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  actual_distance_meters NUMERIC,
  perceived_effort INT CHECK (perceived_effort IS NULL OR perceived_effort BETWEEN 1 AND 10)
);

CREATE INDEX idx_completions_user_id ON completions(user_id);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  name TEXT,
  profile_picture_url TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'de')),
  theme TEXT DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'auto')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Gear
CREATE TABLE gear (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('running_shoes', 'bike', 'goggles', 'wetsuit')),
  name TEXT NOT NULL,
  purchase_date DATE,
  max_distance_km NUMERIC DEFAULT 800,
  retired BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gear_user_id ON gear(user_id);

-- Chat messages
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users to access their own data)
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own completions" ON completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own completions" ON completions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own gear" ON gear FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat" ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- Public read access for training data (not user-specific)
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read phases" ON phases FOR SELECT USING (true);
CREATE POLICY "Anyone can read weeks" ON weeks FOR SELECT USING (true);
CREATE POLICY "Anyone can read drills" ON drills FOR SELECT USING (true);
CREATE POLICY "Anyone can read trainings" ON trainings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update trainings" ON trainings FOR UPDATE TO authenticated USING (true);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
