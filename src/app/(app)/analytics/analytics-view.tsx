'use client';

import { SPORT_CONFIG } from '@/lib/constants';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface RaceConfig {
  raceDate: string;
  swimDistanceM: number;
  bikeDistanceKm: number;
  runDistanceKm: number;
  swimGoalMinutes: number | null;
  bikeGoalMinutes: number | null;
  runGoalMinutes: number | null;
}

interface AnalyticsViewProps {
  relevantTrainings: any[];    // all non-rest sessions in weeks 1..currentWeek
  completedTrainings: any[];   // subset of above that have a completion
  withWorkoutData: any[];      // subset with screenshot data uploaded
  thisWeekTrainings: any[];    // non-rest sessions in current week only
  daysUntilRace: number;
  currentWeek: number;
  totalWeeks: number;
  raceConfig: RaceConfig;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatPace(seconds: number, sport: string): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const unit = sport === 'swim' ? '/100m' : '/km';
  return `${m}'${String(s).padStart(2, '0')}"${unit}`;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border/40 p-4">
      <p className="font-headline text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">{label}</p>
      <p className="font-headline font-extrabold text-2xl" style={color ? { color } : undefined}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ value, max, color, label, sublabel }: {
  value: number; max: number; color: string; label: string; sublabel?: string;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-headline text-xs font-semibold text-foreground">{label}</span>
        <span className="font-headline text-xs text-muted-foreground">{sublabel ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function PaceTrend({ entries, sport }: { entries: { date: string; pace: number }[]; sport: string }) {
  if (entries.length < 2) return null;
  const max = Math.max(...entries.map(e => e.pace));
  const min = Math.min(...entries.map(e => e.pace));
  const range = max - min || 1;
  const latest = entries[entries.length - 1];
  const first = entries[0];
  const improving = latest.pace < first.pace;

  return (
    <div className="mt-2">
      <div className="flex items-end gap-1 h-12">
        {entries.map((e, i) => {
          const heightPct = ((e.pace - min) / range) * 80 + 20;
          const isLatest = i === entries.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${heightPct}%`,
                  background: isLatest
                    ? `var(--sport-${sport})`
                    : `color-mix(in srgb, var(--sport-${sport}) 40%, transparent)`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
        <span>{new Date(first.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span className={improving ? 'text-green-400' : 'text-muted-foreground'}>
          {improving ? '↓' : '↑'} {formatPace(latest.pace, sport)}
        </span>
        <span>{new Date(latest.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

export function AnalyticsView({
  relevantTrainings,
  completedTrainings,
  withWorkoutData,
  thisWeekTrainings,
  daysUntilRace,
  currentWeek,
  totalWeeks,
  raceConfig,
}: AnalyticsViewProps) {
  const completionRate = relevantTrainings.length > 0
    ? Math.round((completedTrainings.length / relevantTrainings.length) * 100)
    : 0;

  // Per-sport stats for all-time (volume, pace trends, HR)
  const sports = ['swim', 'run', 'bike', 'brick'] as const;
  const allTimeSportStats = sports.map(sport => {
    const withData = withWorkoutData.filter(t => t.sport === sport);

    const totalDistance = withData.reduce((sum, t) => sum + (t.completion?.actual_distance_meters || 0), 0);
    const totalDuration = withData.reduce((sum, t) => sum + (t.completion?.workout_duration_seconds || 0), 0);

    const hrItems = withData.filter(t => t.completion?.avg_heart_rate_bpm);
    const avgHR = hrItems.length > 0
      ? Math.round(hrItems.reduce((sum, t) => sum + t.completion.avg_heart_rate_bpm, 0) / hrItems.length)
      : null;

    const paceEntries = withData
      .filter(t => t.completion?.avg_pace_seconds)
      .map(t => ({ date: t.completion.workout_date || t.date, pace: t.completion.avg_pace_seconds }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    return { sport, totalDistance, totalDuration, avgHR, paceEntries, sessionCount: withData.length };
  });

  // Per-sport THIS WEEK (for completion breakdown)
  const thisWeekSportStats = sports.map(sport => {
    const planned = thisWeekTrainings.filter(t => t.sport === sport);
    const done = planned.filter(t => t.completion !== null);
    return { sport, planned: planned.length, done: done.length };
  }).filter(s => s.planned > 0);

  // Derive race pace targets from goal times + distances
  function paceLabel(seconds: number, sport: string) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    const unit = sport === 'swim' ? '/100m' : '/km';
    return `${m}'${String(s).padStart(2, '0')}"${unit}`;
  }
  const raceTargets: Record<string, { pace: number; label: string } | null> = {
    swim: raceConfig.swimGoalMinutes
      ? (() => {
          const pace = (raceConfig.swimGoalMinutes * 60) / (raceConfig.swimDistanceM / 100);
          return { pace: Math.round(pace), label: paceLabel(pace, 'swim') };
        })()
      : null,
    run: raceConfig.runGoalMinutes
      ? (() => {
          const pace = (raceConfig.runGoalMinutes * 60) / raceConfig.runDistanceKm;
          return { pace: Math.round(pace), label: paceLabel(pace, 'run') };
        })()
      : null,
    bike: raceConfig.bikeGoalMinutes
      ? (() => {
          const pace = (raceConfig.bikeGoalMinutes * 60) / raceConfig.bikeDistanceKm;
          return { pace: Math.round(pace), label: paceLabel(pace, 'bike') };
        })()
      : null,
  };

  // Total volume
  const totalDistanceKm = withWorkoutData.reduce((sum, t) => sum + ((t.completion?.actual_distance_meters || 0) / 1000), 0);
  const totalTimeMin = withWorkoutData.reduce((sum, t) => sum + ((t.completion?.workout_duration_seconds || 0) / 60), 0);
  const totalCal = withWorkoutData.reduce((sum, t) => sum + (t.completion?.calories_active || 0), 0);

  // History list: completedTrainings newest-first
  const historyItems = [...completedTrainings].reverse();

  return (
    <div className="max-w-lg mx-auto px-5 pt-4 pb-8">
      <h1 className="font-headline font-extrabold text-3xl tracking-tight mb-1">Analytics</h1>
      <p className="text-muted-foreground text-sm mb-4">Your progress toward race day</p>

      <Tabs defaultValue="overview">
        <TabsList className="w-full mb-6 bg-card border border-border/40 p-1 h-auto rounded-xl">
          <TabsTrigger value="overview" className="flex-1 py-2 rounded-lg font-headline text-xs font-bold uppercase tracking-widest data-active:bg-muted data-active:text-primary">
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 py-2 rounded-lg font-headline text-xs font-bold uppercase tracking-widest data-active:bg-muted data-active:text-primary">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">

      {/* Race Countdown */}
      <div
        className="rounded-2xl p-5 mb-6 relative overflow-hidden"
        style={{ background: 'color-mix(in srgb, var(--sport-race) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--sport-race) 25%, transparent)' }}
      >
        <div className="absolute right-4 top-4 opacity-10">
          <span className="material-symbols-outlined text-6xl" style={{ color: 'var(--sport-race)' }}>emoji_events</span>
        </div>
        <p className="font-headline text-[10px] uppercase tracking-[0.15em] mb-1" style={{ color: 'var(--sport-race)' }}>
          Sprint Triathlon · {new Date(raceConfig.raceDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="font-headline font-extrabold text-5xl" style={{ color: 'var(--sport-race)' }}>
            {daysUntilRace}
          </span>
          <span className="font-headline font-bold text-xl text-muted-foreground">days to race</span>
        </div>
        <div className="mt-3">
          <ProgressBar
            value={currentWeek - 1}
            max={totalWeeks}
            color="var(--sport-race)"
            label=""
            sublabel={`Week ${currentWeek} of ${totalWeeks}`}
          />
        </div>
      </div>

      {/* Training Consistency */}
      <section className="mb-6">
        <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">
          Training Consistency
        </h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard
            label="Completion"
            value={`${completionRate}%`}
            sub={`${completedTrainings.length}/${relevantTrainings.length} sessions`}
            color={completionRate >= 80 ? 'var(--sport-run)' : completionRate >= 60 ? 'var(--sport-race)' : 'var(--sport-brick)'}
          />
          <StatCard
            label="Current Week"
            value={`${currentWeek}`}
            sub={`of ${totalWeeks} weeks`}
          />
          <StatCard
            label="Logged"
            value={`${withWorkoutData.length}`}
            sub="with screenshot"
          />
        </div>

        {/* This week's per-sport breakdown */}
        <div className="bg-card rounded-2xl border border-border/40 p-4">
          <p className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">
            This Week (Week {currentWeek})
          </p>
          <div className="space-y-3">
            {thisWeekSportStats.map(({ sport, planned, done }) => (
              <ProgressBar
                key={sport}
                value={done}
                max={planned}
                color={`var(--sport-${sport})`}
                label={SPORT_CONFIG[sport as keyof typeof SPORT_CONFIG].label.en}
                sublabel={`${done}/${planned}`}
              />
            ))}
            {thisWeekSportStats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">No sessions planned this week yet</p>
            )}
          </div>
        </div>
      </section>

      {/* Volume Summary */}
      {withWorkoutData.length > 0 && (
        <section className="mb-6">
          <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">
            Total Volume
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Distance" value={`${totalDistanceKm.toFixed(1)}`} sub="km total" />
            <StatCard label="Time" value={`${Math.round(totalTimeMin)}`} sub="min training" />
            {totalCal > 0 && (
              <StatCard
                label="Calories"
                value={`${(Math.round(totalCal / 100) / 10).toFixed(1)}k`}
                sub="kcal burned"
              />
            )}
          </div>
        </section>
      )}

      {/* Per-sport details (all-time, only if data uploaded) */}
      {allTimeSportStats.filter(s => s.sessionCount > 0).map(({ sport, totalDistance, totalDuration, avgHR, paceEntries, sessionCount }) => {
        const config = SPORT_CONFIG[sport as keyof typeof SPORT_CONFIG];
        const target = raceTargets[sport] ?? null;
        const latestPace = paceEntries.length > 0 ? paceEntries[paceEntries.length - 1].pace : null;
        const distKm = totalDistance / 1000;
        const raceDistances: Record<string, number> = {
          swim: raceConfig.swimDistanceM / 1000,
          run: raceConfig.runDistanceKm,
          bike: raceConfig.bikeDistanceKm,
        };
        const raceDistKm = raceDistances[sport];

        return (
          <section key={sport} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{config.emoji}</span>
              <h2 className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {config.label.en}
              </h2>
            </div>

            <div className="bg-card rounded-2xl border border-border/40 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: `var(--sport-${sport})` }} />
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="font-headline text-[10px] uppercase tracking-wider text-muted-foreground">Sessions</p>
                    <p className="font-headline font-bold text-xl" style={{ color: `var(--sport-${sport})` }}>{sessionCount}</p>
                  </div>
                  {totalDistance > 0 && (
                    <div>
                      <p className="font-headline text-[10px] uppercase tracking-wider text-muted-foreground">Distance</p>
                      <p className="font-headline font-bold text-xl text-foreground">
                        {sport === 'swim' ? `${Math.round(totalDistance)}m` : `${distKm.toFixed(1)}km`}
                      </p>
                    </div>
                  )}
                  {totalDuration > 0 && (
                    <div>
                      <p className="font-headline text-[10px] uppercase tracking-wider text-muted-foreground">Time</p>
                      <p className="font-headline font-bold text-xl text-foreground">{formatDuration(totalDuration)}</p>
                    </div>
                  )}
                </div>

                {avgHR && (
                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <span className="material-symbols-outlined text-red-400 text-base">favorite</span>
                    <span className="text-muted-foreground">Avg HR:</span>
                    <span className="font-headline font-bold text-red-400">{avgHR} bpm</span>
                  </div>
                )}

                {latestPace && target && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Latest pace vs. race target</span>
                      <span className={`text-xs font-headline font-bold ${latestPace <= target.pace ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {latestPace <= target.pace ? 'On target!' : `Target: ${target.label}`}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (target.pace / latestPace) * 100)}%`,
                          background: latestPace <= target.pace ? 'var(--sport-run)' : `var(--sport-${sport})`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>{formatPace(latestPace, sport)}</span>
                      <span>Goal: {target.label}</span>
                    </div>
                  </div>
                )}

                {paceEntries.length >= 2 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline mb-1">Pace Trend</p>
                    <PaceTrend entries={paceEntries} sport={sport} />
                  </div>
                )}

                {raceDistKm && totalDistance > 0 && (
                  <div className="mt-3">
                    <ProgressBar
                      value={distKm}
                      max={raceDistKm * 5}
                      color={`var(--sport-${sport})`}
                      label="Cumulative vs. race distance ×5"
                      sublabel={sport === 'swim'
                        ? `${Math.round(totalDistance)}m / ${raceDistKm * 1000 * 5}m`
                        : `${distKm.toFixed(1)}km / ${raceDistKm * 5}km`}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* Empty state for volume section */}
      {withWorkoutData.length === 0 && (
        <div className="bg-card rounded-2xl border border-border/40 p-6 text-center">
          <span className="material-symbols-outlined text-3xl text-muted-foreground mb-3 block">upload</span>
          <p className="font-headline font-semibold text-foreground mb-1">No workout data yet</p>
          <p className="text-sm text-muted-foreground">
            Upload Apple Fitness screenshots from training sessions to see pace trends, heart rate, and race readiness.
          </p>
        </div>
      )}

      {/* Race Goals */}
      <div className="mt-6 bg-card rounded-2xl border border-border/40 p-4">
        <p className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Race Goals</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              🏊 Swim {raceConfig.swimDistanceM >= 1000 ? `${raceConfig.swimDistanceM / 1000}km` : `${raceConfig.swimDistanceM}m`}
            </span>
            <span className="font-headline font-bold" style={{ color: 'var(--sport-swim)' }}>
              {raceConfig.swimGoalMinutes ? `≤ ${raceConfig.swimGoalMinutes} min` : '–'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">🚴 Bike {raceConfig.bikeDistanceKm}km</span>
            <span className="font-headline font-bold" style={{ color: 'var(--sport-bike)' }}>
              {raceConfig.bikeGoalMinutes ? `≤ ${raceConfig.bikeGoalMinutes} min` : '–'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">🏃 Run {raceConfig.runDistanceKm}km</span>
            <span className="font-headline font-bold" style={{ color: 'var(--sport-run)' }}>
              {raceConfig.runGoalMinutes ? `≤ ${raceConfig.runGoalMinutes} min` : '–'}
            </span>
          </div>
        </div>
      </div>

        </TabsContent>

        {/* ── History tab ── */}
        <TabsContent value="history">
          {historyItems.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/40 p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-muted-foreground mb-3 block">history</span>
              <p className="font-headline font-semibold text-foreground mb-1">No completed workouts yet</p>
              <p className="text-sm text-muted-foreground">Mark sessions as complete to build your training log.</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
              {historyItems.map((t: any, idx: number) => {
                const config = SPORT_CONFIG[t.sport as keyof typeof SPORT_CONFIG];
                const c = t.completion;
                const distM = c?.actual_distance_meters;
                const dur = c?.workout_duration_seconds;
                const pace = c?.avg_pace_seconds;
                const hr = c?.avg_heart_rate_bpm;
                const dateStr = (c?.workout_date || t.date) + 'T12:00:00Z';
                const dateFormatted = new Date(dateStr).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                });
                const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });

                function fmtDist(m: number) {
                  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
                }
                function fmtDur(s: number) {
                  const h = Math.floor(s / 3600);
                  const m = Math.floor((s % 3600) / 60);
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                }
                function fmtPace(s: number) {
                  const m = Math.floor(s / 60);
                  const sec = s % 60;
                  const unit = t.sport === 'swim' ? '/100m' : '/km';
                  return `${m}'${String(sec).padStart(2, '0')}"${unit}`;
                }

                return (
                  <a
                    key={t.id}
                    href={`/training/${t.id}`}
                    className={`flex gap-0 hover:bg-muted/40 transition-colors active:scale-[0.99] ${idx > 0 ? 'border-t border-border/10' : ''}`}
                  >
                    <div className={`w-1 flex-shrink-0 sport-bar-${t.sport}`} />
                    <div className="flex-1 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="material-symbols-outlined text-base flex-shrink-0"
                            style={{ color: `var(--sport-${t.sport})`, fontVariationSettings: "'FILL' 1" }}
                          >
                            {config.materialIcon}
                          </span>
                          <div className="min-w-0">
                            <p className="font-headline font-semibold text-sm truncate">{t.title}</p>
                            <p className="font-headline text-[10px] text-muted-foreground">{dayName}, {dateFormatted}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 text-right">
                          {distM && (
                            <div>
                              <p className="font-headline font-bold text-sm">{fmtDist(distM)}</p>
                            </div>
                          )}
                          {dur && (
                            <div>
                              <p className="font-headline font-bold text-sm text-muted-foreground">{fmtDur(dur)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      {(pace || hr) && (
                        <div className="flex gap-3 mt-1.5">
                          {pace && (
                            <span className="font-headline text-[10px] text-muted-foreground">
                              ⚡ {fmtPace(pace)}
                            </span>
                          )}
                          {hr && (
                            <span className="font-headline text-[10px] text-red-400">
                              ♥ {hr} bpm
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
