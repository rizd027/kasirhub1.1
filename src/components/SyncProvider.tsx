'use client';

import { useSync } from '@/hooks/useSync';

/**
 * Mounts the background sync hook globally.
 * Placed in root layout so sync runs on every page.
 */
export function SyncProvider() {
  useSync();
  return null;
}
