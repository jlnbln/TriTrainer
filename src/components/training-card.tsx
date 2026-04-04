'use client';

import Link from 'next/link';
import { SPORT_CONFIG } from '@/lib/constants';
import type { Sport } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TrainingCardProps {
  id: number;
  sport: Sport;
  title: string;
  date: string;
  dayLabel?: string;
  isCompleted?: boolean;
  compact?: boolean;
}

export function TrainingCard({
  id,
  sport,
  title,
  dayLabel,
  isCompleted,
  compact,
}: TrainingCardProps) {
  const config = SPORT_CONFIG[sport];
  const isRest = sport === 'rest';

  if (isRest) {
    return (
      <div className={cn('flex items-center gap-4', compact ? 'py-3 px-4' : 'py-4 px-5')}>
        <div className={cn('w-1.5 self-stretch rounded-full', `sport-bar-${sport}`)} />
        <div>
          {dayLabel && (
            <p className={cn('font-headline font-bold uppercase tracking-widest text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px]')}>
              {dayLabel}
            </p>
          )}
          <p className={cn('font-headline font-semibold text-muted-foreground', compact ? 'text-sm' : 'text-base')}>
            {title}
          </p>
        </div>
        <span className="material-symbols-outlined text-muted-foreground/40 ml-auto text-xl">
          {config.materialIcon}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/training/${id}`}
      className={cn(
        'flex items-center gap-4 hover:bg-accent/30 active:scale-[0.98] transition-all cursor-pointer',
        compact ? 'py-3 px-4' : 'py-4 px-5'
      )}
    >
      <div className={cn('w-1.5 self-stretch rounded-full flex-shrink-0', `sport-bar-${sport}`)} />
      <div className="flex-1 min-w-0">
        {dayLabel && (
          <p
            className={cn('font-headline font-bold uppercase tracking-widest', compact ? 'text-[9px]' : 'text-[10px]')}
            style={{ color: `var(--sport-${sport})` }}
          >
            {dayLabel} · {config.label.en}
          </p>
        )}
        <p className={cn('font-headline font-semibold truncate text-foreground', compact ? 'text-sm' : 'text-base')}>
          {title}
        </p>
      </div>
      {isCompleted ? (
        <span className="material-symbols-outlined flex-shrink-0 text-xl" style={{ color: `var(--sport-${sport})`, fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
      ) : (
        <span className="material-symbols-outlined flex-shrink-0 text-xl" style={{ color: `var(--sport-${sport})`, opacity: 0.6 }}>
          {config.materialIcon}
        </span>
      )}
    </Link>
  );
}
