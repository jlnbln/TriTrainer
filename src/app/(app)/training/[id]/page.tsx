import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { TrainingDetail } from './training-detail';

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: training } = await supabase
    .from('trainings')
    .select(`
      *,
      completions (id, completed_at, notes, actual_distance_meters, perceived_effort),
      weeks!inner (
        week_number, label,
        phases!inner (phase_number, name, description)
      )
    `)
    .eq('id', id)
    .single();

  if (!training) notFound();

  // Fetch drills if this training references any
  let drills: any[] = [];
  if (training.drill_slugs && training.drill_slugs.length > 0) {
    const { data } = await supabase
      .from('drills')
      .select('*')
      .in('slug', training.drill_slugs);
    drills = data || [];
  }

  // Get user ID for completion
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <TrainingDetail
      training={training}
      drills={drills}
      userId={user?.id || ''}
    />
  );
}
