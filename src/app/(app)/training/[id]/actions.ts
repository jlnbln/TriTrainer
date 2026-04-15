'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function markComplete(trainingId: string, distanceMeters: number | null, notes: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('completions').upsert({
    training_id: trainingId,
    user_id: user.id,
    notes: notes || null,
    actual_distance_meters: distanceMeters,
  }, { onConflict: 'training_id' });

  revalidatePath('/home');
  revalidatePath('/plan');
  revalidatePath(`/training/${trainingId}`);
}

export async function markIncomplete(trainingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('completions').delete().eq('training_id', trainingId).eq('user_id', user.id);

  revalidatePath('/home');
  revalidatePath('/plan');
  revalidatePath(`/training/${trainingId}`);
}

export async function updateNotes(trainingId: string, notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('completions')
    .update({ notes: notes || null })
    .eq('training_id', trainingId)
    .eq('user_id', user.id);
}

export interface WorkoutData {
  workout_name: string | null;
  workout_date: string | null;
  sport_type: string | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  avg_heart_rate_bpm: number | null;
  avg_pace_seconds: number | null;
  calories_active: number | null;
  calories_total: number | null;
  elevation_meters: number | null;
  avg_cadence_spm: number | null;
  avg_power_watts: number | null;
  pool_length_meters: number | null;
  laps: number | null;
  effort_level: number | null;
  sub_activities: unknown[] | null;
  raw_text: string | null;
}

export interface RaceSegmentResults {
  swim_seconds: number | null;
  t1_seconds: number | null;
  bike_seconds: number | null;
  t2_seconds: number | null;
  run_seconds: number | null;
}

export async function saveRaceResults(trainingId: string, segments: RaceSegmentResults) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const total_seconds = [
    segments.swim_seconds, segments.t1_seconds, segments.bike_seconds,
    segments.t2_seconds, segments.run_seconds,
  ].reduce((sum: number, s) => sum + (s ?? 0), 0);

  await supabase.from('completions').upsert({
    training_id: trainingId,
    user_id: user.id,
    workout_duration_seconds: total_seconds || null,
    workout_data: { type: 'race_manual', ...segments, total_seconds: total_seconds || null },
  }, { onConflict: 'training_id' });

  revalidatePath('/home');
  revalidatePath('/plan');
  revalidatePath('/analytics');
  revalidatePath(`/training/${trainingId}`);
}

export async function saveWorkoutData(trainingId: string, workout: WorkoutData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Upsert completion with workout data (marks as complete)
  await supabase.from('completions').upsert({
    training_id: trainingId,
    user_id: user.id,
    actual_distance_meters: workout.distance_meters,
    workout_date: workout.workout_date,
    workout_name: workout.workout_name,
    workout_duration_seconds: workout.duration_seconds,
    avg_heart_rate_bpm: workout.avg_heart_rate_bpm,
    avg_pace_seconds: workout.avg_pace_seconds,
    calories_active: workout.calories_active,
    calories_total: workout.calories_total,
    elevation_meters: workout.elevation_meters,
    avg_cadence_spm: workout.avg_cadence_spm,
    avg_power_watts: workout.avg_power_watts,
    pool_length_meters: workout.pool_length_meters,
    laps: workout.laps,
    effort_level: workout.effort_level,
    workout_data: workout,
  }, { onConflict: 'training_id' });

  revalidatePath('/home');
  revalidatePath('/plan');
  revalidatePath('/analytics');
  revalidatePath(`/training/${trainingId}`);
}
