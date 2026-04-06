import { createClient } from '@/lib/supabase/server';
import { PlanView } from './plan-view';

export default async function PlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: weeks } = await supabase
    .from('weeks')
    .select(`
      *,
      phases!inner(phase_number, name, description),
      trainings(id, day_of_week, date, sport, title, distance_meters, duration_minutes)
    `)
    .order('week_number', { ascending: true });

  const { data: completions } = user
    ? await supabase
        .from('completions')
        .select('training_id')
        .eq('user_id', user.id)
    : { data: [] };

  const completedSet = new Set((completions || []).map((c: any) => c.training_id));

  const sortedWeeks = (weeks || []).map((week: any) => ({
    ...week,
    trainings: [...(week.trainings || [])]
      .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
      .map((t: any) => ({ ...t, completions: completedSet.has(t.id) ? [{ id: t.id }] : [] })),
  }));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let currentWeekNumber = 1;
  for (const week of sortedWeeks) {
    if (todayStr >= week.start_date && todayStr <= week.end_date) {
      currentWeekNumber = week.week_number;
      break;
    }
    if (todayStr > week.end_date) currentWeekNumber = week.week_number;
  }

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-6">
      <div className="mb-6 space-y-2">
        <h2 className="font-headline font-extrabold text-4xl tracking-tight">Training Plan</h2>
        <div className="flex items-center gap-3">
          <span className="font-headline text-[10px] uppercase tracking-widest font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
            22-week programme
          </span>
        </div>
      </div>
      <PlanView weeks={sortedWeeks} currentWeekNumber={currentWeekNumber} />
    </div>
  );
}
