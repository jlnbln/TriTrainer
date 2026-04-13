'use client';

import { useEffect, useState } from 'react';
import { RACE_DATE } from '@/lib/constants';

interface CountdownProps {
  raceDate?: string;
  swimDistanceM?: number;
  bikeDistanceKm?: number;
  runDistanceKm?: number;
}

export function Countdown({
  raceDate: raceDateProp,
  swimDistanceM = 750,
  bikeDistanceKm = 20,
  runDistanceKm = 5,
}: CountdownProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!now) {
    return <div className="h-40 animate-pulse rounded-3xl bg-muted" />;
  }

  const raceDateStr = raceDateProp || RACE_DATE;
  const raceDate = new Date(raceDateStr + 'T12:00:00Z');
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = raceDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const isPast = diffDays <= 0;

  const raceDateFormatted = raceDate.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  const swimLabel = swimDistanceM >= 1000
    ? `${(swimDistanceM / 1000).toFixed(swimDistanceM % 1000 === 0 ? 0 : 1)}km swim`
    : `${swimDistanceM}m swim`;
  const bikeLabel = `${bikeDistanceKm}km bike`;
  const runLabel = `${runDistanceKm}km run`;

  return (
    <div className="relative p-[1px] rounded-3xl bg-gradient-to-br from-primary to-secondary">
      <div className="bg-card rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-block px-3 py-0.5 bg-primary/20 text-primary font-headline text-[9px] tracking-[0.15em] font-bold rounded-lg mb-3">
            COUNTDOWN
          </span>

          {isPast ? (
            <p className="font-headline font-black text-3xl text-foreground">Race Complete! 🏅</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-headline font-black text-5xl tabular-nums text-foreground">{diffDays}</span>
                <span className="font-headline font-bold text-xl text-muted-foreground">days to Race Day</span>
              </div>
              <p className="text-muted-foreground text-sm mb-5">
                {diffWeeks > 0 ? `${diffWeeks} weeks · ` : ''}{raceDateFormatted}
              </p>
            </>
          )}

          <div className="flex flex-wrap items-center gap-4 border-t border-border/30 pt-4">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg" style={{ color: 'var(--sport-swim)' }}>pool</span>
              <span className="font-headline font-bold text-sm" style={{ color: 'var(--sport-swim)' }}>{swimLabel}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg" style={{ color: 'var(--sport-bike)' }}>directions_bike</span>
              <span className="font-headline font-bold text-sm" style={{ color: 'var(--sport-bike)' }}>{bikeLabel}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg" style={{ color: 'var(--sport-run)' }}>directions_run</span>
              <span className="font-headline font-bold text-sm" style={{ color: 'var(--sport-run)' }}>{runLabel}</span>
            </div>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
          <svg width="200" height="120" viewBox="0 0 200 120" fill="none">
            <path d="M0 120L200 0H230L30 120H0Z" fill="white" />
            <path d="M40 120L240 0H270L70 120H40Z" fill="white" />
          </svg>
        </div>
      </div>
    </div>
  );
}
