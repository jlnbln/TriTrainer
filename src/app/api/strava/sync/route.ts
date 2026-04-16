import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  translateSport,
  mapStravaActivity,
  buildWorkoutData,
  refreshStravaToken,
  fetchStravaActivities,
  getISOWeekKey,
} from '@/lib/strava';

export async function POST() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [profileResult, firstTrainingResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('strava_access_token, strava_refresh_token, strava_token_expires_at, strava_last_sync_at')
      .eq('id', session.user.id)
      .single(),
    supabase
      .from('trainings')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
      .single(),
  ]);

  const profile = profileResult.data;
  if (!profile?.strava_refresh_token) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
  }

  // Refresh token if expiring within 5 minutes
  let accessToken = profile.strava_access_token;
  const expiresAt = profile.strava_token_expires_at
    ? new Date(profile.strava_token_expires_at).getTime()
    : 0;

  if (Date.now() + 5 * 60 * 1000 >= expiresAt) {
    const refreshed = await refreshStravaToken(profile.strava_refresh_token);
    accessToken = refreshed.access_token;
    await supabase.from('profiles').update({
      strava_access_token: refreshed.access_token,
      strava_refresh_token: refreshed.refresh_token,
      strava_token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    }).eq('id', session.user.id);
  }

  // For first sync: use plan start date; subsequent syncs: use last sync timestamp
  const planStartDate = firstTrainingResult.data?.date
    ? Math.floor(new Date(firstTrainingResult.data.date + 'T00:00:00Z').getTime() / 1000)
    : Math.floor((Date.now() - 180 * 24 * 60 * 60 * 1000) / 1000);

  const after = profile.strava_last_sync_at
    ? Math.floor(new Date(profile.strava_last_sync_at).getTime() / 1000)
    : planStartDate;

  const rawActivities = await fetchStravaActivities(accessToken, after);

  let synced = 0;
  let linked = 0;
  let unlinked = 0;

  // Upsert activities into strava_activities cache
  for (const raw of rawActivities) {
    const sport = translateSport(raw.sport_type);
    if (!sport) continue;

    const mapped = mapStravaActivity(raw, sport);

    const { data: existing } = await supabase
      .from('strava_activities')
      .select('id, training_id, dismissed')
      .eq('strava_id', raw.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (existing) {
      // Never re-import dismissed activities; don't disturb linked ones
      if (!existing.dismissed && !existing.training_id) {
        await supabase.from('strava_activities').update({
          raw_data: raw,
          activity_name: mapped.activity_name,
        }).eq('id', existing.id);
      }
    } else {
      await supabase.from('strava_activities').insert({
        ...mapped,
        user_id: session.user.id,
        raw_data: raw,
      });
      synced++;
    }
  }

  // Auto-map all pending (unlinked + not dismissed) activities for this user
  const { data: pendingActivities } = await supabase
    .from('strava_activities')
    .select('*')
    .eq('user_id', session.user.id)
    .is('training_id', null)
    .eq('dismissed', false)
    .order('activity_date', { ascending: true });

  if (pendingActivities && pendingActivities.length > 0) {
    const dates = pendingActivities.map((a) => a.activity_date);
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const { data: trainings } = await supabase
      .from('trainings')
      .select('id, sport, date, weeks!inner(start_date, end_date, week_number)')
      .gte('date', minDate)
      .lte('date', maxDate)
      .in('sport', ['swim', 'run', 'bike', 'brick'])
      .order('date', { ascending: true });

    const trainingIds = (trainings ?? []).map((t) => t.id);
    const { data: existingCompletions } = trainingIds.length > 0
      ? await supabase
          .from('completions')
          .select('training_id')
          .eq('user_id', session.user.id)
          .in('training_id', trainingIds)
      : { data: [] };

    const takenTrainingIds = new Set<number>(
      (existingCompletions ?? []).map((c) => c.training_id)
    );

    for (const activity of pendingActivities) {
      const sport = activity.sport_type;
      const activityWeek = getISOWeekKey(activity.activity_date);

      // Priority 1: exact date + sport + not taken
      let candidate = (trainings ?? []).find(
        (t) => t.date === activity.activity_date && t.sport === sport && !takenTrainingIds.has(t.id)
      );

      // Priority 2: same ISO week + sport + first open slot
      if (!candidate) {
        candidate = (trainings ?? []).find(
          (t) => getISOWeekKey(t.date) === activityWeek && t.sport === sport && !takenTrainingIds.has(t.id)
        );
      }

      if (candidate) {
        takenTrainingIds.add(candidate.id);

        await supabase
          .from('strava_activities')
          .update({ training_id: candidate.id })
          .eq('id', activity.id);

        const workoutData = buildWorkoutData(activity);
        await supabase.from('completions').upsert({
          training_id: candidate.id,
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
          strava_activity_id: activity.id,
        }, { onConflict: 'training_id' });

        linked++;
      } else {
        unlinked++;
      }
    }
  }

  await supabase.from('profiles').update({
    strava_last_sync_at: new Date().toISOString(),
  }).eq('id', session.user.id);

  return NextResponse.json({ synced, linked, unlinked });
}
