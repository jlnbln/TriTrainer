'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface UnlinkedActivity {
  id: number;
  sport_type: string;
  activity_date: string;
  distance_meters: number | null;
  duration_seconds: number | null;
  activity_name: string | null;
}

interface SettingsViewProps {
  profile: any;
  gear: any[];
  totalRunKm: number;
  userId: string;
  stravaConnected: boolean;
  stravaLastSyncAt: string | null;
  unlinkedActivities: UnlinkedActivity[];
}

function formatDurationShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDistanceShort(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SPORT_ICONS: Record<string, string> = {
  swim: 'pool',
  run: 'directions_run',
  bike: 'directions_bike',
  brick: 'fitness_center',
};

export function SettingsView({
  profile,
  gear,
  totalRunKm,
  userId,
  stravaConnected,
  stravaLastSyncAt,
  unlinkedActivities,
}: SettingsViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('settings');

  const [name, setName] = useState(profile?.name || '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm || '');
  const [weightKg, setWeightKg] = useState(profile?.weight_kg || '');
  const [language, setLanguage] = useState(profile?.language || 'en');
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Race config
  const [raceDate, setRaceDate] = useState(profile?.race_date || '2026-09-06');
  const [swimDistanceM, setSwimDistanceM] = useState(profile?.swim_distance_m ?? 750);
  const [bikeDistanceKm, setBikeDistanceKm] = useState(profile?.bike_distance_km ?? 20);
  const [runDistanceKm, setRunDistanceKm] = useState(profile?.run_distance_km ?? 5);
  const [swimGoalMinutes, setSwimGoalMinutes] = useState(profile?.swim_goal_minutes ?? '');
  const [bikeGoalMinutes, setBikeGoalMinutes] = useState(profile?.bike_goal_minutes ?? '');
  const [runGoalMinutes, setRunGoalMinutes] = useState(profile?.run_goal_minutes ?? '');

  const [newShoeName, setNewShoeName] = useState('');
  const [newShoeDate, setNewShoeDate] = useState('');
  const [showAddShoe, setShowAddShoe] = useState(false);
  const [deleteGearId, setDeleteGearId] = useState<number | null>(null);

  // Strava state
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const [stravaUnlinkedExpanded, setStravaUnlinkedExpanded] = useState(false);
  const [assignMap, setAssignMap] = useState<Record<number, string>>({});
  const [linkingActivity, setLinkingActivity] = useState<number | null>(null);
  const [dismissingActivity, setDismissingActivity] = useState<number | null>(null);
  const [trainingOptions, setTrainingOptions] = useState<Record<number, any[]>>({});

  useEffect(() => setMounted(true), []);

  async function loadTrainingOptions(activity: UnlinkedActivity) {
    if (trainingOptions[activity.id]) return;

    // Get the week range for this activity's date (±7 days to cover same week)
    const date = new Date(activity.activity_date + 'T12:00:00Z');
    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() - 6);
    const weekEnd = new Date(date);
    weekEnd.setUTCDate(date.getUTCDate() + 6);

    const { data: trainings } = await supabase
      .from('trainings')
      .select('id, date, title, sport')
      .eq('sport', activity.sport_type)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0])
      .order('date', { ascending: true });

    setTrainingOptions((prev) => ({ ...prev, [activity.id]: trainings ?? [] }));
  }

  async function syncStrava() {
    setStravaSyncing(true);
    try {
      await fetch('/api/strava/sync', { method: 'POST' });
    } finally {
      setStravaSyncing(false);
      router.refresh();
    }
  }

  async function disconnectStrava() {
    await fetch('/api/strava/disconnect', { method: 'POST' });
    router.refresh();
  }

  async function dismissActivity(activityId: number) {
    setDismissingActivity(activityId);
    try {
      await fetch('/api/strava/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaActivityId: activityId }),
      });
      router.refresh();
    } finally {
      setDismissingActivity(null);
    }
  }

  async function linkActivity(activityId: number) {
    const trainingId = assignMap[activityId];
    if (!trainingId) return;

    setLinkingActivity(activityId);
    try {
      const response = await fetch('/api/strava/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stravaActivityId: activityId, trainingId: Number(trainingId) }),
      });

      if (!response.ok) {
        const err = await response.json();
        alert(err.error || 'Failed to link activity');
        return;
      }

      router.refresh();
    } finally {
      setLinkingActivity(null);
    }
  }

  async function saveProfile() {
    setSaving(true);
    const dbTheme = theme === 'system' ? 'auto' : (theme as 'light' | 'dark' | 'auto') || 'auto';
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      name: name || null,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      language,
      theme: dbTheme,
      race_date: raceDate || null,
      swim_distance_m: swimDistanceM ? Number(swimDistanceM) : 750,
      bike_distance_km: bikeDistanceKm ? Number(bikeDistanceKm) : 20,
      run_distance_km: runDistanceKm ? Number(runDistanceKm) : 5,
      swim_goal_minutes: swimGoalMinutes ? Number(swimGoalMinutes) : null,
      bike_goal_minutes: bikeGoalMinutes ? Number(bikeGoalMinutes) : null,
      run_goal_minutes: runGoalMinutes ? Number(runGoalMinutes) : null,
    });
    setSaving(false);
    if (error) alert('Failed to save: ' + error.message);
    else router.refresh();
  }

  async function addShoe() {
    if (!newShoeName) return;
    await supabase.from('gear').insert({
      user_id: userId,
      type: 'running_shoes',
      name: newShoeName,
      purchase_date: newShoeDate || null,
      max_distance_km: 800,
    });
    setNewShoeName('');
    setNewShoeDate('');
    setShowAddShoe(false);
    router.refresh();
  }

  async function deleteGear(id: number) {
    await supabase.from('gear').delete().eq('id', id);
    setDeleteGearId(null);
    router.refresh();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const themeOptions = [
    { value: 'light',  labelKey: 'light' as const, icon: 'light_mode' },
    { value: 'dark',   labelKey: 'dark'  as const, icon: 'dark_mode' },
    { value: 'system', labelKey: 'auto'  as const, icon: 'settings_brightness' },
  ] as const;

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-8 space-y-8">
      <div>
        <h2 className="font-headline font-bold text-3xl tracking-tight">{t('title')}</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and equipment</p>
      </div>

      {/* Profile bento card */}
      <section>
        <div className="bg-card rounded-2xl p-5 border border-border/40 relative overflow-hidden flex items-center gap-5">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-muted border border-border/40 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-muted-foreground text-3xl">person</span>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="font-headline font-bold text-lg bg-transparent border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 h-auto py-1"
            />
            <div className="flex gap-4 pt-1">
              <div>
                <p className="font-headline text-[9px] uppercase tracking-widest text-muted-foreground">Height</p>
                <div className="flex items-baseline gap-1">
                  <Input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="–"
                    className="font-headline font-bold text-lg text-primary bg-transparent border-0 px-0 h-auto py-0 w-14 focus-visible:ring-0"
                  />
                  <span className="text-xs text-muted-foreground">cm</span>
                </div>
              </div>
              <div>
                <p className="font-headline text-[9px] uppercase tracking-widest text-muted-foreground">Weight</p>
                <div className="flex items-baseline gap-1">
                  <Input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="–"
                    className="font-headline font-bold text-lg text-primary bg-transparent border-0 px-0 h-auto py-0 w-14 focus-visible:ring-0"
                  />
                  <span className="text-xs text-muted-foreground">kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Race Configuration */}
      <section className="space-y-3">
        <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">
          Race Configuration
        </h3>
        <div className="bg-card rounded-2xl border border-border/40 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: 'var(--sport-race)' }} />
          <div className="p-5 space-y-5">

            {/* Race date */}
            <div>
              <Label className="font-headline text-[10px] uppercase tracking-widest text-muted-foreground">Race Date</Label>
              <Input
                type="date"
                value={raceDate}
                onChange={(e) => setRaceDate(e.target.value)}
                className="mt-1 bg-muted border-0 font-headline font-bold"
              />
            </div>

            {/* Distances */}
            <div>
              <p className="font-headline text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Distances</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="font-headline text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--sport-swim)' }}>pool</span>
                    Swim
                  </Label>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Input
                      type="number"
                      value={swimDistanceM}
                      onChange={(e) => setSwimDistanceM(e.target.value as any)}
                      className="font-headline font-bold bg-muted border-0 px-2 h-9"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">m</span>
                  </div>
                </div>
                <div>
                  <Label className="font-headline text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--sport-bike)' }}>directions_bike</span>
                    Bike
                  </Label>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Input
                      type="number"
                      value={bikeDistanceKm}
                      onChange={(e) => setBikeDistanceKm(e.target.value as any)}
                      className="font-headline font-bold bg-muted border-0 px-2 h-9"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">km</span>
                  </div>
                </div>
                <div>
                  <Label className="font-headline text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--sport-run)' }}>directions_run</span>
                    Run
                  </Label>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Input
                      type="number"
                      value={runDistanceKm}
                      onChange={(e) => setRunDistanceKm(e.target.value as any)}
                      className="font-headline font-bold bg-muted border-0 px-2 h-9"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">km</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Goal times */}
            <div>
              <p className="font-headline text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Goal Times</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="font-headline text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--sport-swim)' }}>pool</span>
                    Swim
                  </Label>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Input
                      type="number"
                      value={swimGoalMinutes}
                      onChange={(e) => setSwimGoalMinutes(e.target.value as any)}
                      placeholder="–"
                      className="font-headline font-bold bg-muted border-0 px-2 h-9"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">min</span>
                  </div>
                </div>
                <div>
                  <Label className="font-headline text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--sport-bike)' }}>directions_bike</span>
                    Bike
                  </Label>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Input
                      type="number"
                      value={bikeGoalMinutes}
                      onChange={(e) => setBikeGoalMinutes(e.target.value as any)}
                      placeholder="–"
                      className="font-headline font-bold bg-muted border-0 px-2 h-9"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">min</span>
                  </div>
                </div>
                <div>
                  <Label className="font-headline text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--sport-run)' }}>directions_run</span>
                    Run
                  </Label>
                  <div className="flex items-baseline gap-1 mt-1">
                    <Input
                      type="number"
                      value={runGoalMinutes}
                      onChange={(e) => setRunGoalMinutes(e.target.value as any)}
                      placeholder="–"
                      className="font-headline font-bold bg-muted border-0 px-2 h-9"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">min</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Strava */}
      <section className="space-y-3">
        <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">
          Strava
        </h3>

        {!stravaConnected ? (
          <div className="bg-card rounded-2xl border border-border/40 overflow-hidden p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(252,76,2,0.12)' }}>
              <span className="material-symbols-outlined text-2xl" style={{ color: '#FC4C02' }}>directions_run</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-headline font-bold text-base">Connect Strava</p>
              <p className="text-muted-foreground text-xs mt-0.5">Automatically import your workouts</p>
            </div>
            <button
              onClick={() => { window.location.href = '/api/strava/auth'; }}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-secondary to-emerald-500 text-black font-headline font-bold text-xs uppercase tracking-wider"
            >
              Connect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-card rounded-2xl border border-border/40 overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-secondary" />
              <div className="p-5 pl-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="font-headline font-bold text-sm">Connected</span>
                  </div>
                  <button
                    onClick={disconnectStrava}
                    className="text-xs font-headline font-bold text-destructive/70 hover:text-destructive transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {stravaLastSyncAt
                      ? `Last synced ${formatRelativeTime(stravaLastSyncAt)}`
                      : 'Never synced'}
                  </p>
                  <button
                    onClick={syncStrava}
                    disabled={stravaSyncing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 font-headline font-bold text-xs hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <span className={cn('material-symbols-outlined text-sm', stravaSyncing && 'animate-spin')}>
                      sync
                    </span>
                    {stravaSyncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                </div>
              </div>
            </div>

            {unlinkedActivities.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/40 overflow-hidden">
                <button
                  onClick={() => setStravaUnlinkedExpanded(!stravaUnlinkedExpanded)}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[color:var(--sport-race)] text-lg">warning</span>
                    <span className="font-headline font-bold text-sm">
                      {unlinkedActivities.length} {unlinkedActivities.length === 1 ? 'activity needs' : 'activities need'} review
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-muted-foreground">
                    {stravaUnlinkedExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {stravaUnlinkedExpanded && (
                  <div className="border-t border-border/40 divide-y divide-border/40">
                    {unlinkedActivities.map((activity) => (
                      <div key={activity.id} className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="material-symbols-outlined text-base"
                            style={{ color: `var(--sport-${activity.sport_type})` }}
                          >
                            {SPORT_ICONS[activity.sport_type] ?? 'fitness_center'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-headline font-semibold text-sm truncate">
                              {activity.activity_name || activity.sport_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(activity.activity_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {activity.distance_meters ? ` · ${formatDistanceShort(activity.distance_meters)}` : ''}
                              {activity.duration_seconds ? ` · ${formatDurationShort(activity.duration_seconds)}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => dismissActivity(activity.id)}
                            disabled={dismissingActivity === activity.id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors shrink-0"
                            title="Dismiss — won't be imported again"
                          >
                            <span className="material-symbols-outlined text-muted-foreground text-base">
                              {dismissingActivity === activity.id ? 'progress_activity' : 'close'}
                            </span>
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <Select
                            value={assignMap[activity.id] ?? ''}
                            onValueChange={(v: string) => setAssignMap((prev) => ({ ...prev, [activity.id]: v }))}
                            onOpenChange={(open) => { if (open) loadTrainingOptions(activity); }}
                          >
                            <SelectTrigger className="flex-1 bg-muted border-0 h-9 text-xs font-headline">
                              <SelectValue placeholder="Assign to training…" />
                            </SelectTrigger>
                            <SelectContent>
                              {(trainingOptions[activity.id] ?? []).map((t) => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                  {new Date(t.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {t.title}
                                </SelectItem>
                              ))}
                              {(trainingOptions[activity.id] ?? []).length === 0 && trainingOptions[activity.id] !== undefined && (
                                <SelectItem value="none" disabled>No open slots in this week</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() => linkActivity(activity.id)}
                            disabled={!assignMap[activity.id] || linkingActivity === activity.id}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-secondary to-emerald-500 text-black font-headline font-bold text-xs disabled:opacity-40 shrink-0"
                          >
                            {linkingActivity === activity.id ? '…' : 'Link'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Appearance */}
      <section className="space-y-3">
        <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">
          App Appearance
        </h3>
        <div className="bg-card rounded-2xl p-1 flex border border-border/40">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex-1 py-3 px-3 rounded-xl font-headline text-sm font-medium flex items-center justify-center gap-1.5 transition-all',
                mounted && theme === opt.value
                  ? 'bg-muted text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="material-symbols-outlined text-base">{opt.icon}</span>
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="space-y-3">
        <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">
          Language
        </h3>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="bg-card border-border/40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="de">Deutsch</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {/* Running Gear */}
      <section className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Running Gear
          </h3>
          <button
            onClick={() => setShowAddShoe(!showAddShoe)}
            className="flex items-center gap-1 font-headline text-xs font-bold tracking-wider text-secondary hover:opacity-80 transition-opacity"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            ADD
          </button>
        </div>

        {showAddShoe && (
          <div className="bg-card rounded-2xl border border-border/40 p-4 space-y-3">
            <Input placeholder="Shoe name (e.g. Nike Pegasus 41)" value={newShoeName} onChange={(e) => setNewShoeName(e.target.value)} className="bg-muted border-0" />
            <Input type="date" value={newShoeDate} onChange={(e) => setNewShoeDate(e.target.value)} className="bg-muted border-0" />
            <div className="flex gap-2">
              <button
                onClick={addShoe}
                disabled={!newShoeName}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-secondary to-emerald-500 text-black font-headline font-bold text-sm uppercase tracking-wider disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => setShowAddShoe(false)}
                className="flex-1 py-2.5 rounded-xl border border-border/40 font-headline font-bold text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {gear.filter((g) => g.type === 'running_shoes').length === 0 && !showAddShoe && (
          <p className="text-sm text-muted-foreground px-1">
            {t('noShoes')}
          </p>
        )}

        {gear.filter((g) => g.type === 'running_shoes').map((shoe) => {
          const wearPercent = Math.min(100, Math.round((totalRunKm / shoe.max_distance_km) * 100));
          const remaining = Math.max(0, shoe.max_distance_km - totalRunKm);

          return (
            <div key={shoe.id} className="bg-card rounded-2xl border border-border/40 overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 sport-bar-run" />
              <div className="p-5 pl-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-headline font-bold text-base">{shoe.name}</h4>
                    {shoe.purchase_date && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Purchased {new Date(shoe.purchase_date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setDeleteGearId(shoe.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                    <span className="material-symbols-outlined text-muted-foreground text-lg">delete</span>
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-secondary">
                      {wearPercent}% Lifespan used
                    </span>
                    <span className="font-headline text-xs font-medium text-muted-foreground">
                      {totalRunKm.toFixed(0)} / {shoe.max_distance_km} km
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${wearPercent}%`, background: 'var(--sport-run)' }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                    <span>{totalRunKm.toFixed(0)} km used</span>
                    <span style={{ color: 'var(--sport-run)' }}>{remaining.toFixed(0)} km remaining</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Delete gear confirmation */}
      <Dialog open={deleteGearId !== null} onOpenChange={(open) => { if (!open) setDeleteGearId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove shoes?</DialogTitle>
            <DialogDescription>This will permanently delete this shoe and its tracking data. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteGearId(null)}
              className="flex-1 py-3 rounded-xl border border-border/40 font-headline font-bold text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteGearId !== null && deleteGear(deleteGearId)}
              className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground font-headline font-bold text-sm"
            >
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Actions */}
      <div className="space-y-3 pt-2">
        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full py-4 bg-gradient-to-br from-secondary to-emerald-500 rounded-2xl text-black font-headline font-bold text-sm uppercase tracking-widest shadow-lg shadow-secondary/10 active:scale-95 transition-all disabled:opacity-60"
        >
          {saving ? t('saving') : t('save')}
        </button>
        <button
          onClick={handleLogout}
          className="w-full py-4 border border-destructive/30 rounded-2xl text-destructive font-headline font-bold text-sm uppercase tracking-widest hover:bg-destructive/5 active:scale-95 transition-all"
        >
          {t('signOut')}
        </button>
      </div>
    </div>
  );
}
