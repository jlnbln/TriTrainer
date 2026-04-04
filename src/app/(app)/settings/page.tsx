import { createClient } from '@/lib/supabase/server';
import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: gear } = await supabase
    .from('gear')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Calculate shoe wear: get total completed run distances
  const { data: runCompletions } = await supabase
    .from('completions')
    .select(`
      actual_distance_meters,
      trainings!inner (sport, distance_meters)
    `)
    .eq('user_id', user.id)
    .in('trainings.sport', ['run', 'brick']);

  const totalRunKm = (runCompletions || []).reduce((sum: number, c: any) => {
    const dist = c.actual_distance_meters || c.trainings?.distance_meters || 0;
    return sum + dist / 1000;
  }, 0);

  return (
    <SettingsView
      profile={profile}
      gear={gear || []}
      totalRunKm={totalRunKm}
      userId={user.id}
    />
  );
}
