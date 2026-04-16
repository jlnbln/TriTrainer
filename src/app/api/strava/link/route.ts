import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { buildWorkoutData } from '@/lib/strava';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { stravaActivityId, trainingId } = await request.json();
  if (!stravaActivityId || !trainingId) {
    return NextResponse.json({ error: 'Missing stravaActivityId or trainingId' }, { status: 400 });
  }

  // Verify ownership of the strava activity
  const { data: activity } = await supabase
    .from('strava_activities')
    .select('*')
    .eq('id', stravaActivityId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
  }

  // Check if training already has a completion from a different source
  const { data: existingCompletion } = await supabase
    .from('completions')
    .select('id, strava_activity_id')
    .eq('training_id', trainingId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existingCompletion && !existingCompletion.strava_activity_id) {
    return NextResponse.json(
      { error: 'Training already has a manually entered completion' },
      { status: 409 }
    );
  }

  // Link the activity to the training
  await supabase
    .from('strava_activities')
    .update({ training_id: trainingId })
    .eq('id', stravaActivityId);

  // Upsert the completion
  const workoutData = buildWorkoutData(activity);
  await supabase.from('completions').upsert({
    training_id: trainingId,
    user_id: session.user.id,
    actual_distance_meters: activity.distance_meters,
    workout_date: activity.activity_date,
    workout_name: activity.activity_name,
    workout_duration_seconds: activity.duration_seconds,
    avg_heart_rate_bpm: activity.avg_heart_rate_bpm,
    avg_pace_seconds: activity.avg_pace_seconds,
    calories_active: activity.calories_active,
    elevation_meters: activity.elevation_meters,
    avg_cadence_spm: activity.avg_cadence_spm,
    avg_power_watts: activity.avg_power_watts,
    pool_length_meters: activity.pool_length_meters,
    laps: activity.laps,
    workout_data: workoutData,
    strava_activity_id: stravaActivityId,
  }, { onConflict: 'training_id' });

  revalidatePath('/settings');
  revalidatePath(`/training/${trainingId}`);
  revalidatePath('/plan');
  revalidatePath('/home');

  return NextResponse.json({ ok: true, workoutData });
}
