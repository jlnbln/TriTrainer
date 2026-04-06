'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function markComplete(trainingId: string, distanceMeters: number | null, notes: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('completions').upsert({
    training_id: trainingId,
    user_id: user.id,
    notes: notes || null,
    actual_distance_meters: distanceMeters,
  }, { onConflict: 'training_id' });

  revalidatePath('/home');
  revalidatePath('/plan');
  revalidatePath(`/training/${trainingId}`);
}

export async function markIncomplete(trainingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('completions').delete().eq('training_id', trainingId).eq('user_id', user.id);

  revalidatePath('/home');
  revalidatePath('/plan');
  revalidatePath(`/training/${trainingId}`);
}

export async function updateNotes(trainingId: string, notes: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  await supabase.from('completions')
    .update({ notes: notes || null })
    .eq('training_id', trainingId)
    .eq('user_id', user.id);
}
