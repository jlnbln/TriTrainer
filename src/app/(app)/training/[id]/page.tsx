import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { TrainingDetail } from './training-detail';

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  // Fetch drills if this training references any
  let drills: any[] = [];
  if (training.drill_slugs && training.drill_slugs.length > 0) {
    const { data } = await supabase
      .from('drills')
      .select('*')
      .in('slug', training.drill_slugs);
    drills = data || [];
  }

  // Fetch completion separately with explicit user filter
  const { data: completion } = user
    ? await supabase
        .from('completions')
        .select(`
          id, completed_at, notes, actual_distance_meters, perceived_effort,
          workout_date, workout_name, workout_duration_seconds,
          avg_heart_rate_bpm, avg_pace_seconds, calories_active, calories_total,
          elevation_meters, avg_cadence_spm, avg_power_watts,
          pool_length_meters, laps, effort_level, workout_data
        `)
        .eq('training_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const trainingWithCompletion = { ...training, completions: completion ? [completion] : [] };

  return (
    <TrainingDetail
      training={trainingWithCompletion}
      drills={drills}
      userId={user?.id || ''}
    />
  );
}
