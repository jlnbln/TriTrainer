import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { PlanView } from './plan-view';
import { getWeeksWithTrainings } from '@/lib/data';

// Shell with heading renders immediately; plan data streams in.
export default function PlanPage() {
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
      <Suspense fallback={<PlanSkeleton />}>
        <PlanContent />
      </Suspense>
    </div>
  );
}

async function PlanContent() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // weeks are cached; completions are user-specific — fetch in parallel
  const [weeks, completions] = await Promise.all([
    getWeeksWithTrainings(),
    session
      ? supabase
          .from('completions')
          .select('training_id')
          .eq('user_id', session.user.id)
          .then((r) => r.data)
      : Promise.resolve([]),
  ]);

  const completedSet = new Set((completions || []).map((c: any) => c.training_id));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let currentWeekNumber = 1;
  const sortedWeeks = (weeks || []).map((week: any) => ({
    ...week,
    trainings: [...(week.trainings || [])]
      .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
      .map((t: any) => ({ ...t, completions: completedSet.has(t.id) ? [{ id: t.id }] : [] })),
  }));

  for (const week of sortedWeeks) {
    if (todayStr >= week.start_date && todayStr <= week.end_date) {
      currentWeekNumber = week.week_number;
      break;
    }
    if (todayStr > week.end_date) currentWeekNumber = week.week_number;
  }

  return <PlanView weeks={sortedWeeks} currentWeekNumber={currentWeekNumber} />;
}

function PlanSkeleton() {
  return (
    <div className="space-y-10">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-32 rounded-full bg-muted animate-pulse" />
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-16 rounded-2xl bg-card border border-border/40 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
