/**
 * Parse triathlon_training_plan.docx into structured JSON.
 * Run: npx tsx scripts/parse-docx.ts
 * Output: scripts/training-data.json
 */

import * as fs from 'fs';
import * as path from 'path';

// We'll parse from the extracted text since the structure is very regular
// The docx has already been read - we'll use the raw XML approach

// Data is defined directly from the extracted .docx content for reliability

interface RawTraining {
  date: string;
  dayOfWeek: number;
  sport: string;
  title: string;
  description: string;
  distanceMeters: number | null;
  durationMinutes: number | null;
  drillSlugs: string[];
  weekNumber: number;
}

interface RawWeek {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  phaseNumber: number;
  trainings: RawTraining[];
}

const DRILL_PATTERNS: Record<string, RegExp> = {
  'catch-up': /catch[- ]?up\s+drill/i,
  'finger-drag': /finger[- ]?drag\s+drill/i,
  'side-kick': /side[- ]?kick\s+drill/i,
  'single-arm': /single[- ]?arm\s+drill/i,
  'fist': /fist\s+drill/i,
  'open-water-sighting': /open[- ]?water\s+sighting/i,
};

function detectSport(title: string, description: string): string {
  const t = title.toLowerCase();
  if (t.includes('race day') || t.includes('🏅')) return 'race';
  if (t.includes('rest') || t === 'rest') return 'rest';
  if (t.includes('brick') || t.includes('→')) return 'brick';
  if (t.startsWith('swim')) return 'swim';
  if (t.startsWith('easy run') || t.startsWith('tempo run') || t.startsWith('interval run') ||
      t.startsWith('race-pace run') || t.startsWith('mixed run') || t.startsWith('sharpener run') ||
      t.startsWith('easy jog') || t.startsWith('easy short') || t.startsWith('tempo +')) return 'run';
  if (t.startsWith('bike') || t.startsWith('easy spin')) return 'bike';
  // Fallback checks
  if (description.toLowerCase().includes('swim') || description.toLowerCase().includes('stroke')) return 'swim';
  if (description.toLowerCase().includes('run') || description.toLowerCase().includes('jog')) return 'run';
  if (description.toLowerCase().includes('bike') || description.toLowerCase().includes('ride') || description.toLowerCase().includes('spin')) return 'bike';
  return 'rest';
}

function parseDistance(title: string, description: string, sport: string): number | null {
  // Try to extract distance from title
  const mMatch = title.match(/([\d,]+)\s*m\b/i);
  if (mMatch) return parseInt(mMatch[1].replace(',', ''), 10);

  const kmMatch = title.match(/([\d.]+)\s*km/i);
  if (kmMatch) return Math.round(parseFloat(kmMatch[1]) * 1000);

  // For brick sessions, extract run distance
  if (sport === 'brick') {
    const runMatch = title.match(/Run\s+([\d.]+)\s*km/i);
    if (runMatch) return Math.round(parseFloat(runMatch[1]) * 1000);
  }

  return null;
}

function parseDuration(title: string): number | null {
  const minMatch = title.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1], 10);
  return null;
}

function detectDrills(description: string): string[] {
  const found: string[] = [];
  for (const [slug, pattern] of Object.entries(DRILL_PATTERNS)) {
    if (pattern.test(description)) {
      found.push(slug);
    }
  }
  return found;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

// Build the complete training plan data
// Week start dates (Mondays), derived from plan: Week 1 starts Apr 6, 2026

const PLAN_START = '2026-04-06'; // Monday

// Define all weeks with their data
// Each week has 7 days: Mon-Sun
// Format: [title, description] for each day

const weekData: Array<{
  weekNum: number;
  phase: number;
  label: string;
  days: Array<[string, string]>; // [title, description] for Mon-Sun
}> = [
  // PHASE 1: Base Building (Weeks 1-6)
  {
    weekNum: 1, phase: 1, label: 'Week 1  Apr 6–12',
    days: [
      ['Swim 1,200m', 'Warm-up 200m easy. Drill set: 4×50m catch-up drill. Main: 4×200m easy freestyle, 30s rest. Cool-down 100m easy. Focus: relaxed stroke, breathe every 3 strokes.'],
      ['Easy Run 4km', 'Easy conversational pace (~6:30 min/km). No pressure, just build the habit. Flat route preferred. Focus: land mid-foot, keep shoulders relaxed.'],
      ['Swim 1,200m', 'Warm-up 200m. Drill: 4×50m finger-drag drill (improves catch). Main: 600m continuous easy swim. Cool-down 200m. Focus: long smooth strokes.'],
      ['Easy Run 4km', 'Same easy effort as Tuesday. Try a slightly different route. Focus: consistent cadence (~170 steps/min), upright posture.'],
      ['Rest', 'Full rest day. Light stretching or yoga optional.'],
      ['Bike 35 min', 'Easy leisure ride. Focus on cadence: aim for 80–90 RPM (spin lighter gear, faster legs). No intensity needed — just get comfortable thinking about cadence.'],
      ['Rest', 'Full rest and recovery.'],
    ]
  },
  {
    weekNum: 2, phase: 1, label: 'Week 2  Apr 13–19',
    days: [
      ['Swim 1,300m', 'Warm-up 200m. Drill: 4×50m side-kick drill (improves body rotation). Main: 5×200m easy, 30s rest. Cool-down 100m. Focus: rotate hips with each stroke.'],
      ['Easy Run 4.5km', 'Add 500m to last week. Keep the same easy effort. If you finish and feel great, resist going faster — patience builds the base.'],
      ['Swim 1,300m', 'Warm-up 200m. Main: 3×300m continuous, 45s rest. Cool-down 100m. Focus: count strokes per length, aim for 18–22 strokes per 25m.'],
      ['Easy Run 4.5km', 'Easy effort. Try running on a slight incline for part of it to build leg strength naturally.'],
      ['Rest', 'Full rest day.'],
      ['Bike 35 min', 'Add a gentle hill or two. Stay seated on climbs. Focus: maintain 80+ RPM even uphill by shifting gears.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 3, phase: 1, label: 'Week 3  Apr 20–26',
    days: [
      ['Swim 1,400m', 'Warm-up 200m. Drill: 4×50m single-arm drill. Main: 4×250m easy, 30s rest. Cool-down 100m. Focus: feel the water pressure on your palm during the pull.'],
      ['Easy Run 5km', 'Back to your comfort distance. Easy effort (~6:20–6:30 min/km). This should feel manageable and enjoyable.'],
      ['Swim 1,400m', 'Warm-up 150m. Main: 800m continuous swim (no stopping). Cool-down 200m with backstroke/breaststroke. Note how you feel at the 500m and 800m marks.'],
      ['Easy Run 5km', 'Easy run. In the last 5 minutes, pick up the pace slightly — just a small \'feel good\' surge to finish strong.'],
      ['Rest', 'Rest day.'],
      ['Bike 40 min', 'Slightly longer ride. Include 2×5 min at a moderate effort (feel like you\'re working but can still speak short sentences). 5 min easy between efforts.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 4, phase: 1, label: 'Week 4  Apr 27–May 3',
    days: [
      ['Swim 1,500m', 'Warm-up 200m. Main: 6×200m at easy-moderate effort, 25s rest. Cool-down 100m. This is your race distance in the pool — a confidence builder.'],
      ['Easy Run 5km', 'Easy effort. Focus on breathing rhythm: try inhale 3 steps, exhale 2 steps (3:2 rhythm). Helps with efficient breathing.'],
      ['Swim 1,500m', 'Warm-up 200m. Drill: 2×50m catch-up. Main: 1,000m continuous at easy pace. Cool-down 200m. Note your 1,000m time for tracking progress.'],
      ['Easy Run 5km', 'Easy run. Practice relaxing your hands (imagine holding a potato chip without breaking it) and dropping your shoulders.'],
      ['Rest', 'Rest day.'],
      ['Bike 45 min', 'Steady ride. 3×6 min moderate effort with 4 min easy recovery. Focus on staying aerodynamic: elbows bent, chin up, look ahead.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 5, phase: 1, label: 'Week 5  May 4–10',
    days: [
      ['Swim 1,600m', 'Warm-up 200m. Main: 4×300m moderate effort (slightly harder than easy), 30s rest. Cool-down 100m. Focus: maintain stroke count as you get tired.'],
      ['Easy Run 5.5km', 'Extend slightly. Easy conversational pace. If the extra 500m feels hard, you\'re going too fast — slow down.'],
      ['Swim 1,600m', 'Warm-up 200m. Drill: 4×50m fist drill (closed fist to feel forearm catch). Main: 3×400m easy, 40s rest. Cool-down 200m.'],
      ['Easy Run 5.5km', 'Easy effort. Try to run in a location you enjoy — parks, waterfront. Motivation matters.'],
      ['Rest', 'Rest day.'],
      ['Brick: Bike 25min → Run 1.5km', 'Bike 25 min at moderate effort, then immediately change shoes and run 1.5km. Your legs will feel like lead — this is normal! Shuffle the first few minutes, then find your run legs. This is the most important workout of the week.'],
      ['Rest', 'Recovery — the brick may leave you more tired than expected.'],
    ]
  },
  {
    weekNum: 6, phase: 1, label: 'Week 6  May 11–17',
    days: [
      ['Swim 1,600m', 'Warm-up 200m. Main: 1,200m continuous. Cool-down 200m. Goal: swim the 1,200m without stopping. Track your time.'],
      ['Easy Run 5km', 'Recovery week — slightly shorter run. Very easy effort. Enjoy it.'],
      ['Swim 1,500m', 'Technique focus. Warm-up 200m. Drill set: 200m of your favourite drill. Main: 3×300m, 30s rest. Cool-down 200m. Think about one technique cue only: long strokes.'],
      ['Easy Run 5km', 'Easy run. Reflect on how your fitness has improved since Week 1. Small wins matter.'],
      ['Rest', 'Rest day.'],
      ['Bike 40 min', 'Easier week — just an enjoyable moderate ride. No structured intervals. Spin the legs.'],
      ['Rest', 'Rest. Phase 1 complete — well done!'],
    ]
  },
  // PHASE 2: Build (Weeks 7-12)
  {
    weekNum: 7, phase: 2, label: 'Week 7  May 18–24',
    days: [
      ['Swim 1,700m', 'Warm-up 200m. Main: 6×100m with 20s rest, then 4×200m with 30s rest. Cool-down 100m. First time doing structured intervals — effort should feel moderate-hard on the 100s.'],
      ['Easy Run 5km', 'Easy effort. Welcome to Phase 2! Keep patience — the harder sessions start mid-week.'],
      ['Swim 1,800m', 'Warm-up 200m. Drill: 4×50m. Main: 8×100m at moderate-strong pace (7/10 effort), 25s rest. Cool-down 200m. Focus: keep stroke long even when pushing pace.'],
      ['Run with Pace Work 5km', 'Warm-up 1km easy. Main: 2×10 min at race pace (5:30–5:45 min/km), with 3 min easy jog between. Cool-down 1km easy. First taste of race effort!'],
      ['Rest', 'Rest day.'],
      ['Bike 50 min', '3×8 min moderate-hard effort (7/10 RPE), 4 min easy between. Warm-up and cool-down 5 min each. Focus: hold power/speed steady throughout the effort block.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 8, phase: 2, label: 'Week 8  May 25–31',
    days: [
      ['Swim 1,800m', 'Warm-up 200m. Main: 4×400m at moderate effort, 45s rest. Cool-down 200m. Practice open-water sighting if at a lake/sea: every 10 strokes, lift head briefly to look forward.'],
      ['Easy Run 6km', 'Longer easy run. Very comfortable pace. Build the aerobic base steadily.'],
      ['Swim 1,800m', 'Warm-up 200m. Pyramid set: 100, 200, 300, 200, 100m with 30s rest each. Cool-down 200m. Focus: stay smooth on the 300m — don\'t die at the top of the pyramid.'],
      ['Tempo Run 5km', 'Warm-up 1km easy. Main: 3km at a comfortably hard pace (6/10 effort, ~5:45 min/km). Cool-down 1km easy. This builds your lactate threshold.'],
      ['Rest', 'Rest day.'],
      ['Bike 55 min', 'Warm-up 10 min. Main: 35 min steady moderate ride (6/10 effort). Cool-down 10 min. Practice drinking water while riding — you\'ll need this in the race.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 9, phase: 2, label: 'Week 9  Jun 1–7',
    days: [
      ['Swim 1,900m', 'Warm-up 200m. Main: 5×300m moderate, 35s rest. Cool-down 200m. Focus: breathe bilaterally (alternate sides) to be comfortable in open water if the course turns.'],
      ['Easy Run 6km', 'Easy pace. Focus on strong arm drive — arms should swing forward-back, not across body. This improves running economy.'],
      ['Swim 1,900m', 'Warm-up 200m. Main: 3×500m moderate, 45s rest. Cool-down 200m. The 1,500m of work is getting close to race distance. Good confidence builder.'],
      ['Interval Run 5km', 'Warm-up 1km. Main: 5×3 min at hard pace (~5:10–5:20 min/km), 90s jog recovery. Cool-down 1km. First speed intervals — short and sharp to build leg turnover.'],
      ['Rest', 'Rest day.'],
      ['Brick: Bike 30min → Run 2.5km', 'Bike 30 min with 2×8 min moderate-hard efforts. Immediately run 2.5km. Your pace goal: don\'t look at your watch for the first 500m, just settle in. Then aim for ~5:45 min/km.'],
      ['Rest', 'Recovery from the brick.'],
    ]
  },
  {
    weekNum: 10, phase: 2, label: 'Week 10  Jun 8–14',
    days: [
      ['Swim 2,000m', 'Warm-up 200m. Main: 10×100m at moderate-strong effort (7/10), 20s rest. Cool-down 200m. These short intervals improve pace. Note your average 100m split.'],
      ['Easy Run 6km', 'Easy and relaxed. Mid-plan check: how are your legs feeling? If fatigued, slow down further. Listen to your body.'],
      ['Swim 2,000m', 'Warm-up 200m. Main: 1,500m continuous at easy-moderate pace. Cool-down 200m. This is your full race distance! Don\'t push — just swim it comfortably. Note your time.'],
      ['Tempo Run 5km', 'Warm-up 1km. Main: 3km tempo at ~5:30–5:45 min/km. Cool-down 1km. Your tempo pace should be improving from Week 8.'],
      ['Rest', 'Rest day.'],
      ['Bike 60 min', 'Longest bike so far. Warm-up 10 min. Main: 40 min steady effort (6–7/10). Cool-down 10 min. Simulate race nutrition: sip water every 10–15 minutes.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 11, phase: 2, label: 'Week 11  Jun 15–21',
    days: [
      ['Swim 2,000m', 'Warm-up 200m. Main: 4×400m moderate, 40s rest. Cool-down 200m. Focus: negative split each 400m — swim the second 200m slightly faster than the first.'],
      ['Easy Run 6.5km', 'Slightly longer easy run. Keep it genuinely easy — this supports recovery from harder swim and run sessions.'],
      ['Swim 2,000m', 'Warm-up 200m. Race-simulation set: 3×400m at goal race pace (roughly 1:50–2:00/100m), 60s rest. Cool-down 200m. Getting specific now.'],
      ['Mixed Run 5.5km', 'Warm-up 1km. Main: 1km easy, 1km at race pace (5:30 min/km), 1km easy, 1km at race pace. Cool-down 500m. Helps you practice switching gears.'],
      ['Rest', 'Rest day.'],
      ['Brick: Bike 35min → Run 3km', 'Bike 35 min with 3×8 min moderate-hard efforts. Transition quickly and run 3km. Goal: settle into 5:35–5:45 min/km within the first 500m. Practice your transition: helmet off, shoes on, go.'],
      ['Rest', 'Recovery from brick.'],
    ]
  },
  {
    weekNum: 12, phase: 2, label: 'Week 12  Jun 22–28',
    days: [
      ['Swim 2,000m', 'Warm-up 200m. Main: 1,600m at easy-moderate continuous. Cool-down 200m. Focus on technique — you\'re building great fitness now, don\'t let technique slip.'],
      ['Easy Run 6km', 'Easy recovery run. Phase 2 has been tough — your body is adapting. Easy runs are where that adaptation happens.'],
      ['Swim 1,800m', 'Lighter mid-week session. Warm-up 200m. Drill set: 200m drills of your choice. Main: 4×300m easy, 30s rest. Cool-down 100m.'],
      ['Easy Run 5km', 'Easy run. Shorter than recent Thursdays — this is a slight de-load before Phase 3.'],
      ['Rest', 'Rest day.'],
      ['Bike 50 min', 'Lighter bike — enjoyable moderate ride. No structured intervals. A reward ride after a big build block.'],
      ['Rest', 'Rest. Phase 2 complete — halfway there!'],
    ]
  },
  // PHASE 3: Race-Specific (Weeks 13-17)
  {
    weekNum: 13, phase: 3, label: 'Week 13  Jun 29–Jul 5',
    days: [
      ['Swim 2,000m', 'Warm-up 200m. Race-pace set: 4×250m at target race pace (sub-1:55/100m), 45s rest. Cool-down 200m. This is now race-specific preparation.'],
      ['Easy Run 6km', 'Easy effort. Welcome to Phase 3 — the hardest and most rewarding block. Stay patient on easy days.'],
      ['Swim 2,000m', 'Warm-up 200m. Main: 3×500m at race effort, 60s rest. Cool-down 200m. 500m in open water if possible. Practice sighting every 8–10 strokes.'],
      ['Race-Pace Run 5km', 'Warm-up 1km. Main: 3km at target race pace (5:20–5:30 min/km). Cool-down 1km. Start feeling what race day legs feel like.'],
      ['Rest', 'Rest day.'],
      ['Bike 65 min', 'Warm-up 10 min. Main: 45 min at race effort (7/10 RPE, sustainable but working). Cool-down 10 min. Practice race nutrition: water every 10 min, a small snack at 30 min if desired.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 14, phase: 3, label: 'Week 14  Jul 6–12',
    days: [
      ['Swim 2,000m', 'Warm-up 200m. Main: 2,000m split as: 500m easy, 500m moderate, 500m race pace, 500m easy cool-down. A full race-distance swim at graduated effort.'],
      ['Easy Run 6.5km', 'Long easy run. Build your aerobic engine. Focus on form and breathing.'],
      ['Swim 2,000m', 'Warm-up 200m. Sprint set: 8×50m at sprint pace (9/10 effort), 30s rest. Then 800m at easy pace. Cool-down 200m. Sprints develop speed, the 800m builds endurance.'],
      ['Tempo + Intervals 5.5km', 'Warm-up 1km. 2km tempo (5:35 min/km). 2 min rest. 3×1 min fast (5:00 min/km), 1 min jog. Cool-down 1km. A demanding session — fuel well beforehand.'],
      ['Rest', 'Rest day.'],
      ['Brick: Bike 40min → Run 3km', 'Bike 40 min including 3×10 min at race intensity. Transition in under 90 seconds (practice!) then run 3km at race pace (5:30 min/km). Time your transition — aim to beat it each week.'],
      ['Rest', 'Recovery.'],
    ]
  },
  {
    weekNum: 15, phase: 3, label: 'Week 15  Jul 13–19',
    days: [
      ['Swim 2,100m', 'Warm-up 200m. Main: 5×300m at race pace, 45s rest. Cool-down 200m. Consistency in race-pace swimming is the goal. These reps should start feeling familiar.'],
      ['Easy Run 6km', 'Easy run. Recovery day. This week has two hard sessions (Thu/Sat) so protect Tuesday.'],
      ['Swim 2,000m', 'Warm-up 200m. Main: 1,400m continuous at easy-moderate effort. Cool-down 200m. Long unbroken swims build mental endurance for race day.'],
      ['Race-Pace Run 5km', 'Warm-up 1km. Main: 3km at race pace (5:20–5:30 min/km). Cool-down 1km. Your pace should feel more comfortable than Week 13.'],
      ['Rest', 'Rest day.'],
      ['Bike 70 min', 'Your longest bike session. Warm-up 10 min. Main: 50 min at race intensity (7/10 RPE). Cool-down 10 min. Simulate the full race bike leg duration. Nutrition practice is critical here.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  {
    weekNum: 16, phase: 3, label: 'Week 16  Jul 20–26',
    days: [
      ['Swim 2,100m', 'Warm-up 200m. Main: race simulation — swim 1,000m continuous at goal race effort (aim for sub-19 min). Note your time! Cool-down 400m easy.'],
      ['Easy Run 6.5km', 'Easy effort. Mental note: race day is 6 weeks away. Your training is working — trust the process.'],
      ['Swim 2,000m', 'Warm-up 200m. Pace work: 10×100m with 15s rest at slightly faster than race pace. Cool-down 200m. Short rest = simulate open water where you can\'t truly rest.'],
      ['Tempo Run with Surge 5.5km', 'Warm-up 1km. 2km tempo. Then 4×30s surges at sprint effort with 90s jog recovery. Cool-down 1km. The surges train you to push when tired — exactly like the run after the bike.'],
      ['Rest', 'Rest day.'],
      ['Brick: Bike 45min → Run 4km', 'Your biggest brick. Bike 45 min at race intensity. Transition under 90 seconds. Run 4km as close to race pace as possible (5:30 min/km). This proves you can do it on race day.'],
      ['Rest', 'Recovery from the big brick.'],
    ]
  },
  {
    weekNum: 17, phase: 3, label: 'Week 17  Jul 27–Aug 2',
    days: [
      ['Swim 2,000m', 'Warm-up 200m. Main: 4×400m at race pace, 50s rest. Cool-down 200m. You\'re peaking. These 400m reps at race pace should feel controlled, not desperate.'],
      ['Easy Run 6km', 'Easy and relaxed. Let your body absorb the training from Week 16\'s big brick.'],
      ['Swim 2,000m', 'Warm-up 200m. Main: 1,600m at race-easy effort (sustainable, smooth). Cool-down 200m. Confident, controlled swimming.'],
      ['Race-Pace Run 5km', 'Warm-up 1km. Main: 3km at race pace (5:20 min/km). Cool-down 1km. This is your sharpest race pace run of the plan. Note your splits.'],
      ['Rest', 'Rest day.'],
      ['Bike 65 min', 'Warm-up 10 min. Main: 45 min at race intensity. Cool-down 10 min. Start reducing duration from here as taper approaches.'],
      ['Rest', 'Rest and recovery.'],
    ]
  },
  // PHASE 4: Taper (Weeks 18-22)
  {
    weekNum: 18, phase: 4, label: 'Week 18  Aug 3–9',
    days: [
      ['Swim 1,800m', 'Warm-up 200m. Main: 4×300m at race pace, 45s rest. Cool-down 200m. Volume drops 15%, intensity stays. You should feel good in the water.'],
      ['Easy Run 5.5km', 'Easy effort. Welcome to the taper! Your body will now absorb all the hard work. Don\'t be alarmed if you feel a bit flat this week — it\'s normal.'],
      ['Swim 1,600m', 'Warm-up 200m. Drill: 100m. Main: 1,000m at race-easy pace. Cool-down 200m. Smooth, efficient, confident.'],
      ['Sharpener Run 5km', 'Warm-up 1km. Main: 2km at race pace. 2 min rest. 3×1 min fast. Cool-down 1km. Keeps your legs sharp without accumulating fatigue.'],
      ['Rest', 'Rest day.'],
      ['Brick: Bike 30min → Run 2km', 'Shorter brick — maintain sharpness, not volume. Bike 30 min at race intensity. Run 2km at race pace. Feel how good your legs are becoming.'],
      ['Rest', 'Rest.'],
    ]
  },
  {
    weekNum: 19, phase: 4, label: 'Week 19  Aug 10–16',
    days: [
      ['Swim 1,600m', 'Warm-up 200m. Main: 3×300m race pace, 45s rest. Cool-down 400m. Less volume, same sharpness. You\'ll feel fast in the water.'],
      ['Easy Run 5km', 'Easy, enjoyable run. You\'re 3 weeks from race day. Trust your fitness — it\'s built.'],
      ['Swim 1,400m', 'Warm-up 200m. Main: 800m at race-easy effort. Cool-down 200m. Short, sharp, confident.'],
      ['Easy Run 4km', 'Easy short run. Resist the urge to prove fitness in training. Save it for race day.'],
      ['Rest', 'Rest day.'],
      ['Bike 45 min', 'Easy-moderate ride with 2×5 min at race effort to stay sharp. This is your last real bike session.'],
      ['Rest', 'Rest.'],
    ]
  },
  {
    weekNum: 20, phase: 4, label: 'Week 20  Aug 17–23',
    days: [
      ['Swim 1,400m', 'Warm-up 200m. Main: 4×200m race pace, 30s rest. Cool-down 200m. Short and sharp. You should feel strong.'],
      ['Easy Run 4.5km', 'Easy run. 2 weeks to race day! Start visualizing your transitions, your race plan.'],
      ['Swim 1,200m', 'Warm-up 200m. Drill: 100m. Main: 600m race-easy. Cool-down 200m. Keep the water feel fresh.'],
      ['Sharpener Run 4km', 'Warm-up 1km. Main: 2km at race pace. Cool-down 1km. Last hard run effort. Note how good it feels.'],
      ['Rest', 'Rest day.'],
      ['Bike 30 min', 'Easy spin. Just keep the legs loose. No effort required.'],
      ['Rest', 'Rest.'],
    ]
  },
  {
    weekNum: 21, phase: 4, label: 'Week 21  Aug 24–30',
    days: [
      ['Swim 1,000m', 'Warm-up 200m. Main: 2×250m race pace, 45s rest. Cool-down 300m. Very light. Just feel the water.'],
      ['Easy Run 4km', 'Easy short run. Race week next week! Keep it gentle.'],
      ['Swim 800m', 'Warm-up 150m. Main: 4×100m at race pace with long 40s rest. Cool-down 150m. Short and crisp.'],
      ['Easy Run 3km', 'Short easy jog. Legs should feel fresh and springy — that\'s the taper working!'],
      ['Rest', 'Full rest. Final rest day before race week.'],
      ['Easy Spin 20 min', 'Very light ride. Just to keep legs loose. This is your last bike before race day.'],
      ['Rest', 'Rest and begin pre-race preparation.'],
    ]
  },
  {
    weekNum: 22, phase: 4, label: 'Race Week  Sep 1–6',
    days: [
      ['Rest', 'Full rest. Prepare kit, check bike.'],
      ['Swim 600m', 'Very easy 600m. Warm-up only. Drills and easy laps. No effort whatsoever. Just feel the water and relax.'],
      ['Easy Jog 3km', 'Very easy 3km jog. Just to keep legs loose. Last run before race day.'],
      ['Rest', 'Full rest. Finalize race kit. Lay everything out: goggles, wetsuit (if needed), bike helmet, race number, running shoes. Prepare race-day nutrition.'],
      ['Rest', 'Full rest. Travel to race venue if needed. Light walk only. Early bedtime.'],
      ['Rest', 'Rest. If possible, rack your bike at the venue. Do a quick 10-minute easy jog or swim to stay loose. Carb-load dinner tonight. Early to bed!'],
      ['🏅 RACE DAY!', 'Sprint Triathlon: 1km Swim → 20km Bike → 5km Run. Target finish: 60–65 minutes. Start the swim easy (first 200m), settle in. Hammer the bike — it\'s your strength. Run strong. Enjoy every moment — you\'ve earned this!'],
    ]
  },
];

// Build output
const output: {
  phases: Array<{
    phaseNumber: number;
    name: { en: string; de: string };
    description: { en: string; de: string };
    startDate: string;
    endDate: string;
  }>;
  weeks: RawWeek[];
  drills: Array<{ name: string; slug: string; description: string }>;
} = {
  phases: [
    {
      phaseNumber: 1,
      name: { en: 'Base Building', de: 'Grundlagenaufbau' },
      description: {
        en: 'Build your aerobic base across all three disciplines. Keep efforts easy and conversational. Volume builds gradually.',
        de: 'Baue deine aerobe Basis in allen drei Disziplinen auf. Halte die Belastung locker und im Gesprächstempo. Das Volumen steigt schrittweise.'
      },
      startDate: '2026-04-06',
      endDate: '2026-05-17',
    },
    {
      phaseNumber: 2,
      name: { en: 'Build', de: 'Aufbau' },
      description: {
        en: 'Volume and intensity increase. Structured intervals and tempo work begin. Brick sessions introduce the crucial bike-to-run transition.',
        de: 'Umfang und Intensität steigen. Strukturierte Intervalle und Tempoarbeit beginnen. Koppeltraining führt den wichtigen Rad-Lauf-Übergang ein.'
      },
      startDate: '2026-05-18',
      endDate: '2026-06-28',
    },
    {
      phaseNumber: 3,
      name: { en: 'Race-Specific', de: 'Rennspezifisch' },
      description: {
        en: 'Race-specific training. Sessions simulate race conditions. Open-water swimming, race-pace bike efforts, and longer bricks.',
        de: 'Rennspezifisches Training. Einheiten simulieren Wettkampfbedingungen. Freiwasserschwimmen, Renntempo auf dem Rad und längere Koppeltrainings.'
      },
      startDate: '2026-06-29',
      endDate: '2026-08-02',
    },
    {
      phaseNumber: 4,
      name: { en: 'Taper', de: 'Tapering' },
      description: {
        en: 'Volume drops 40–50% while intensity stays. Your body absorbs all the hard work and peaks on race day.',
        de: 'Umfang sinkt um 40–50%, Intensität bleibt. Dein Körper verarbeitet die harte Arbeit und erreicht am Renntag die Höchstform.'
      },
      startDate: '2026-08-03',
      endDate: '2026-09-06',
    },
  ],
  weeks: [],
  drills: [
    {
      name: 'Catch-Up Drill',
      slug: 'catch-up',
      description: 'One arm stays fully extended in front while the other completes a full stroke cycle. Your pulling hand "catches up" to the resting hand before the other arm begins pulling. This forces you to pause and glide, teaching you to have one arm fully extended at all times — the foundation of a long, efficient freestyle stroke. It also slows things down so you can feel each phase of the stroke.',
    },
    {
      name: 'Finger-Drag Drill',
      slug: 'finger-drag',
      description: 'During the recovery phase (when your arm is out of the water moving forward), drag your fingertips lightly along the surface of the water. This forces your elbow to stay high during recovery, which is the correct position. A dropped elbow during recovery is one of the most common technique flaws and leads to a weak entry and poor catch.',
    },
    {
      name: 'Side-Kick Drill',
      slug: 'side-kick',
      description: 'You swim on your side — bottom arm extended in front, top arm resting on your thigh — and kick continuously while keeping your face in the water, rotating only to breathe. This teaches body rotation, which is the engine of freestyle. Rotating your hips with each stroke lets you use your powerful back and core muscles rather than just your shoulders, which delays fatigue significantly.',
    },
    {
      name: 'Single-Arm Drill',
      slug: 'single-arm',
      description: 'One arm stays at your side (or extended in front) while you swim using only the other arm. This isolates each arm so you can focus on the full stroke mechanics — entry, catch, pull, and push — without the other arm compensating. Swimmers often discover their weaker arm has a very different stroke than their stronger one. Alternate arms every 25m or every 6 strokes.',
    },
    {
      name: 'Fist Drill',
      slug: 'fist',
      description: 'You swim normal freestyle but with both hands balled into fists. Since you can\'t use your palm to catch the water, you\'re forced to use your forearm as the main surface. This teaches you the "high elbow catch" — where the forearm faces backward (not downward) in the water during the pull. When you open your fists again, your hands feel enormous and the catch feels much more powerful. Do 50m with fists, then 50m normal to feel the contrast.',
    },
    {
      name: 'Open-Water Sighting',
      slug: 'open-water-sighting',
      description: 'Every 8–10 strokes, lift your eyes (not your whole head) just above the water line to look forward — like a crocodile — then rotate to breathe as normal. This lets you swim in a straight line in open water where there\'s no black line on the pool floor to follow. Lifting your full head causes your hips to drop and adds drag, so the key is a quick, minimal lift — just enough to spot a buoy.',
    },
  ],
};

// Generate weeks
for (const wd of weekData) {
  const weekStartDate = addDays(PLAN_START, (wd.weekNum - 1) * 7);
  const weekEndDate = addDays(weekStartDate, 6);

  const trainings: RawTraining[] = wd.days.map((day, idx) => {
    const [title, description] = day;
    const date = addDays(weekStartDate, idx);
    const sport = detectSport(title, description);

    return {
      date,
      dayOfWeek: idx,
      sport,
      title,
      description,
      distanceMeters: parseDistance(title, description, sport),
      durationMinutes: parseDuration(title),
      drillSlugs: detectDrills(description),
      weekNumber: wd.weekNum,
    };
  });

  output.weeks.push({
    weekNumber: wd.weekNum,
    label: wd.label,
    startDate: weekStartDate,
    endDate: weekEndDate,
    phaseNumber: wd.phase,
    trainings,
  });
}

// Write output
const outPath = path.join(__dirname, 'training-data.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Written ${outPath}`);
console.log(`Phases: ${output.phases.length}`);
console.log(`Weeks: ${output.weeks.length}`);
console.log(`Total trainings: ${output.weeks.reduce((sum, w) => sum + w.trainings.length, 0)}`);
console.log(`Drills: ${output.drills.length}`);

// Verify
for (const week of output.weeks) {
  if (week.trainings.length !== 7) {
    console.error(`Week ${week.weekNumber} has ${week.trainings.length} days!`);
  }
  for (const t of week.trainings) {
    if (t.sport === 'rest' && t.title.toLowerCase() !== 'rest' && !t.title.includes('RACE')) {
      console.warn(`Week ${week.weekNumber}, ${t.title}: detected as rest but title doesn't match`);
    }
  }
}
