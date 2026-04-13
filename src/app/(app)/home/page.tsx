import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Countdown } from '@/components/countdown';
import { TodayTraining } from './today-training';

function formatDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Shell renders immediately; data streams in via Suspense boundaries.
export default function HomePage() {
  const dateStr = formatDateStr(new Date());

  return (
    <div className="px-5 pt-6 pb-6 max-w-lg mx-auto space-y-6">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-muted" />}>
        <CountdownSection />
      </Suspense>
      <Suspense fallback={<div className="h-52 rounded-2xl bg-card animate-pulse border border-border/40" />}>
        <TodayTrainingSection dateStr={dateStr} />
      </Suspense>
    </div>
  );
}

async function CountdownSection() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('race_date, swim_distance_m, bike_distance_km, run_distance_km')
    .eq('id', session.user.id)
    .single();

  return (
    <Countdown
      raceDate={profile?.race_date ?? undefined}
      swimDistanceM={profile?.swim_distance_m ?? 750}
      bikeDistanceKm={profile?.bike_distance_km ?? 20}
      runDistanceKm={profile?.run_distance_km ?? 5}
    />
  );
}

async function TodayTrainingSection({ dateStr }: { dateStr: string }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const { data: training } = await supabase
    .from('trainings')
    .select('*')
    .eq('date', dateStr)
    .single();

  // completion and week are independent once we have training — fetch in parallel
  const [completion, week] = await Promise.all([
    training && session
      ? supabase
          .from('completions')
          .select('id, completed_at')
          .eq('training_id', training.id)
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
    training
      ? supabase
          .from('weeks')
          .select('*, phases!inner(*)')
          .eq('id', training.week_id)
          .single()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const trainingWithCompletion = training
    ? { ...training, completions: completion ? [completion] : [] }
    : null;

  return <TodayTraining training={trainingWithCompletion} week={week} dateStr={dateStr} />;
}
