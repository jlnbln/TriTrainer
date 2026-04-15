'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { markComplete, markIncomplete, saveRaceResults, type RaceSegmentResults } from './actions';

export interface RaceConfig {
  swimDistanceM: number;
  bikeDistanceKm: number;
  runDistanceKm: number;
  swimGoalMinutes: number | null;
  bikeGoalMinutes: number | null;
  runGoalMinutes: number | null;
}

interface RaceDayViewProps {
  training: any;
  userId: string;
  raceConfig: RaceConfig;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toSec(min: string | number, sec: string | number): number {
  return (Number(min) || 0) * 60 + (Number(sec) || 0);
}

function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtPaceMmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
}

function splitToMinSec(totalSec: number | null): [string, string] {
  if (!totalSec) return ['', ''];
  return [String(Math.floor(totalSec / 60)), String(totalSec % 60)];
}

// ── Small sub-components ─────────────────────────────────────────────────────

function SegmentBadge({ icon, color, label, distance }: { icon: string; color: string; label: string; distance: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <span className="material-symbols-outlined text-base" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <span className="font-headline font-bold text-xs" style={{ color }}>{distance}</span>
      </div>
      <span className="font-headline text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

function Arrow() {
  return <span className="material-symbols-outlined text-muted-foreground/40 text-lg flex-shrink-0 self-start mt-2">chevron_right</span>;
}

function TransitionDot({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 self-start mt-1">
      <div className="w-8 h-8 rounded-full bg-muted border border-border/40 flex items-center justify-center">
        <span className="font-headline font-black text-[9px] text-muted-foreground">{label}</span>
      </div>
      <span className="font-headline text-[9px] uppercase tracking-widest text-muted-foreground/60">Trans.</span>
    </div>
  );
}

function TimeInput({
  label, icon, color, minutes, seconds,
  onMinutes, onSeconds,
}: {
  label: string; icon: string; color: string;
  minutes: string; seconds: string;
  onMinutes: (v: string) => void; onSeconds: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/10 last:border-0">
      <div className="flex items-center gap-2 w-20 flex-shrink-0">
        <span className="material-symbols-outlined text-base" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        <span className="font-headline font-semibold text-sm text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        <input
          type="number" min="0" max="99"
          value={minutes}
          onChange={(e) => onMinutes(e.target.value)}
          placeholder="0"
          className="w-14 h-10 rounded-xl bg-muted border-0 text-center font-headline font-bold text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="text-muted-foreground font-bold text-sm">:</span>
        <input
          type="number" min="0" max="59"
          value={seconds}
          onChange={(e) => onSeconds(e.target.value)}
          placeholder="00"
          className="w-14 h-10 rounded-xl bg-muted border-0 text-center font-headline font-bold text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="text-xs text-muted-foreground">min : sec</span>
      </div>
    </div>
  );
}

function ResultRow({
  icon, color, label, actualSec, goalMinutes, isTransition = false,
}: {
  icon?: string; color?: string; label: string;
  actualSec: number | null; goalMinutes?: number | null; isTransition?: boolean;
}) {
  if (!actualSec) return null;
  const goalSec = goalMinutes ? goalMinutes * 60 : null;
  const delta = goalSec !== null ? actualSec - goalSec : null;
  const faster = delta !== null && delta < 0;
  const slower = delta !== null && delta > 0;

  return (
    <div className={cn('flex items-center gap-3 py-2', !isTransition && 'border-b border-border/10 last:border-0')}>
      <div className="flex items-center gap-2 w-20 flex-shrink-0">
        {icon && color && (
          <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        )}
        {isTransition && <div className="w-4" />}
        <span className={cn('font-headline font-semibold text-sm', isTransition && 'text-muted-foreground')}>{label}</span>
      </div>
      <span className="font-headline font-bold text-base flex-1">{fmtTime(actualSec)}</span>
      {goalSec !== null && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-headline font-bold px-2 py-0.5 rounded-lg',
          faster ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'
        )}>
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
            {faster ? 'arrow_upward' : 'arrow_downward'}
          </span>
          {fmtTime(Math.abs(delta!))}
        </div>
      )}
    </div>
  );
}

// ── Checklist ────────────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: 'packet',     label: 'Race packet & bib number',       icon: 'confirmation_number' },
  { id: 'gear',       label: 'Wetsuit / goggles packed',       icon: 'pool'                },
  { id: 'helmet',     label: 'Helmet & bike checked',          icon: 'directions_bike'     },
  { id: 'nutrition',  label: 'Nutrition & hydration packed',   icon: 'water_drop'          },
  { id: 'transition', label: 'Transition bag ready',           icon: 'luggage'             },
  { id: 'sunscreen',  label: 'Sunscreen applied',              icon: 'wb_sunny'            },
  { id: 'warmup',     label: 'Warm-up planned',                icon: 'sports'              },
];

// ── Main component ────────────────────────────────────────────────────────────

export function RaceDayView({ training, raceConfig }: RaceDayViewProps) {
  const router = useRouter();
  const completion = training.completions?.[0] ?? null;
  const existingResults: (RaceSegmentResults & { total_seconds: number | null; type: string }) | null =
    completion?.workout_data?.type === 'race_manual' ? completion.workout_data : null;

  const [isCompleted, setIsCompleted] = useState(!!completion);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<Set<string>>(new Set());
  const [savedResults, setSavedResults] = useState(existingResults);
  const [showResultsForm, setShowResultsForm] = useState(!!completion && !existingResults);

  // Results form inputs (pre-populate from saved results if they exist)
  const [swimMin, setSwimMin] = useState(() => splitToMinSec(existingResults?.swim_seconds ?? null)[0]);
  const [swimSec, setSwimSec] = useState(() => splitToMinSec(existingResults?.swim_seconds ?? null)[1]);
  const [t1Min,   setT1Min]   = useState(() => splitToMinSec(existingResults?.t1_seconds   ?? null)[0]);
  const [t1Sec,   setT1Sec]   = useState(() => splitToMinSec(existingResults?.t1_seconds   ?? null)[1]);
  const [bikeMin, setBikeMin] = useState(() => splitToMinSec(existingResults?.bike_seconds ?? null)[0]);
  const [bikeSec, setBikeSec] = useState(() => splitToMinSec(existingResults?.bike_seconds ?? null)[1]);
  const [t2Min,   setT2Min]   = useState(() => splitToMinSec(existingResults?.t2_seconds   ?? null)[0]);
  const [t2Sec,   setT2Sec]   = useState(() => splitToMinSec(existingResults?.t2_seconds   ?? null)[1]);
  const [runMin,  setRunMin]  = useState(() => splitToMinSec(existingResults?.run_seconds  ?? null)[0]);
  const [runSec,  setRunSec]  = useState(() => splitToMinSec(existingResults?.run_seconds  ?? null)[1]);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to results form when it appears
  useEffect(() => {
    if (showResultsForm && resultsRef.current) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [showResultsForm]);

  const formTotalSec =
    toSec(swimMin, swimSec) + toSec(t1Min, t1Sec) +
    toSec(bikeMin, bikeSec) + toSec(t2Min, t2Sec) +
    toSec(runMin, runSec);

  // Pacing targets
  const swimPaceSec  = raceConfig.swimGoalMinutes  ? (raceConfig.swimGoalMinutes * 60)  / (raceConfig.swimDistanceM / 100) : null;
  const bikeSpeedKmh = raceConfig.bikeGoalMinutes  ? raceConfig.bikeDistanceKm          / (raceConfig.bikeGoalMinutes / 60) : null;
  const runPaceSec   = raceConfig.runGoalMinutes   ? (raceConfig.runGoalMinutes * 60)   / raceConfig.runDistanceKm          : null;
  const totalGoalSec =
    (raceConfig.swimGoalMinutes ?? 0) * 60 +
    (raceConfig.bikeGoalMinutes ?? 0) * 60 +
    (raceConfig.runGoalMinutes  ?? 0) * 60;

  const hasGoals = raceConfig.swimGoalMinutes || raceConfig.bikeGoalMinutes || raceConfig.runGoalMinutes;

  const swimLabel = raceConfig.swimDistanceM >= 1000
    ? `${raceConfig.swimDistanceM / 1000}km`
    : `${raceConfig.swimDistanceM}m`;

  const dateFormatted = new Date(training.date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // ── Event handlers ────────────────────────────────────────────────────────

  async function handleMarkComplete() {
    setSaving(true);
    try {
      await markComplete(training.id, null, null);
      setIsCompleted(true);
      setShowResultsForm(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveResults() {
    setSaving(true);
    try {
      const segments: RaceSegmentResults = {
        swim_seconds: toSec(swimMin, swimSec) || null,
        t1_seconds:   toSec(t1Min,  t1Sec)   || null,
        bike_seconds: toSec(bikeMin, bikeSec) || null,
        t2_seconds:   toSec(t2Min,  t2Sec)   || null,
        run_seconds:  toSec(runMin,  runSec)  || null,
      };
      await saveRaceResults(training.id, segments);
      setSavedResults({ type: 'race_manual', ...segments, total_seconds: formTotalSec || null });
      setShowResultsForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUncomplete() {
    setSaving(true);
    try {
      await markIncomplete(training.id);
      setIsCompleted(false);
      setShowResultsForm(false);
      setSavedResults(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto pb-44">

      {/* Top bar */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        {isCompleted && (
          <button
            onClick={handleUncomplete}
            disabled={saving}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors font-headline font-medium"
          >
            Undo completion
          </button>
        )}
      </div>

      {/* ── Hero card ── */}
      <section className="px-5 mb-6">
        <div
          className="rounded-3xl p-6 relative overflow-hidden"
          style={{
            background: 'color-mix(in srgb, var(--sport-race) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--sport-race) 25%, transparent)',
          }}
        >
          {/* Background trophy watermark */}
          <div className="absolute -right-6 -top-6 opacity-[0.07] pointer-events-none select-none">
            <span className="material-symbols-outlined text-[140px]" style={{ color: 'var(--sport-race)', fontVariationSettings: "'FILL' 1" }}>
              emoji_events
            </span>
          </div>

          <div className="relative z-10">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4 font-headline text-[9px] font-black uppercase tracking-[0.2em]"
              style={{ background: 'var(--sport-race)', color: '#0c1322' }}
            >
              🏅 Race Day
            </div>

            <h1
              className="font-headline font-extrabold text-4xl tracking-tight leading-tight mb-1"
              style={{ color: 'var(--sport-race)' }}
            >
              {training.title}
            </h1>
            <p className="text-muted-foreground text-sm mb-5">{dateFormatted}</p>

            {/* Race format strip */}
            <div className="flex items-start gap-1 flex-wrap">
              <SegmentBadge icon="pool"           color="var(--sport-swim)" label="Swim" distance={swimLabel} />
              <Arrow />
              <TransitionDot label="T1" />
              <Arrow />
              <SegmentBadge icon="directions_bike" color="var(--sport-bike)" label="Bike" distance={`${raceConfig.bikeDistanceKm}km`} />
              <Arrow />
              <TransitionDot label="T2" />
              <Arrow />
              <SegmentBadge icon="directions_run"  color="var(--sport-run)"  label="Run"  distance={`${raceConfig.runDistanceKm}km`} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Celebration card (saved results) ── */}
      {savedResults && (
        <section className="px-5 mb-6">
          <div className="rounded-2xl overflow-hidden border border-border/40">
            {/* Celebration header */}
            <div
              className="p-6 text-center"
              style={{ background: 'color-mix(in srgb, var(--sport-race) 10%, transparent)' }}
            >
              <div className="text-5xl mb-2 animate-[bounce_1s_ease-in-out_3]">🏅</div>
              <p className="font-headline font-black text-2xl" style={{ color: 'var(--sport-race)' }}>
                You did it!
              </p>
              <p className="text-sm text-muted-foreground mt-1">Sprint Triathlon Complete</p>
              {savedResults.total_seconds && (
                <div className="mt-4 inline-block px-5 py-2 rounded-2xl" style={{ background: 'color-mix(in srgb, var(--sport-race) 20%, transparent)' }}>
                  <p className="font-headline text-[10px] uppercase tracking-widest text-muted-foreground">Total Time</p>
                  <p className="font-headline font-black text-3xl mt-0.5" style={{ color: 'var(--sport-race)' }}>
                    {fmtTime(savedResults.total_seconds)}
                  </p>
                </div>
              )}
            </div>

            {/* Segment breakdown */}
            <div className="p-5 bg-card space-y-0.5">
              <ResultRow icon="pool"            color="var(--sport-swim)" label="Swim" actualSec={savedResults.swim_seconds} goalMinutes={raceConfig.swimGoalMinutes} />
              <ResultRow label="T1" actualSec={savedResults.t1_seconds} isTransition />
              <ResultRow icon="directions_bike" color="var(--sport-bike)" label="Bike" actualSec={savedResults.bike_seconds} goalMinutes={raceConfig.bikeGoalMinutes} />
              <ResultRow label="T2" actualSec={savedResults.t2_seconds} isTransition />
              <ResultRow icon="directions_run"  color="var(--sport-run)"  label="Run"  actualSec={savedResults.run_seconds}  goalMinutes={raceConfig.runGoalMinutes}  />

              {hasGoals && savedResults.total_seconds && totalGoalSec > 0 && (
                <div className="pt-3 mt-2 border-t border-border/20 flex justify-between items-center">
                  <span className="font-headline text-xs text-muted-foreground">Goal</span>
                  <span className="font-headline font-bold text-sm">{fmtTime(totalGoalSec)}</span>
                  <div className={cn(
                    'flex items-center gap-1 text-xs font-headline font-bold px-2 py-1 rounded-lg',
                    savedResults.total_seconds <= totalGoalSec
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-amber-400 bg-amber-400/10'
                  )}>
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {savedResults.total_seconds <= totalGoalSec ? 'emoji_events' : 'timer'}
                    </span>
                    {savedResults.total_seconds <= totalGoalSec ? 'Goal smashed!' : `${fmtTime(savedResults.total_seconds - totalGoalSec)} over`}
                  </div>
                </div>
              )}
            </div>

            {/* Edit results button */}
            <div className="px-5 pb-4 bg-card">
              <button
                onClick={() => setShowResultsForm(true)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors font-headline font-medium flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit results
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Results entry form ── */}
      {isCompleted && showResultsForm && (
        <section className="px-5 mb-6" ref={resultsRef}>
          <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-border/10 flex items-center justify-between">
              <h3 className="font-headline font-bold text-sm uppercase tracking-widest" style={{ color: 'var(--sport-race)' }}>
                Enter Your Results
              </h3>
              {savedResults && (
                <button onClick={() => setShowResultsForm(false)} className="text-muted-foreground">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

            <div className="px-5 py-2">
              <TimeInput label="Swim" icon="pool"            color="var(--sport-swim)" minutes={swimMin} seconds={swimSec} onMinutes={setSwimMin} onSeconds={setSwimSec} />
              <TimeInput label="T1"   icon="swap_horiz"      color="var(--color-muted-foreground, #8c909f)" minutes={t1Min}   seconds={t1Sec}   onMinutes={setT1Min}   onSeconds={setT1Sec} />
              <TimeInput label="Bike" icon="directions_bike" color="var(--sport-bike)" minutes={bikeMin} seconds={bikeSec} onMinutes={setBikeMin} onSeconds={setBikeSec} />
              <TimeInput label="T2"   icon="swap_horiz"      color="var(--color-muted-foreground, #8c909f)" minutes={t2Min}   seconds={t2Sec}   onMinutes={setT2Min}   onSeconds={setT2Sec} />
              <TimeInput label="Run"  icon="directions_run"  color="var(--sport-run)"  minutes={runMin}  seconds={runSec}  onMinutes={setRunMin}  onSeconds={setRunSec} />
            </div>

            {/* Running total */}
            {formTotalSec > 0 && (
              <div className="mx-5 mb-4 px-4 py-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--sport-race) 10%, transparent)' }}>
                <div className="flex justify-between items-center">
                  <span className="font-headline text-[10px] uppercase tracking-widest text-muted-foreground">Total</span>
                  <span className="font-headline font-black text-xl" style={{ color: 'var(--sport-race)' }}>{fmtTime(formTotalSec)}</span>
                </div>
                {hasGoals && totalGoalSec > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="font-headline text-[10px] text-muted-foreground">Goal: {fmtTime(totalGoalSec)}</span>
                    <span className={cn(
                      'font-headline text-xs font-bold',
                      formTotalSec <= totalGoalSec ? 'text-emerald-400' : 'text-amber-400'
                    )}>
                      {formTotalSec <= totalGoalSec
                        ? `${fmtTime(totalGoalSec - formTotalSec)} ahead`
                        : `${fmtTime(formTotalSec - totalGoalSec)} behind`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="px-5 pb-5">
              <button
                onClick={handleSaveResults}
                disabled={saving || formTotalSec === 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[color:var(--sport-race)] to-amber-400 text-black font-headline font-bold text-sm uppercase tracking-widest disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving ? 'Saving...' : 'Save Results'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Pacing targets (pre-race, or always) ── */}
      {hasGoals && !savedResults && (
        <section className="px-5 mb-6">
          <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1 mb-3">
            Target Pacing
          </h3>
          <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: 'var(--sport-race)' }} />
            {[
              swimPaceSec  && { icon: 'pool',            color: 'var(--sport-swim)', sport: 'Swim', dist: swimLabel,                        goal: raceConfig.swimGoalMinutes,  pace: `${fmtPaceMmss(swimPaceSec)}/100m` },
              bikeSpeedKmh && { icon: 'directions_bike', color: 'var(--sport-bike)', sport: 'Bike', dist: `${raceConfig.bikeDistanceKm}km`, goal: raceConfig.bikeGoalMinutes,  pace: `${bikeSpeedKmh.toFixed(1)} km/h` },
              runPaceSec   && { icon: 'directions_run',  color: 'var(--sport-run)',  sport: 'Run',  dist: `${raceConfig.runDistanceKm}km`,  goal: raceConfig.runGoalMinutes,   pace: `${fmtPaceMmss(runPaceSec)}/km` },
            ].filter(Boolean).map((row: any, i, arr) => (
              <div key={row.sport} className={cn('flex items-center gap-3 px-5 py-3.5', i < arr.length - 1 && 'border-b border-border/10')}>
                <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: row.color, fontVariationSettings: "'FILL' 1" }}>{row.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-headline font-bold text-sm text-foreground">{row.sport}</span>
                    <span className="font-headline text-xs text-muted-foreground">{row.dist}</span>
                  </div>
                  <span className="font-headline font-bold text-base" style={{ color: row.color }}>{row.pace}</span>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-headline text-[10px] uppercase tracking-wider text-muted-foreground">Goal</p>
                  <p className="font-headline font-bold text-sm text-foreground">≤ {row.goal} min</p>
                </div>
              </div>
            ))}
            {totalGoalSec > 0 && (
              <div className="px-5 py-3 bg-muted/30 flex justify-between items-center border-t border-border/10">
                <span className="font-headline text-[10px] uppercase tracking-widest text-muted-foreground">Total target</span>
                <span className="font-headline font-bold text-sm" style={{ color: 'var(--sport-race)' }}>≤ {fmtTime(totalGoalSec)}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Race morning checklist (pre-race only) ── */}
      {!isCompleted && (
        <section className="px-5 mb-6">
          <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1 mb-3">
            Race Morning Checklist
          </h3>
          <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
            {CHECKLIST_ITEMS.map((item, i) => {
              const checked = checklist.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setChecklist(prev => {
                    const next = new Set(prev);
                    checked ? next.delete(item.id) : next.add(item.id);
                    return next;
                  })}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/50',
                    i > 0 && 'border-t border-border/10'
                  )}
                >
                  <span
                    className="material-symbols-outlined text-xl flex-shrink-0 transition-colors"
                    style={{
                      color: checked ? 'var(--sport-run)' : undefined,
                      fontVariationSettings: checked ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    {checked ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className="material-symbols-outlined text-base flex-shrink-0 text-muted-foreground">{item.icon}</span>
                  <span className={cn('font-body text-sm flex-1', checked && 'line-through text-muted-foreground')}>
                    {item.label}
                  </span>
                </button>
              );
            })}
            {checklist.size === CHECKLIST_ITEMS.length && (
              <div className="px-5 py-3 bg-[color:var(--sport-run)]/10 border-t border-border/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="font-headline font-bold text-sm text-emerald-400">All set — good luck out there!</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Race briefing ── */}
      <div className="mx-5 mb-6 bg-card rounded-2xl p-5 border border-border/40 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: 'var(--sport-race)' }} />
        <h3
          className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] mb-3"
          style={{ color: 'var(--sport-race)' }}
        >
          Race Briefing
        </h3>
        <p className="text-foreground leading-relaxed text-sm whitespace-pre-line">{training.description}</p>
      </div>

      {/* ── Fixed bottom CTA ── */}
      <div
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-5 pt-12 bg-gradient-to-t from-background via-background/95 to-transparent"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      >
        {!isCompleted ? (
          <button
            onClick={handleMarkComplete}
            disabled={saving}
            className="w-full py-4 rounded-2xl border-2 font-headline font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
            style={{ borderColor: 'var(--sport-race)', color: 'var(--sport-race)' }}
          >
            <span className="material-symbols-outlined">emoji_events</span>
            I Finished the Race!
          </button>
        ) : !savedResults ? (
          <button
            onClick={() => setShowResultsForm(true)}
            className="w-full py-4 rounded-2xl font-headline font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all text-black shadow-lg"
            style={{ background: 'linear-gradient(135deg, var(--sport-race), #f59e0b)' }}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            Enter Race Results
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3">
            <span className="material-symbols-outlined text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="font-headline font-bold text-sm text-emerald-400">Race Complete</span>
          </div>
        )}
      </div>
    </div>
  );
}
