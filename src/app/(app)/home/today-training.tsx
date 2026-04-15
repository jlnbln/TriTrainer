'use client';

import { TrainingCard } from '@/components/training-card';
import { SPORT_CONFIG } from '@/lib/constants';
import type { Sport } from '@/lib/types';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

interface RaceConfig {
  swimDistanceM: number;
  bikeDistanceKm: number;
  runDistanceKm: number;
}

interface TodayTrainingProps {
  training: any;
  week: any;
  dateStr: string;
  raceConfig?: RaceConfig | null;
}

const REST_MESSAGES = [
  'Rest is where the magic happens. Your body is adapting and getting stronger.',
  "Recovery day! Let your muscles rebuild. You've earned this.",
  "Today's workout: absolutely nothing. And that's perfect.",
  "Rest days aren't lazy days — they're growth days.",
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TodayTraining({ training, week, dateStr, raceConfig }: TodayTrainingProps) {
  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];
  const t = useTranslations('home');
  const locale = useLocale();

  const phase = week?.phases;
  const weekLabel = week ? `Week ${week.week_number}` : '';
  const phaseLabel = phase?.name?.[locale] || phase?.name?.en || '';

  if (!training) {
    return (
      <section className="space-y-3">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-headline font-extrabold text-2xl tracking-tight">{t('today')}</h2>
            <p className="text-muted-foreground text-sm">{dayName}</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl p-6 text-center border border-border/40">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-headline font-bold">{t('noTraining')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {dateStr < '2026-04-06' ? t('beforePlan') : t('afterPlan')}
          </p>
        </div>
      </section>
    );
  }

  const sport = training.sport as Sport;
  const isCompleted = training.completions && training.completions.length > 0;
  const isRest = sport === 'rest';
  const isRace = sport === 'race';
  const config = SPORT_CONFIG[sport];

  return (
    <section className="space-y-3">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="font-headline font-extrabold text-2xl tracking-tight">{t('today')}</h2>
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

      {isRace ? (
        /* ── Race day hero card ── */
        <a
          href={`/training/${training.id}`}
          className="block rounded-3xl overflow-hidden active:scale-[0.99] transition-transform"
          style={{
            background: 'color-mix(in srgb, var(--sport-race) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--sport-race) 30%, transparent)',
          }}
        >
          <div className="p-6 relative overflow-hidden">
            {/* Watermark trophy */}
            <div className="absolute -right-4 -top-4 opacity-[0.08] pointer-events-none select-none">
              <span className="material-symbols-outlined text-[120px]" style={{ color: 'var(--sport-race)', fontVariationSettings: "'FILL' 1" }}>
                emoji_events
              </span>
            </div>

            <div className="relative z-10">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3 font-headline text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ background: 'var(--sport-race)', color: '#0c1322' }}
              >
                🏅 Race Day
              </div>

              <h3 className="font-headline font-extrabold text-2xl tracking-tight mb-1" style={{ color: 'var(--sport-race)' }}>
                {training.title}
              </h3>

              {/* Race format strip */}
              {raceConfig && (
                <div className="flex items-center gap-2 mt-3 mb-4 flex-wrap">
                  {[
                    { icon: 'pool',            color: 'var(--sport-swim)', dist: raceConfig.swimDistanceM >= 1000 ? `${raceConfig.swimDistanceM/1000}km` : `${raceConfig.swimDistanceM}m` },
                    { icon: 'directions_bike', color: 'var(--sport-bike)', dist: `${raceConfig.bikeDistanceKm}km` },
                    { icon: 'directions_run',  color: 'var(--sport-run)',  dist: `${raceConfig.runDistanceKm}km`  },
                  ].map((seg, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-muted-foreground/40 text-sm">→</span>}
                      <span className="material-symbols-outlined text-base" style={{ color: seg.color, fontVariationSettings: "'FILL' 1" }}>{seg.icon}</span>
                      <span className="font-headline font-bold text-sm" style={{ color: seg.color }}>{seg.dist}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                {isCompleted ? (
                  <div className="flex items-center gap-2 font-headline font-bold text-sm text-emerald-400">
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Race Complete!
                  </div>
                ) : (
                  <span className="font-headline font-bold text-sm" style={{ color: 'var(--sport-race)' }}>Tap to open race details →</span>
                )}
              </div>
            </div>
          </div>
        </a>
      ) : isRest ? (
        <div className="bg-card rounded-2xl p-6 border border-border/40">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-muted-foreground text-2xl">{config.materialIcon}</span>
            </div>
            <div>
              <p className="font-headline font-bold text-lg text-foreground">{t('restDay')}</p>
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
                  {config.label[locale as 'en' | 'de'] ?? config.label.en}
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
