import { Waves, PersonStanding, Bike, Flame, Moon, Trophy } from 'lucide-react';
import type { Sport } from '@/lib/types';
import { SPORT_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

const iconMap: Record<Sport, React.ElementType> = {
  swim: Waves,
  run: PersonStanding,
  bike: Bike,
  brick: Flame,
  rest: Moon,
  race: Trophy,
};

export function SportIcon({
  sport,
  className,
  size = 'md',
}: {
  sport: Sport;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const Icon = iconMap[sport];
  const config = SPORT_CONFIG[sport];
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full',
        size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10',
        className
      )}
      style={{ backgroundColor: config.color + '20', color: config.color }}
    >
      <Icon className={sizeClass} />
    </div>
  );
}
