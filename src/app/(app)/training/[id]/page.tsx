import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TrainingDetail } from './training-detail';
import { getTrainingWithDetails, getDrillsBySlugs } from '@/lib/data';

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

  // training is cached — returns instantly on repeat visits
  const training = await getTrainingWithDetails(id);
  if (!training) notFound();

  // drills (cached) and completion are independent — fetch in parallel
  const [drills, completion] = await Promise.all([
    training.drill_slugs?.length
      ? getDrillsBySlugs(training.drill_slugs)
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
  ]);

  const trainingWithCompletion = { ...training, completions: completion ? [completion] : [] };

  return (
    <TrainingDetail
      training={trainingWithCompletion}
      drills={drills}
      userId={session?.user.id || ''}
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
