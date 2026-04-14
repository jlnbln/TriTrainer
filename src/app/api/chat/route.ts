import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function formatPace(seconds: number, sport: string): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  const unit = sport === 'swim' ? '/100m' : '/km';
  return `${m}'${String(s).padStart(2, '0')}"${unit}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${m}m${s}s`;
  return `${m}m${s}s`;
}

function buildSystemPrompt(profile: any): string {
  const swimM = profile?.swim_distance_m ?? 750;
  const bikeKm = Number(profile?.bike_distance_km ?? 20);
  const runKm = Number(profile?.run_distance_km ?? 5);
  const raceDate = profile?.race_date ?? '2026-09-06';
  const swimLabel = swimM >= 1000 ? `${swimM / 1000}km` : `${swimM}m`;

  const raceDateFormatted = new Date(raceDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // Goal paces derived from goal times
  const goalLines: string[] = [];
  if (profile?.swim_goal_minutes) {
    const pace = (profile.swim_goal_minutes * 60) / (swimM / 100);
    goalLines.push(`  - Swim ${swimLabel} in ≤${profile.swim_goal_minutes} min (target pace: ${formatPace(pace, 'swim')})`);
  }
  if (profile?.bike_goal_minutes) {
    const pace = (profile.bike_goal_minutes * 60) / bikeKm;
    goalLines.push(`  - Bike ${bikeKm}km in ≤${profile.bike_goal_minutes} min (target pace: ${formatPace(pace, 'bike')})`);
  }
  if (profile?.run_goal_minutes) {
    const pace = (profile.run_goal_minutes * 60) / runKm;
    goalLines.push(`  - Run ${runKm}km in ≤${profile.run_goal_minutes} min (target pace: ${formatPace(pace, 'run')})`);
  }

  const athleteLines: string[] = [];
  if (profile?.name) athleteLines.push(`Name: ${profile.name}`);
  if (profile?.weight_kg) athleteLines.push(`Weight: ${profile.weight_kg}kg`);
  if (profile?.height_cm) athleteLines.push(`Height: ${profile.height_cm}cm`);

  return `You are a helpful triathlon training assistant for a first-time triathlete.

RACE: Sprint Triathlon on ${raceDateFormatted} — ${swimLabel} Swim · ${bikeKm}km Bike · ${runKm}km Run
${goalLines.length > 0 ? `\nRACE GOALS:\n${goalLines.join('\n')}` : ''}
${athleteLines.length > 0 ? `\nATHLETE: ${athleteLines.join(', ')}` : ''}

You can help with:
- Explaining training sessions and their purpose
- Suggesting modifications (injury, fatigue, schedule changes)
- Technique, nutrition, pacing, and race strategy
- Interpreting actual workout data (heart rate, pace trends, progress)
- Providing encouragement and motivation

When the user wants to modify a training session, include a JSON block:
\`\`\`modify
{"training_id": 123, "new_title": "...", "new_description": "..."}
\`\`\`

The user's full training plan and actual workout data are provided below. Keep responses concise and practical.`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, history } = await request.json();

  // Fetch full profile (race config + athlete stats)
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, weight_kg, height_cm, race_date, swim_distance_m, bike_distance_km, run_distance_km, swim_goal_minutes, bike_goal_minutes, run_goal_minutes')
    .eq('id', user.id)
    .single();

  const systemPrompt = buildSystemPrompt(profile);

  // Build rich context on first message (or empty history)
  let context = '';
  if (!history || history.length === 0) {
    // Fetch trainings
    const { data: trainings } = await supabase
      .from('trainings')
      .select('id, date, sport, title, description, distance_meters, duration_minutes')
      .order('date', { ascending: true });

    // Fetch completions separately (avoid RLS nested-join issue)
    const { data: completions } = await supabase
      .from('completions')
      .select(`
        training_id, completed_at, notes,
        actual_distance_meters, workout_duration_seconds,
        avg_heart_rate_bpm, avg_pace_seconds, calories_active,
        elevation_meters, avg_cadence_spm, avg_power_watts,
        effort_level, workout_name, workout_date
      `)
      .eq('user_id', user.id);

    const completionMap = new Map(
      (completions || []).map((c: any) => [c.training_id, c])
    );

    if (trainings) {
      context += '\n\n--- TRAINING PLAN ---\n';
      context += trainings.map((t: any) => {
        const c = completionMap.get(t.id);
        if (!c) {
          return `[ID:${t.id}] ${t.date} | ${t.sport.toUpperCase()} | ${t.title}\n  ${t.description || ''}`;
        }
        // Completed — include actual workout data if available
        const parts: string[] = [];
        if (c.workout_duration_seconds) parts.push(`duration: ${formatDuration(c.workout_duration_seconds)}`);
        if (c.actual_distance_meters) {
          const dist = c.actual_distance_meters >= 1000
            ? `${(c.actual_distance_meters / 1000).toFixed(2)}km`
            : `${c.actual_distance_meters}m`;
          parts.push(`distance: ${dist}`);
        }
        if (c.avg_pace_seconds) parts.push(`pace: ${formatPace(c.avg_pace_seconds, t.sport)}`);
        if (c.avg_heart_rate_bpm) parts.push(`avg HR: ${c.avg_heart_rate_bpm}bpm`);
        if (c.calories_active) parts.push(`calories: ${c.calories_active}kcal`);
        if (c.elevation_meters) parts.push(`elevation: ${c.elevation_meters}m`);
        if (c.avg_cadence_spm) parts.push(`cadence: ${c.avg_cadence_spm}spm`);
        if (c.avg_power_watts) parts.push(`power: ${c.avg_power_watts}W`);
        if (c.effort_level) parts.push(`effort: ${c.effort_level}/10`);
        if (c.notes) parts.push(`notes: "${c.notes}"`);

        const actualData = parts.length > 0 ? `\n  ACTUAL: ${parts.join(' | ')}` : '';
        return `[ID:${t.id}] ${t.date} | ${t.sport.toUpperCase()} | ${t.title} ✓ COMPLETED${actualData}\n  PLANNED: ${t.description || ''}`;
      }).join('\n');
    }

    // Analytics summary
    const completedWithData = (completions || []).filter((c: any) => c.avg_pace_seconds || c.actual_distance_meters);
    if (completedWithData.length > 0) {
      const swimSessions = completedWithData.filter((c: any) => {
        const t = trainings?.find((t: any) => t.id === c.training_id);
        return t?.sport === 'swim';
      });
      const runSessions = completedWithData.filter((c: any) => {
        const t = trainings?.find((t: any) => t.id === c.training_id);
        return t?.sport === 'run';
      });
      const bikeSessions = completedWithData.filter((c: any) => {
        const t = trainings?.find((t: any) => t.id === c.training_id);
        return t?.sport === 'bike';
      });

      context += '\n\n--- ANALYTICS SUMMARY ---\n';
      context += `Completed sessions with data: ${completedWithData.length}\n`;

      for (const [label, sessions, sport] of [
        ['Swim', swimSessions, 'swim'],
        ['Run', runSessions, 'run'],
        ['Bike', bikeSessions, 'bike'],
      ] as const) {
        if (sessions.length === 0) continue;
        const totalDist = sessions.reduce((s: number, c: any) => s + (c.actual_distance_meters || 0), 0);
        const paceItems = sessions.filter((c: any) => c.avg_pace_seconds);
        const latestPace = paceItems.length > 0 ? paceItems[paceItems.length - 1].avg_pace_seconds : null;
        const hrItems = sessions.filter((c: any) => c.avg_heart_rate_bpm);
        const avgHR = hrItems.length > 0
          ? Math.round(hrItems.reduce((s: number, c: any) => s + c.avg_heart_rate_bpm, 0) / hrItems.length)
          : null;

        const distLabel = sport === 'swim'
          ? `${Math.round(totalDist)}m total`
          : `${(totalDist / 1000).toFixed(1)}km total`;

        context += `${label}: ${sessions.length} sessions, ${distLabel}`;
        if (latestPace) context += `, latest pace: ${formatPace(latestPace, sport)}`;
        if (avgHR) context += `, avg HR: ${avgHR}bpm`;
        context += '\n';
      }
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt + context },
    ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'minimax/minimax-m2.7',
        messages,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: 'OpenRouter error: ' + error }, { status: 500 });
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Apply training modification commands
    const modifyMatch = assistantMessage.match(/```modify\n([\s\S]*?)\n```/);
    if (modifyMatch) {
      try {
        const modification = JSON.parse(modifyMatch[1]);
        if (modification.training_id) {
          const { data: original } = await supabase
            .from('trainings')
            .select('description, title')
            .eq('id', modification.training_id)
            .single();

          await supabase
            .from('trainings')
            .update({
              title: modification.new_title || original?.title,
              description: modification.new_description || original?.description,
              is_modified: true,
              original_description: original?.description,
              updated_at: new Date().toISOString(),
            })
            .eq('id', modification.training_id);
        }
      } catch {
        // Ignore parse errors
      }
    }

    await supabase.from('chat_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: assistantMessage },
    ]);

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
