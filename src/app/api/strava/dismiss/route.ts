import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { stravaActivityId } = await request.json();
  if (!stravaActivityId) {
    return NextResponse.json({ error: 'Missing stravaActivityId' }, { status: 400 });
  }

  await supabase
    .from('strava_activities')
    .update({ dismissed: true })
    .eq('id', stravaActivityId)
    .eq('user_id', session.user.id);

  return NextResponse.json({ ok: true });
}
