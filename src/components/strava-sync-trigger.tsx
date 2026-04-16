'use client';

import { useEffect } from 'react';

interface StravaSyncTriggerProps {
  lastSyncAt: string | null;
}

export function StravaSyncTrigger({ lastSyncAt }: StravaSyncTriggerProps) {
  useEffect(() => {
    const lastSync = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
    if (Date.now() - lastSync > 30 * 60 * 1000) {
      fetch('/api/strava/sync', { method: 'POST' }).catch(() => {});
    }
  }, []);

  return null;
}
