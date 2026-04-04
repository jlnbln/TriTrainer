/**
 * Seed training data into Supabase.
 * Run: SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx npx tsx scripts/seed-database.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'training-data.json'), 'utf-8')
);

async function seed() {
  console.log('Seeding phases...');
  for (const phase of data.phases) {
    const { error } = await supabase.from('phases').upsert({
      phase_number: phase.phaseNumber,
      name: phase.name,
      description: phase.description,
      start_date: phase.startDate,
      end_date: phase.endDate,
    }, { onConflict: 'phase_number' });
    if (error) throw new Error(`Phase ${phase.phaseNumber}: ${error.message}`);
  }

  // Get phase IDs
  const { data: phases } = await supabase.from('phases').select('id, phase_number');
  const phaseMap = new Map(phases!.map((p: any) => [p.phase_number, p.id]));

  console.log('Seeding drills...');
  for (const drill of data.drills) {
    const { error } = await supabase.from('drills').upsert({
      name: drill.name,
      slug: drill.slug,
      description: drill.description,
    }, { onConflict: 'slug' });
    if (error) throw new Error(`Drill ${drill.slug}: ${error.message}`);
  }

  console.log('Seeding weeks...');
  for (const week of data.weeks) {
    const { error } = await supabase.from('weeks').upsert({
      phase_id: phaseMap.get(week.phaseNumber),
      week_number: week.weekNumber,
      label: week.label,
      start_date: week.startDate,
      end_date: week.endDate,
    }, { onConflict: 'week_number' });
    if (error) throw new Error(`Week ${week.weekNumber}: ${error.message}`);
  }

  // Get week IDs
  const { data: weeks } = await supabase.from('weeks').select('id, week_number');
  const weekMap = new Map(weeks!.map((w: any) => [w.week_number, w.id]));

  console.log('Seeding trainings...');
  // Delete existing trainings first to avoid duplicates
  await supabase.from('trainings').delete().neq('id', 0);

  let trainingCount = 0;
  for (const week of data.weeks) {
    for (const training of week.trainings) {
      const { error } = await supabase.from('trainings').insert({
        week_id: weekMap.get(week.weekNumber),
        day_of_week: training.dayOfWeek,
        date: training.date,
        sport: training.sport,
        title: training.title,
        description: training.description,
        distance_meters: training.distanceMeters,
        duration_minutes: training.durationMinutes,
        drill_slugs: training.drillSlugs,
      });
      if (error) throw new Error(`Training ${training.date}: ${error.message}`);
      trainingCount++;
    }
  }

  console.log(`Done! Seeded ${data.phases.length} phases, ${data.weeks.length} weeks, ${trainingCount} trainings, ${data.drills.length} drills`);
}

seed().catch(console.error);
