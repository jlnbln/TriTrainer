'use client';

import { useEffect, useRef } from 'react';
import { TrainingCard } from '@/components/training-card';
import type { Sport } from '@/lib/types';
import { cn } from '@/lib/utils';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface PlanViewProps {
  weeks: any[];
  currentWeekNumber: number;
}

export function PlanView({ weeks, currentWeekNumber }: PlanViewProps) {
  const currentWeekRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentWeekRef.current) {
      currentWeekRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  let currentPhase = 0;

  return (
    <div className="space-y-10">
      {weeks.map((week) => {
        const isCurrentWeek = week.week_number === currentWeekNumber;
        const isPastWeek = week.week_number < currentWeekNumber;
        const showPhaseHeader = week.phases.phase_number !== currentPhase;
        if (showPhaseHeader) currentPhase = week.phases.phase_number;

        const completedCount = week.trainings.filter((t: any) => t.completions?.length > 0).length;
        const activitiesCount = week.trainings.filter((t: any) => t.sport !== 'rest').length;

        return (
          <div key={week.id}>
            {showPhaseHeader && (
              <div className={cn('mb-5', week.week_number > 1 && 'mt-2')}>
                <div className={cn(
                  'flex items-end justify-between',
                  isCurrentWeek && 'border-l-2 border-primary pl-4'
                )}>
                  <div>
                    <p className="font-headline text-[10px] uppercase tracking-widest font-bold text-primary mb-1">
                      Weeks {week.phases.phase_number === 1 ? '1–6' :
                             week.phases.phase_number === 2 ? '7–12' :
                             week.phases.phase_number === 3 ? '13–17' : '18–22'}
                    </p>
                    <h3 className="font-headline font-bold text-xl">
                      Phase {week.phases.phase_number}: {week.phases.name?.en}
                    </h3>
                  </div>
                  {isPastWeek && completedCount === activitiesCount && activitiesCount > 0 && (
                    <span className="font-headline text-xs font-bold flex items-center gap-1" style={{ color: 'var(--sport-run)' }}>
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      COMPLETED
                    </span>
                  )}
                </div>
              </div>
            )}

            <div
              ref={isCurrentWeek ? currentWeekRef : undefined}
              className={cn(
                'bg-card rounded-2xl overflow-hidden border',
                isCurrentWeek
                  ? 'border-primary/40 shadow-[0_0_0_1px] shadow-primary/20'
                  : 'border-border/40',
                isPastWeek && 'opacity-60'
              )}
            >
              {/* Week header */}
              <div className="px-5 pt-5 pb-4 border-b border-border/20">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="font-headline font-bold text-xl">
                        {week.label.includes('Race Week') ? 'Race Week' : `Week ${week.week_number}`}
                      </h4>
                      {isCurrentWeek && (
                        <span className="bg-primary text-primary-foreground text-[9px] font-headline font-black px-2 py-0.5 rounded uppercase tracking-tight">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(week.start_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(week.end_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="font-headline text-xs font-medium text-muted-foreground">
                    {completedCount}/{activitiesCount}
                  </span>
                </div>

                {/* Progress bar */}
                {activitiesCount > 0 && (
                  <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(completedCount / activitiesCount) * 100}%`,
                        background: 'var(--sport-run)',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Days list */}
              <div className="divide-y divide-border/10">
                {week.trainings.map((training: any) => (
                  <TrainingCard
                    key={training.id}
                    id={training.id}
                    sport={training.sport as Sport}
                    title={training.title}
                    date={training.date}
                    dayLabel={DAY_NAMES[training.day_of_week]}
                    isCompleted={training.completions?.length > 0}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
