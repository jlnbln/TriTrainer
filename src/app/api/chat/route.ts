import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a helpful triathlon training assistant. You have access to the user's full 22-week sprint triathlon training plan (1km Swim, 20km Bike, 5km Run - race day September 6, 2026).

You can help with:
- Explaining training sessions and their purpose
- Suggesting modifications to sessions (if the user is injured, tired, or wants to adjust)
- Answering questions about technique, nutrition, pacing, and race strategy
- Providing encouragement and motivation

When the user wants to modify a training session, respond with your suggestion and include a JSON block like this:
\`\`\`modify
{"training_id": 123, "new_title": "...", "new_description": "..."}
\`\`\`

The user's training plan data will be provided in the first message.

Keep responses concise and practical. You're talking to a first-time triathlete.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message, history } = await request.json();

  // Fetch training plan context on first message or if history is empty
  let planContext = '';
  if (!history || history.length === 0) {
    const { data: trainings } = await supabase
      .from('trainings')
      .select('id, date, sport, title, description, distance_meters, duration_minutes, completions(id)')
      .order('date', { ascending: true });

    if (trainings) {
      planContext = '\n\nHere is the full training plan:\n' +
        trainings.map((t: any) => {
          const completed = t.completions && t.completions.length > 0 ? ' [COMPLETED]' : '';
          return `[ID:${t.id}] ${t.date} | ${t.sport} | ${t.title}${completed}\n  ${t.description || ''}`;
        }).join('\n');
    }
  }

  // Build messages for OpenRouter
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + planContext },
    ...(history || []).map((h: any) => ({
      role: h.role,
      content: h.content,
    })),
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
        model: 'anthropic/claude-sonnet-4',
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

    // Check for training modification commands
    const modifyMatch = assistantMessage.match(/```modify\n([\s\S]*?)\n```/);
    if (modifyMatch) {
      try {
        const modification = JSON.parse(modifyMatch[1]);
        if (modification.training_id) {
          // Get original description
          const { data: original } = await supabase
            .from('trainings')
            .select('description, title')
            .eq('id', modification.training_id)
            .single();

          // Apply modification
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
        // Ignore parse errors for modifications
      }
    }

    // Save messages to history
    await supabase.from('chat_messages').insert([
      { user_id: user.id, role: 'user', content: message },
      { user_id: user.id, role: 'assistant', content: assistantMessage },
    ]);

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get response' },
      { status: 500 }
    );
  }
}
