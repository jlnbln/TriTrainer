import { createClient } from '@/lib/supabase/server';
import { Countdown } from '@/components/countdown';
import { TodayTraining } from './today-training';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [{ data: training }, { data: profile }] = await Promise.all([
    supabase.from('trainings').select('*').eq('date', dateStr).single(),
    user ? supabase.from('profiles').select('race_date, swim_distance_m, bike_distance_km, run_distance_km').eq('id', user.id).single() : { data: null },
  ]);

  const { data: completion } = training && user
    ? await supabase
        .from('completions')
        .select('id, completed_at')
        .eq('training_id', training.id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const trainingWithCompletion = training
    ? { ...training, completions: completion ? [completion] : [] }
    : null;

  const { data: week } = training
    ? await supabase
        .from('weeks')
        .select('*, phases!inner(*)')
        .eq('id', training.week_id)
        .single()
    : { data: null };

  return (
    <div className="px-5 pt-6 pb-6 max-w-lg mx-auto space-y-6">
      <Countdown
        raceDate={profile?.race_date ?? undefined}
        swimDistanceM={profile?.swim_distance_m ?? 750}
        bikeDistanceKm={profile?.bike_distance_km ?? 20}
        runDistanceKm={profile?.run_distance_km ?? 5}
      />
      <TodayTraining training={trainingWithCompletion} week={week} dateStr={dateStr} />
    </div>
  );
}
