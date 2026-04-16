import { createClient } from '@/lib/supabase/server';
import { SettingsView } from './settings-view';
import { StravaSyncTrigger } from '@/components/strava-sync-trigger';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const [profile, gear, runCompletions, unlinkedResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then((r) => r.data),
    supabase
      .from('gear')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then((r) => r.data),
    supabase
      .from('completions')
      .select(`
        actual_distance_meters,
        trainings!inner (sport, distance_meters)
      `)
      .eq('user_id', session.user.id)
      .in('trainings.sport', ['run', 'brick'])
      .then((r) => r.data),
    supabase
      .from('strava_activities')
      .select('id, sport_type, activity_date, distance_meters, duration_seconds, activity_name')
      .eq('user_id', session.user.id)
      .is('training_id', null)
      .eq('dismissed', false)
      .order('activity_date', { ascending: false })
      .limit(20)
      .then((r) => r.data ?? []),
  ]);

  const totalRunKm = (runCompletions || []).reduce((sum: number, c: any) => {
    const dist = c.actual_distance_meters || c.trainings?.distance_meters || 0;
    return sum + dist / 1000;
  }, 0);

  const stravaConnected = !!profile?.strava_refresh_token;
  const unlinkedActivities = unlinkedResult ?? [];

  return (
    <>
      {stravaConnected && (
        <StravaSyncTrigger lastSyncAt={profile?.strava_last_sync_at ?? null} />
      )}
      <SettingsView
        profile={profile}
        gear={gear || []}
        totalRunKm={totalRunKm}
        userId={session.user.id}
        stravaConnected={stravaConnected}
        stravaLastSyncAt={profile?.strava_last_sync_at ?? null}
        unlinkedActivities={unlinkedActivities}
      />
    </>
  );
}
