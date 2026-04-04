import type { Sport } from './types';

export const RACE_DATE = '2026-09-06';
export const PLAN_START = '2026-04-06';

// Colors match the Stitch design system (dark mode values)
// Light mode equivalents are in globals.css as CSS vars
export const SPORT_CONFIG: Record<Sport, {
  color: string;
  darkColor: string;
  label: { en: string; de: string };
  emoji: string;
  materialIcon: string;
}> = {
  swim: {
    color: '#005ac2',
    darkColor: '#adc6ff',
    label: { en: 'Swimming', de: 'Schwimmen' },
    emoji: '🏊',
    materialIcon: 'pool',
  },
  run: {
    color: '#006d30',
    darkColor: '#4ae176',
    label: { en: 'Running', de: 'Laufen' },
    emoji: '🏃',
    materialIcon: 'directions_run',
  },
  bike: {
    color: '#8a3800',
    darkColor: '#ffb690',
    label: { en: 'Biking', de: 'Radfahren' },
    emoji: '🚴',
    materialIcon: 'directions_bike',
  },
  brick: {
    color: '#ba1a1a',
    darkColor: '#ffb4ab',
    label: { en: 'Brick', de: 'Koppeltraining' },
    emoji: '🔥',
    materialIcon: 'layers',
  },
  rest: {
    color: '#5c6478',
    darkColor: '#8c909f',
    label: { en: 'Rest Day', de: 'Ruhetag' },
    emoji: '😴',
    materialIcon: 'bedtime',
  },
  race: {
    color: '#795900',
    darkColor: '#ffd767',
    label: { en: 'Race Day', de: 'Renntag' },
    emoji: '🏅',
    materialIcon: 'emoji_events',
  },
};
