export type Sport = 'swim' | 'run' | 'bike' | 'brick' | 'rest' | 'race';

export interface Phase {
  phaseNumber: number;
  name: { en: string; de: string };
  description: { en: string; de: string };
  startDate: string;
  endDate: string;
}

export interface Week {
  weekNumber: number;
  phaseNumber: number;
  label: string;
  startDate: string;
  endDate: string;
}

export interface Training {
  id: number;
  weekNumber: number;
  dayOfWeek: number; // 0=Mon, 6=Sun
  date: string;
  sport: Sport;
  title: string;
  description: string;
  distanceMeters: number | null;
  durationMinutes: number | null;
  drillSlugs: string[];
  isModified: boolean;
  originalDescription: string | null;
}

export interface Drill {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export interface Completion {
  id: number;
  trainingId: number;
  userId: string;
  completedAt: string;
  notes: string | null;
  actualDistanceMeters: number | null;
  perceivedEffort: number | null;
  stravaActivityId: number | null;
}

export interface StravaActivity {
  id: number;
  stravaId: number;
  userId: string;
  sportType: string;
  activityDate: string;
  durationSeconds: number | null;
  distanceMeters: number | null;
  avgHeartRateBpm: number | null;
  avgPaceSeconds: number | null;
  caloriesActive: number | null;
  elevationMeters: number | null;
  avgCadenceSpm: number | null;
  avgPowerWatts: number | null;
  poolLengthMeters: number | null;
  laps: number | null;
  activityName: string | null;
  rawData: Record<string, unknown>;
  trainingId: number | null;
  syncedAt: string;
}

export interface GearItem {
  id: number;
  userId: string;
  type: string;
  name: string;
  purchaseDate: string | null;
  maxDistanceKm: number;
  retired: boolean;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  profilePictureUrl: string | null;
  heightCm: number | null;
  weightKg: number | null;
  language: 'en' | 'de';
  theme: 'light' | 'dark' | 'auto';
}

export interface ChatMessage {
  id: number;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface TrainingWithCompletion extends Training {
  completion: Completion | null;
  week: Week;
  phase: Phase;
  drills: Drill[];
}
