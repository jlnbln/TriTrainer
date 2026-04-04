'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface SettingsViewProps {
  profile: any;
  gear: any[];
  totalRunKm: number;
  userId: string;
}

export function SettingsView({ profile, gear, totalRunKm, userId }: SettingsViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(profile?.name || '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm || '');
  const [weightKg, setWeightKg] = useState(profile?.weight_kg || '');
  const [language, setLanguage] = useState(profile?.language || 'en');
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [newShoeName, setNewShoeName] = useState('');
  const [newShoeDate, setNewShoeDate] = useState('');
  const [showAddShoe, setShowAddShoe] = useState(false);

  useEffect(() => setMounted(true), []);

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
    router.refresh();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const themeOptions = [
    { value: 'light', label: 'Light', icon: 'light_mode' },
    { value: 'dark',  label: 'Dark',  icon: 'dark_mode' },
    { value: 'system', label: 'Auto', icon: 'settings_brightness' },
  ] as const;

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-8 space-y-8">
      <div>
        <h2 className="font-headline font-bold text-3xl tracking-tight">Settings</h2>
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

      {/* Appearance */}
      <section className="space-y-3">
        <h3 className="font-headline text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">
          App Appearance
        </h3>
        <div className="bg-card rounded-2xl p-1 flex border border-border/40">
          {themeOptions.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                'flex-1 py-3 px-3 rounded-xl font-headline text-sm font-medium flex items-center justify-center gap-1.5 transition-all',
                mounted && theme === t.value
                  ? 'bg-muted text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="material-symbols-outlined text-base">{t.icon}</span>
              {t.label}
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
            No shoes added yet. Add your running shoes to track their wear.
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
                  <button onClick={() => deleteGear(shoe.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
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

      {/* Actions */}
      <div className="space-y-3 pt-2">
        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full py-4 bg-gradient-to-br from-secondary to-emerald-500 rounded-2xl text-black font-headline font-bold text-sm uppercase tracking-widest shadow-lg shadow-secondary/10 active:scale-95 transition-all disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          onClick={handleLogout}
          className="w-full py-4 border border-destructive/30 rounded-2xl text-destructive font-headline font-bold text-sm uppercase tracking-widest hover:bg-destructive/5 active:scale-95 transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
