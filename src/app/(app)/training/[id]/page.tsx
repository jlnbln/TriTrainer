import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TrainingDetail } from './training-detail';
import { RaceDayView } from './race-day-view';

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<TrainingDetailSkeleton />}>
      <TrainingContent id={id} />
    </Suspense>
  );
}

async function TrainingContent({ id }: { id: string }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: training } = await supabase
    .from('trainings')
    .select(`
      *,
      weeks!inner (
        week_number, label,
        phases!inner (phase_number, name, description)
      )
    `)
    .eq('id', id)
    .single();

  if (!training) notFound();

  // drills, completion, optional race config, and unlinked strava activities fetched in parallel
  const isRace = training.sport === 'race';
  const isTrackableSport = ['swim', 'run', 'bike', 'brick'].includes(training.sport);
  const [drills, completion, raceProfile, unlinkedStravaActivities] = await Promise.all([
    training.drill_slugs?.length
      ? supabase
          .from('drills')
          .select('*')
          .in('slug', training.drill_slugs)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    session
      ? supabase
          .from('completions')
          .select(`
            id, completed_at, notes, actual_distance_meters, perceived_effort,
            workout_date, workout_name, workout_duration_seconds,
            avg_heart_rate_bpm, avg_pace_seconds, calories_active, calories_total,
            elevation_meters, avg_cadence_spm, avg_power_watts,
            pool_length_meters, laps, effort_level, workout_data
          `)
          .eq('training_id', id)
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    isRace && session
      ? supabase
          .from('profiles')
          .select('swim_distance_m, bike_distance_km, run_distance_km, swim_goal_minutes, bike_goal_minutes, run_goal_minutes')
          .eq('id', session.user.id)
          .single()
          .then((r) => r.data)
      : Promise.resolve(null),
    session && isTrackableSport
      ? supabase
          .from('strava_activities')
          .select('id, sport_type, activity_date, distance_meters, duration_seconds, activity_name')
          .eq('user_id', session.user.id)
          .eq('sport_type', training.sport)
          .is('training_id', null)
          .order('activity_date', { ascending: false })
          .limit(10)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const trainingWithCompletion = { ...training, completions: completion ? [completion] : [] };

  if (isRace) {
    const raceConfig = {
      swimDistanceM:    raceProfile?.swim_distance_m    ?? 750,
      bikeDistanceKm:   Number(raceProfile?.bike_distance_km   ?? 20),
      runDistanceKm:    Number(raceProfile?.run_distance_km    ?? 5),
      swimGoalMinutes:  raceProfile?.swim_goal_minutes  ?? null,
      bikeGoalMinutes:  raceProfile?.bike_goal_minutes  ?? null,
      runGoalMinutes:   raceProfile?.run_goal_minutes   ?? null,
    };
    return (
      <RaceDayView
        training={trainingWithCompletion}
        userId={session?.user.id || ''}
        raceConfig={raceConfig}
      />
    );
  }

  return (
    <TrainingDetail
      training={trainingWithCompletion}
      drills={drills}
      userId={session?.user.id || ''}
      unlinkedStravaActivities={unlinkedStravaActivities}
    />
  );
}

function TrainingDetailSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-6 space-y-4">
      <div className="h-8 w-48 rounded-full bg-muted animate-pulse" />
      <div className="h-64 rounded-2xl bg-card border border-border/40 animate-pulse" />
      <div className="h-32 rounded-2xl bg-card border border-border/40 animate-pulse" />
    </div>
  );
}
