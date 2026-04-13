import { createClient } from '@/lib/supabase/server';
import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // profile, gear, and run completions are all independent — fetch in parallel
  const [profile, gear, runCompletions] = await Promise.all([
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
  ]);

  const totalRunKm = (runCompletions || []).reduce((sum: number, c: any) => {
    const dist = c.actual_distance_meters || c.trainings?.distance_meters || 0;
    return sum + dist / 1000;
  }, 0);

  return (
    <SettingsView
      profile={profile}
      gear={gear || []}
      totalRunKm={totalRunKm}
      userId={session.user.id}
    />
  );
}
