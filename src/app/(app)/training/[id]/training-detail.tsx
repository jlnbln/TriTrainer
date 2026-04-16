'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { SPORT_CONFIG } from '@/lib/constants';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Sport } from '@/lib/types';
import { cn } from '@/lib/utils';
import { markComplete, markIncomplete, updateNotes, saveWorkoutData, type WorkoutData } from './actions';

interface UnlinkedStravaActivity {
  id: number;
  sport_type: string;
  activity_date: string;
  distance_meters: number | null;
  duration_seconds: number | null;
  activity_name: string | null;
}

interface TrainingDetailProps {
  training: any;
  drills: any[];
  userId: string;
  unlinkedStravaActivities: UnlinkedStravaActivity[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(seconds: number, sport: string): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const unit = sport === 'swim' ? '/100m' : '/km';
  return `${m}'${String(s).padStart(2, '0')}"${unit}`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2).replace(/\.?0+$/, '')} km`;
  return `${meters} m`;
}

export function TrainingDetail({ training, drills, unlinkedStravaActivities }: TrainingDetailProps) {
  const router = useRouter();
  const sport = training.sport as Sport;
  const config = SPORT_CONFIG[sport];
  const week = training.weeks;
  const phase = week?.phases;
  const t = useTranslations('training');
  const locale = useLocale();

  const completion = training.completions?.[0] || null;
  const [isCompleted, setIsCompleted] = useState(!!completion);
  const [notes, setNotes] = useState(completion?.notes || '');
  const [saving, setSaving] = useState(false);
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(new Set());

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [workoutData, setWorkoutData] = useState<WorkoutData | null>(
    completion?.workout_data || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedStravaId, setSelectedStravaId] = useState<string>('');
  const [stravaLinking, setStravaLinking] = useState(false);

  const dateFormatted = new Date(training.date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  async function toggleCompletion() {
    setSaving(true);
    try {
      if (isCompleted) {
        await markIncomplete(training.id);
        setIsCompleted(false);
        setWorkoutData(null);
      } else {
        await markComplete(training.id, training.distance_meters, notes);
        setIsCompleted(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!isCompleted) return;
    await updateNotes(training.id, notes);
  }

  function toggleDrill(slug: string) {
    setExpandedDrills(prev => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  async function linkStravaActivity() {
    if (!selectedStravaId) return;
    setStravaLinking(true);
    try {
      const response = await fetch('/api/strava/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaActivityId: Number(selectedStravaId), trainingId: training.id }),
      });

      if (!response.ok) {
        const err = await response.json();
        setUploadError(err.error || 'Failed to link Strava activity');
        return;
      }

      const { workoutData: wd } = await response.json();
      setWorkoutData(wd);
      setIsCompleted(true);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setStravaLinking(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/analyze-workout', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const { workout } = await response.json();
      await saveWorkoutData(training.id, workout);
      setWorkoutData(workout);
      setIsCompleted(true);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-48">
      {/* Top bar */}
      <div className="px-5 pt-4 pb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
        >
          <span className="material-symbols-outlined text-primary">arrow_back</span>
        </button>
        <span className="font-headline font-bold text-xs tracking-widest text-muted-foreground uppercase">
          Week {week?.week_number} · {phase?.name?.en}
        </span>
      </div>

      {/* Hero */}
      <section className="px-5 mb-8">
        <div className="flex flex-col gap-3">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full w-fit text-white text-xs font-headline font-bold uppercase tracking-widest"
            style={{ background: `var(--sport-${sport})` }}
          >
            <span>{config.emoji}</span>
            <span>{config.label.en}</span>
          </div>

          <div className="flex items-end justify-between">
            <div className="flex-1">
              <h1
                className="font-headline font-extrabold text-4xl tracking-tight leading-tight"
                style={{ color: `var(--sport-${sport})` }}
              >
                {training.title}
              </h1>
              <p className="text-muted-foreground font-medium mt-1 text-sm">
                {training.distance_meters && (
                  <span>
                    {training.distance_meters >= 1000
                      ? `${(training.distance_meters / 1000).toFixed(1)}km`
                      : `${training.distance_meters}m`}
                  </span>
                )}
                {training.distance_meters && training.duration_minutes && <span> · </span>}
                {training.duration_minutes && <span>{training.duration_minutes} mins</span>}
              </p>
            </div>

            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
              style={{ background: `color-mix(in srgb, var(--sport-${sport}) 12%, transparent)` }}
            >
              <span
                className="material-symbols-outlined text-4xl"
                style={{ color: `var(--sport-${sport})` }}
              >
                {config.materialIcon}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Modified warning */}
      {training.is_modified && (
        <div className="mx-5 mb-5 rounded-xl bg-[color:var(--sport-race)]/10 border border-[color:var(--sport-race)]/20 p-4">
          <p className="font-headline font-bold text-sm" style={{ color: 'var(--sport-race)' }}>
            {t('modifiedByAi')}
          </p>
          {training.original_description && (
            <details className="mt-1">
              <summary className="text-xs text-muted-foreground cursor-pointer">{t('viewOriginal')}</summary>
              <p className="mt-1 text-xs text-muted-foreground">{training.original_description}</p>
            </details>
          )}
        </div>
      )}

      {/* Workout details */}
      <div className="mx-5 mb-6 bg-card rounded-2xl p-5 border border-border/40 relative overflow-hidden">
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: `var(--sport-${sport})` }}
        />
        <h3
          className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] mb-3"
          style={{ color: `var(--sport-${sport})` }}
        >
          {t('details')}
        </h3>
        <p className="text-foreground leading-relaxed text-sm font-medium whitespace-pre-line">
          {training.description}
        </p>
      </div>

      {/* Drills */}
      {drills.length > 0 && (
        <div className="mx-5 mb-6">
          <h3 className="font-headline font-bold text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">lightbulb</span>
            {t('drills')}
          </h3>
          <div className="space-y-3">
            {drills.map((drill) => (
              <div key={drill.slug} className="bg-card rounded-2xl border border-border/40 overflow-hidden">
                <button
                  onClick={() => toggleDrill(drill.slug)}
                  className="w-full p-4 flex items-start gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-lg">touch_app</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-headline font-semibold text-foreground">{drill.name}</p>
                    {!expandedDrills.has(drill.slug) && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{drill.description}</p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground mt-0.5 flex-shrink-0">
                    {expandedDrills.has(drill.slug) ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {expandedDrills.has(drill.slug) && (
                  <div className="px-4 pb-4 pl-[calc(1rem+2.5rem+0.75rem)]">
                    <p className="text-sm text-muted-foreground leading-relaxed">{drill.description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actual Workout Data */}
      {workoutData && (
        <div className="mx-5 mb-6 bg-card rounded-2xl border border-border/40 relative overflow-hidden">
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ background: `var(--sport-${sport})` }}
          />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="font-headline font-bold text-[10px] uppercase tracking-[0.15em]"
                style={{ color: `var(--sport-${sport})` }}
              >
                Actual Workout
              </h3>
              <div className="flex items-center gap-1.5">
                {workoutData.workout_date && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(workoutData.workout_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Replace screenshot"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                </button>
                <button
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await markIncomplete(training.id);
                      setWorkoutData(null);
                      setIsCompleted(false);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete workout data"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>

            {workoutData.workout_name && (
              <p className="text-sm font-medium text-foreground mb-3">{workoutData.workout_name}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              {workoutData.duration_seconds && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Duration</p>
                  <p className="font-headline font-bold text-lg text-foreground">{formatDuration(workoutData.duration_seconds)}</p>
                </div>
              )}
              {workoutData.distance_meters && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Distance</p>
                  <p className="font-headline font-bold text-lg" style={{ color: `var(--sport-${sport})` }}>
                    {formatDistance(workoutData.distance_meters)}
                  </p>
                </div>
              )}
              {workoutData.avg_pace_seconds && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Avg Pace</p>
                  <p className="font-headline font-bold text-lg text-foreground">
                    {formatPace(workoutData.avg_pace_seconds, workoutData.sport_type || sport)}
                  </p>
                </div>
              )}
              {workoutData.avg_heart_rate_bpm && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Avg HR</p>
                  <p className="font-headline font-bold text-lg text-red-400">{workoutData.avg_heart_rate_bpm} bpm</p>
                </div>
              )}
              {workoutData.calories_active && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Active Cal</p>
                  <p className="font-headline font-bold text-lg text-foreground">{workoutData.calories_active} kcal</p>
                </div>
              )}
              {workoutData.elevation_meters && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Elevation</p>
                  <p className="font-headline font-bold text-lg text-foreground">{workoutData.elevation_meters} m</p>
                </div>
              )}
              {workoutData.avg_cadence_spm && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Cadence</p>
                  <p className="font-headline font-bold text-lg text-foreground">{workoutData.avg_cadence_spm} spm</p>
                </div>
              )}
              {workoutData.avg_power_watts && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Avg Power</p>
                  <p className="font-headline font-bold text-lg text-foreground">{workoutData.avg_power_watts} W</p>
                </div>
              )}
              {workoutData.laps && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Laps</p>
                  <p className="font-headline font-bold text-lg text-foreground">
                    {workoutData.laps} × {workoutData.pool_length_meters ?? '?'}m
                  </p>
                </div>
              )}
              {workoutData.effort_level && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Effort</p>
                  <p className="font-headline font-bold text-lg text-foreground">{workoutData.effort_level}/10</p>
                </div>
              )}
            </div>

            {/* Sub-activities for brick workouts */}
            {workoutData.sub_activities && workoutData.sub_activities.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-headline">Segments</p>
                {(workoutData.sub_activities as any[]).map((sub, i) => (
                  <div key={i} className="bg-muted/40 rounded-xl p-3">
                    <p className="text-xs font-headline font-semibold text-foreground mb-1">{sub.workout_name}</p>
                    <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
                      {sub.duration_seconds && <span>{formatDuration(sub.duration_seconds)}</span>}
                      {sub.distance_meters && <span>{formatDistance(sub.distance_meters)}</span>}
                      {sub.avg_pace_seconds && <span>{formatPace(sub.avg_pace_seconds, sub.sport_type)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Strava Activity (when not yet completed and unlinked activities exist) */}
      {!isCompleted && unlinkedStravaActivities.length > 0 && (
        <div className="mx-5 mb-6 bg-card rounded-2xl border border-dashed border-border/60 overflow-hidden relative">
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ background: `var(--sport-${sport})` }}
          />
          <div className="p-5 pl-6 space-y-3">
            <h3
              className="font-headline font-bold text-[10px] uppercase tracking-[0.15em]"
              style={{ color: `var(--sport-${sport})` }}
            >
              Link Strava Activity
            </h3>
            <Select value={selectedStravaId} onValueChange={setSelectedStravaId}>
              <SelectTrigger className="bg-muted border-0 font-headline text-sm">
                <SelectValue placeholder="Select a Strava activity…" />
              </SelectTrigger>
              <SelectContent>
                {unlinkedStravaActivities.map((a) => {
                  const date = new Date(a.activity_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const dist = a.distance_meters ? (a.distance_meters >= 1000 ? `${(a.distance_meters / 1000).toFixed(1)} km` : `${Math.round(a.distance_meters)} m`) : null;
                  const dur = a.duration_seconds ? `${Math.floor(a.duration_seconds / 60)}:${String(a.duration_seconds % 60).padStart(2, '0')}` : null;
                  const label = [a.activity_name || a.sport_type, date, dist, dur].filter(Boolean).join(' · ');
                  return (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <button
              onClick={linkStravaActivity}
              disabled={!selectedStravaId || stravaLinking}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-secondary to-emerald-500 text-black font-headline font-bold text-xs uppercase tracking-wider disabled:opacity-40 transition-all"
            >
              {stravaLinking ? 'Linking…' : 'Link Activity'}
            </button>
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mx-5 mb-4 rounded-xl bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{uploadError}</p>
        </div>
      )}

      {/* Notes (when completed) */}
      {sport !== 'rest' && isCompleted && (
        <div className="mx-5 mb-4">
          <Textarea
            placeholder="Add notes about this session (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={2}
            className="text-sm bg-card border-border/40"
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Fixed bottom CTA */}
      {sport !== 'rest' && (
        <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-lg px-5 pb-5 pt-12 bg-gradient-to-t from-background via-background/95 to-transparent" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex gap-3">
            {/* Upload workout button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                'flex-shrink-0 h-14 w-14 rounded-2xl border-2 border-border flex items-center justify-center transition-all active:scale-[0.98]',
                uploading && 'opacity-50'
              )}
              title="Upload Apple Fitness screenshot"
            >
              {uploading ? (
                <span className="material-symbols-outlined text-muted-foreground text-xl animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-muted-foreground text-xl">upload</span>
              )}
            </button>

            {/* Complete button */}
            <button
              onClick={toggleCompletion}
              disabled={saving || uploading}
              className={cn(
                'flex-1 py-4 rounded-2xl font-headline font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg',
                isCompleted
                  ? 'bg-gradient-to-r from-[color:var(--sport-run)] to-emerald-500 text-black shadow-[color:var(--sport-run)]/20'
                  : 'border-2 border-border text-foreground'
              )}
            >
              <span className="material-symbols-outlined" style={isCompleted ? { fontVariationSettings: "'FILL' 1" } : {}}>
                check_circle
              </span>
              {isCompleted ? t('completed') : t('complete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
