import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/settings?strava=denied`);
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const redirectUri = `${appUrl}/api/strava/callback`;

  const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${appUrl}/settings?strava=error`);
  }

  const { access_token, refresh_token, expires_at, athlete } = await tokenResponse.json();

  await supabase.from('profiles').update({
    strava_athlete_id: athlete?.id ?? null,
    strava_access_token: access_token,
    strava_refresh_token: refresh_token,
    strava_token_expires_at: new Date(expires_at * 1000).toISOString(),
  }).eq('id', session.user.id);

  return NextResponse.redirect(`${appUrl}/settings?strava=connected`);
}
