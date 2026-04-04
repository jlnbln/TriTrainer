'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SPORT_CONFIG } from '@/lib/constants';
import { Textarea } from '@/components/ui/textarea';
import { createClient } from '@/lib/supabase/client';
import type { Sport } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TrainingDetailProps {
  training: any;
  drills: any[];
  userId: string;
}

export function TrainingDetail({ training, drills, userId }: TrainingDetailProps) {
  const router = useRouter();
  const supabase = createClient();
  const sport = training.sport as Sport;
  const config = SPORT_CONFIG[sport];
  const week = training.weeks;
  const phase = week?.phases;

  const completion = training.completions?.[0] || null;
  const [isCompleted, setIsCompleted] = useState(!!completion);
  const [notes, setNotes] = useState(completion?.notes || '');
  const [saving, setSaving] = useState(false);
  const [expandedDrills, setExpandedDrills] = useState<Set<string>>(new Set());

  const dateFormatted = new Date(training.date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  async function toggleCompletion() {
    setSaving(true);
    try {
      if (isCompleted) {
        await supabase.from('completions').delete().eq('training_id', training.id);
        setIsCompleted(false);
      } else {
        await supabase.from('completions').upsert({
          training_id: training.id,
          user_id: userId,
          notes: notes || null,
          actual_distance_meters: training.distance_meters,
        }, { onConflict: 'training_id' });
        setIsCompleted(true);
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!isCompleted) return;
    await supabase.from('completions').upsert({
      training_id: training.id,
      user_id: userId,
      notes: notes || null,
    }, { onConflict: 'training_id' });
  }

  function toggleDrill(slug: string) {
    setExpandedDrills(prev => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
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
          {/* Sport badge */}
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

            {/* Large icon */}
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
            Modified by AI Assistant
          </p>
          {training.original_description && (
            <details className="mt-1">
              <summary className="text-xs text-muted-foreground cursor-pointer">View original</summary>
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
          Workout Details
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
            Drills Explained
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

      {/* Fixed bottom CTA */}
      {sport !== 'rest' && (
        <div className="fixed bottom-20 left-0 w-full p-5 bg-gradient-to-t from-background via-background/95 to-transparent pt-12 max-w-lg mx-auto left-1/2 -translate-x-1/2">
          <button
            onClick={toggleCompletion}
            disabled={saving}
            className={cn(
              'w-full py-4 rounded-2xl font-headline font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg',
              isCompleted
                ? 'bg-gradient-to-r from-[color:var(--sport-run)] to-emerald-500 text-black shadow-[color:var(--sport-run)]/20'
                : 'border-2 border-border text-foreground'
            )}
          >
            <span className="material-symbols-outlined" style={isCompleted ? { fontVariationSettings: "'FILL' 1" } : {}}>
              check_circle
            </span>
            {isCompleted ? 'Completed!' : 'Mark as Complete'}
          </button>
          <div className="h-safe-area-inset-bottom" />
        </div>
      )}
    </div>
  );
}
