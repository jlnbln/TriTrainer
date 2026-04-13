import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const ANALYSIS_PROMPT = `You are analyzing an Apple Fitness / Apple Watch workout screenshot. Extract ALL visible workout data and return it as a JSON object.

The screenshot may be in German (e.g. "Trainingszeit" = training time, "Strecke" = distance, "Bahnen" = laps, "Beckenlänge" = pool length, "Herzfrequenz" = heart rate, "Pace" = pace, "Kadenz" = cadence, "Leistung" = power, "Höhenmeter" = elevation, "Kalorien" = calories, "Anstrengung" = effort).

Return ONLY a valid JSON object with these fields (use null for fields not visible):
{
  "workout_name": "string (e.g. 'Beckenschwimmen', 'Laufen outdoor', 'Rad indoor', 'Kombinationssport')",
  "workout_date": "YYYY-MM-DD or null",
  "sport_type": "swim | run | bike | brick | other",
  "duration_seconds": number (convert HH:MM:SS to total seconds),
  "distance_meters": number or null (convert km to meters),
  "avg_heart_rate_bpm": number or null,
  "avg_pace_seconds": number or null (seconds per 100m for swim, seconds per km for run/bike),
  "calories_active": number or null,
  "calories_total": number or null,
  "elevation_meters": number or null,
  "avg_cadence_spm": number or null,
  "avg_power_watts": number or null,
  "pool_length_meters": number or null,
  "laps": number or null,
  "effort_level": number or null (1-10 scale from Anstrengung),
  "sub_activities": array or null (for brick/multisport, each with same fields above),
  "raw_text": "all text visible in screenshot as a single string"
}

For dates: "Mo. 6. Apr." = 2026-04-06, "Di. 7. Apr." = 2026-04-07, etc. Assume year 2026.
For pace: "2'09\"/100m" = 129 seconds. "6'47\"/km" = 407 seconds.
For duration: "0:32:41" = 1961 seconds. "1:49:13" = 6553 seconds.
For effort: look for "Anstrengung" with a number 1-10.

Return ONLY the JSON, no explanation.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('image') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mimeType = file.type || 'image/jpeg';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: ANALYSIS_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: 'OpenRouter error: ' + error }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Strip markdown code fences (```json ... ``` or ``` ... ```) if present
    const jsonStr = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const workout = JSON.parse(jsonStr);

    return NextResponse.json({ workout });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to analyze image: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
