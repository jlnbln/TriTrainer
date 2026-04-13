import { createClient } from '@/lib/supabase/server';
import { PLAN_START } from '@/lib/constants';
import { AnalyticsView } from './analytics-view';

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date().toISOString().split('T')[0];
  const todayDate = new Date(today + 'T12:00:00Z');
  const planStart = new Date(PLAN_START + 'T12:00:00Z');

  // Fetch profile for race config
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('race_date, swim_distance_m, bike_distance_km, run_distance_km, swim_goal_minutes, bike_goal_minutes, run_goal_minutes')
        .eq('id', user.id)
        .single()
    : { data: null };

  const raceConfig = {
    raceDate: profile?.race_date || '2026-09-06',
    swimDistanceM: profile?.swim_distance_m ?? 750,
    bikeDistanceKm: Number(profile?.bike_distance_km ?? 20),
    runDistanceKm: Number(profile?.run_distance_km ?? 5),
    swimGoalMinutes: profile?.swim_goal_minutes ?? null,
    bikeGoalMinutes: profile?.bike_goal_minutes ?? null,
    runGoalMinutes: profile?.run_goal_minutes ?? null,
  };

  const raceDate = new Date(raceConfig.raceDate + 'T12:00:00Z');
  const daysFromStart = Math.floor((todayDate.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(daysFromStart / 7) + 1;
  // Subtract full day (not 1ms) — planStart is noon UTC so -1ms lands on next date string
  const currentWeekEnd = new Date(planStart.getTime() + (currentWeek * 7 - 1) * 24 * 60 * 60 * 1000);
  const currentWeekEndStr = currentWeekEnd.toISOString().split('T')[0];
  const currentWeekStart = new Date(planStart.getTime() + (currentWeek - 1) * 7 * 24 * 60 * 60 * 1000);
  const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0];
  const daysUntilRace = Math.ceil((raceDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  // Fetch trainings
  const { data: trainings } = await supabase
    .from('trainings')
    .select('id, date, sport, title, distance_meters, duration_minutes')
    .order('date', { ascending: true });

  // Fetch completions for this user
  const { data: completions } = user
    ? await supabase
        .from('completions')
        .select(`
          id, training_id, completed_at, actual_distance_meters, workout_duration_seconds,
          avg_heart_rate_bpm, avg_pace_seconds, calories_active, calories_total,
          elevation_meters, avg_cadence_spm, workout_name, effort_level,
          workout_date, workout_data
        `)
        .eq('user_id', user.id)
    : { data: [] };

  const completionByTrainingId = new Map(
    (completions || []).map((c: any) => [c.training_id, c])
  );

  const allTrainings = (trainings || []).map((t: any) => ({
    ...t,
    completion: completionByTrainingId.get(t.id) || null,
  }));

  const relevantTrainings = allTrainings.filter(
    (t: any) => t.date <= currentWeekEndStr && t.sport !== 'rest'
  );
  const completedTrainings = relevantTrainings.filter((t: any) => t.completion !== null);
  const withWorkoutData = completedTrainings.filter((t: any) => t.completion?.workout_data);

  const thisWeekTrainings = allTrainings.filter(
    (t: any) => t.date >= currentWeekStartStr && t.date <= currentWeekEndStr && t.sport !== 'rest'
  );

  return (
    <AnalyticsView
      relevantTrainings={relevantTrainings}
      completedTrainings={completedTrainings}
      withWorkoutData={withWorkoutData}
      thisWeekTrainings={thisWeekTrainings}
      daysUntilRace={daysUntilRace}
      currentWeek={currentWeek}
      totalWeeks={22}
      raceConfig={raceConfig}
    />
  );
}
