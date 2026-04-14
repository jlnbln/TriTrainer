import { unstable_cache } from 'next/cache';
import { createStaticClient } from './supabase/static';

// Training plan data is seeded once and never changes at runtime.
// Cache for 30 days; use revalidateTag('training-plan') to bust manually.
const CACHE_OPTS = { revalidate: 60 * 60 * 24 * 30, tags: ['training-plan'] };

export const getWeeksWithTrainings = unstable_cache(
  async () => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('weeks')
      .select(`
        *,
        phases!inner(phase_number, name, description),
        trainings(id, day_of_week, date, sport, title, distance_meters, duration_minutes)
      `)
      .order('week_number', { ascending: true });
    return data ?? [];
  },
  ['weeks-with-trainings'],
  CACHE_OPTS,
);

export const getAllTrainings = unstable_cache(
  async () => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('trainings')
      .select('id, date, sport, title, distance_meters, duration_minutes')
      .order('date', { ascending: true });
    return data ?? [];
  },
  ['all-trainings'],
  CACHE_OPTS,
);

export const getTrainingByDate = unstable_cache(
  async (date: string) => {
    const supabase = createStaticClient();
    const { data } = await supabase.from('trainings').select('*').eq('date', date).single();
    return data ?? null;
  },
  ['training-by-date'],
  CACHE_OPTS,
);

export const getTrainingWithDetails = unstable_cache(
  async (id: string) => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('trainings')
      .select(`
        *,
        weeks!inner (
          week_number, label,
          phases!inner (phase_number, name, description)
        )
      `)
      .eq('id', id)
      .single();
    return data ?? null;
  },
  ['training-with-details'],
  CACHE_OPTS,
);

export const getDrillsBySlugs = unstable_cache(
  async (slugs: string[]) => {
    const supabase = createStaticClient();
    const { data } = await supabase.from('drills').select('*').in('slug', slugs);
    return data ?? [];
  },
  ['drills-by-slugs'],
  CACHE_OPTS,
);

export const getWeekById = unstable_cache(
  async (id: string) => {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from('weeks')
      .select('*, phases!inner(*)')
      .eq('id', id)
      .single();
    return data ?? null;
  },
  ['week-by-id'],
  CACHE_OPTS,
);
