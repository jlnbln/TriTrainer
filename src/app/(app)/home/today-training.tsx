'use client';

import { TrainingCard } from '@/components/training-card';
import { SPORT_CONFIG } from '@/lib/constants';
import type { Sport } from '@/lib/types';
import Link from 'next/link';

interface TodayTrainingProps {
  training: any;
  week: any;
  dateStr: string;
}

const REST_MESSAGES = [
  'Rest is where the magic happens. Your body is adapting and getting stronger.',
  "Recovery day! Let your muscles rebuild. You've earned this.",
  "Today's workout: absolutely nothing. And that's perfect.",
  "Rest days aren't lazy days — they're growth days.",
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TodayTraining({ training, week, dateStr }: TodayTrainingProps) {
  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];

  const phase = week?.phases;
  const weekLabel = week ? `Week ${week.week_number}` : '';
  const phaseLabel = phase?.name?.en || '';

  if (!training) {
    return (
      <section className="space-y-3">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-headline font-extrabold text-2xl tracking-tight">Today</h2>
            <p className="text-muted-foreground text-sm">{dayName}</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-6 text-center border border-border/40">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-headline font-bold">No training scheduled</p>
          <p className="text-sm text-muted-foreground mt-1">
            {dateStr < '2026-04-06'
              ? 'Training starts April 6, 2026. Get excited!'
              : 'Your plan has concluded. What a journey!'}
          </p>
        </div>
      </section>
    );
  }

  const sport = training.sport as Sport;
  const isCompleted = training.completions && training.completions.length > 0;
  const isRest = sport === 'rest';
  const config = SPORT_CONFIG[sport];

  return (
    <section className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline font-extrabold text-2xl tracking-tight">Today</h2>
          <p className="text-muted-foreground text-sm">
            {dayName}
            {weekLabel && (
              <span>
                {', '}{weekLabel}
                {phaseLabel && <span className="text-primary/80 ml-1">· {phaseLabel}</span>}
              </span>
            )}
          </p>
        </div>
        <Link href="/plan" className="text-primary text-xs font-headline font-bold tracking-widest uppercase py-1">
          View Plan
        </Link>
      </div>

      {isRest ? (
        <div className="bg-card rounded-2xl p-6 border border-border/40">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-muted-foreground text-2xl">{config.materialIcon}</span>
            </div>
            <div>
              <p className="font-headline font-bold text-lg text-foreground">Rest Day</p>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{training.description}</p>
              <p className="text-xs text-muted-foreground/60 mt-3 italic">
                {REST_MESSAGES[Math.floor(today.getTime() / 86400000) % REST_MESSAGES.length]}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="bg-card rounded-2xl overflow-hidden border border-border/40 active:scale-[0.99] transition-transform"
          onClick={() => window.location.href = `/training/${training.id}`}
        >
          <div className="flex">
            <div className={`w-1.5 flex-shrink-0 sport-bar-${sport}`} />
            <div className="flex-1 p-5">
              <div className="flex justify-between items-start mb-4">
                <div
                  className="p-2.5 rounded-xl"
                  style={{ background: `color-mix(in srgb, var(--sport-${sport}) 15%, transparent)` }}
                >
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={{ color: `var(--sport-${sport})` }}
                  >
                    {config.materialIcon}
                  </span>
                </div>
                <span
                  className="text-[10px] font-headline font-bold tracking-widest uppercase px-2 py-1 rounded-lg"
                  style={{
                    background: `color-mix(in srgb, var(--sport-${sport}) 15%, transparent)`,
                    color: `var(--sport-${sport})`,
                  }}
                >
                  {config.label.en}
                </span>
              </div>
              <h3
                className="font-headline font-bold text-xl mb-2"
                style={{ color: isCompleted ? `var(--sport-${sport})` : undefined }}
              >
                {training.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
                {training.description}
              </p>
              {isCompleted && (
                <div className="flex items-center gap-2 text-sm font-headline font-bold" style={{ color: `var(--sport-run)` }}>
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Completed
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
