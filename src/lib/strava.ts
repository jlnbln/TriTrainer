import type { Sport } from './types';
import type { WorkoutData } from '@/app/(app)/training/[id]/actions';

const STRAVA_SPORT_MAP: Record<string, Sport> = {
  Swim: 'swim',
  OpenWaterSwim: 'swim',
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Ride: 'bike',
  VirtualRide: 'bike',
  GravelRide: 'bike',
  MountainBikeRide: 'bike',
  EBikeRide: 'bike',
};

export function translateSport(stravaType: string): Sport | null {
  return STRAVA_SPORT_MAP[stravaType] ?? null;
}

export interface StravaRawActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  average_heartrate?: number;
  average_speed?: number;
  total_elevation_gain?: number;
  average_cadence?: number;
  average_watts?: number;
  kilojoules?: number;
  calories?: number;
  pool_length?: number;
  lap_count?: number;
}

export interface MappedStravaActivity {
  strava_id: number;
  sport_type: Sport;
  activity_date: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  avg_heart_rate_bpm: number | null;
  avg_pace_seconds: number | null;
  calories_active: number | null;
  elevation_meters: number | null;
  avg_cadence_spm: number | null;
  avg_power_watts: number | null;
  pool_length_meters: number | null;
  laps: number | null;
  activity_name: string;
  raw_data: StravaRawActivity;
}

export function mapStravaActivity(raw: StravaRawActivity, sport: Sport): MappedStravaActivity {
  const avgSpeed = raw.average_speed ?? 0;

  let avgPaceSeconds: number | null = null;
  if (avgSpeed > 0) {
    avgPaceSeconds = sport === 'swim'
      ? Math.round(100 / avgSpeed)
      : Math.round(1000 / avgSpeed);
  }

  const activityDate = raw.start_date.split('T')[0];

  return {
    strava_id: raw.id,
    sport_type: sport,
    activity_date: activityDate,
    duration_seconds: raw.moving_time || raw.elapsed_time || null,
    distance_meters: raw.distance > 0 ? raw.distance : null,
    avg_heart_rate_bpm: raw.average_heartrate ? Math.round(raw.average_heartrate) : null,
    avg_pace_seconds: avgPaceSeconds,
    calories_active: raw.calories ? Math.round(raw.calories) : (raw.kilojoules ? Math.round(raw.kilojoules * 0.239) : null),
    elevation_meters: raw.total_elevation_gain ? Math.round(raw.total_elevation_gain) : null,
    avg_cadence_spm: raw.average_cadence ? Math.round(raw.average_cadence) : null,
    avg_power_watts: raw.average_watts ? Math.round(raw.average_watts) : null,
    pool_length_meters: raw.pool_length ?? null,
    laps: raw.lap_count ?? null,
    activity_name: raw.name,
    raw_data: raw,
  };
}

export function buildWorkoutData(mapped: MappedStravaActivity): WorkoutData {
  return {
    workout_name: mapped.activity_name,
    workout_date: mapped.activity_date,
    sport_type: mapped.sport_type,
    duration_seconds: mapped.duration_seconds,
    distance_meters: mapped.distance_meters,
    avg_heart_rate_bpm: mapped.avg_heart_rate_bpm,
    avg_pace_seconds: mapped.avg_pace_seconds,
    calories_active: mapped.calories_active,
    calories_total: null,
    elevation_meters: mapped.elevation_meters,
    avg_cadence_spm: mapped.avg_cadence_spm,
    avg_power_watts: mapped.avg_power_watts,
    pool_length_meters: mapped.pool_length_meters,
    laps: mapped.laps,
    effort_level: null,
    sub_activities: null,
    raw_text: null,
  };
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokenResponse> {
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(`Strava token refresh failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchStravaActivities(
  accessToken: string,
  after: number,
): Promise<StravaRawActivity[]> {
  const all: StravaRawActivity[] = [];
  let page = 1;

  while (true) {
    const url = new URL('https://www.strava.com/api/v3/athlete/activities');
    url.searchParams.set('after', String(after));
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Strava API error: ${response.status}`);
    }

    const activities: StravaRawActivity[] = await response.json();
    all.push(...activities);

    if (activities.length < 100) break;
    page++;
  }

  return all;
}

export function getISOWeekKey(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
