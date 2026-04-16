import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token')
    .eq('id', session.user.id)
    .single();

  if (profile?.strava_access_token) {
    // best-effort deauthorization
    fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${profile.strava_access_token}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => {});
  }

  await supabase.from('profiles').update({
    strava_athlete_id: null,
    strava_access_token: null,
    strava_refresh_token: null,
    strava_token_expires_at: null,
    strava_last_sync_at: null,
  }).eq('id', session.user.id);

  return NextResponse.json({ ok: true });
}
