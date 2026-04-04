import { createClient } from '@/lib/supabase/server';
import { Countdown } from '@/components/countdown';
import { TodayTraining } from './today-training';

export default async function HomePage() {
  const supabase = await createClient();

  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { data: training } = await supabase
    .from('trainings')
    .select('*, completions(id, completed_at)')
    .eq('date', dateStr)
    .single();

  const { data: week } = training
    ? await supabase
        .from('weeks')
        .select('*, phases!inner(*)')
        .eq('id', training.week_id)
        .single()
    : { data: null };

  return (
    <div className="px-5 pt-6 pb-6 max-w-lg mx-auto space-y-6">
      <Countdown />
      <TodayTraining training={training} week={week} dateStr={dateStr} />
    </div>
  );
}
