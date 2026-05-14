'use client';

import { useEffect, useRef } from 'react';
import { useSync, triggerSync } from '@/hooks/useSync';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useStaffStore } from '@/store/useStaffStore';
import { retryFailedJobs, forceResetSync } from '@/services/sync/syncManager';

/**
 * SyncProvider
 *
 * Dipasang sekali di root layout. Mengatur:
 * 1. Realtime subscription (Supabase → Dexie)
 * 2. Background polling setiap 3 menit sebagai safety net
 * 3. Online recovery: push + pull saat koneksi pulih
 * 4. Retry failed jobs setiap siklus polling
 */
export function SyncProvider() {
    const { session } = useStaffStore();
    const userId = session?.id;

    // isSyncing hanya untuk UI — JANGAN taruh di deps interval
    const { isSyncing } = useSync();
    const isSyncingRef = useRef(isSyncing);
    useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);
    
    // One-time Recovery: Reset stale locks from older version
    useEffect(() => {
        const VERSION_KEY = 'kasirhub_sync_v2';
        if (typeof window !== 'undefined' && !localStorage.getItem(VERSION_KEY)) {
            console.log('[SyncProvider] 🔧 One-time sync recovery reset...');
            forceResetSync();
            localStorage.setItem(VERSION_KEY, '1');
        }
    }, []);

    // Realtime: satu tempat, satu subscription
    useRealtimeSync();

    // Background polling + online recovery
    useEffect(() => {
        if (!userId) return;

        const poll = () => {
            if (!navigator.onLine) return;
            if (isSyncingRef.current) return;

            console.log('[SyncProvider] 🔄 Background poll...');
            triggerSync(userId).catch(console.error);
            retryFailedJobs().catch(console.error);
        };

        // Polling setiap 3 menit
        const intervalId = setInterval(poll, 3 * 60 * 1000);

        // Push segera saat koneksi pulih
        const handleOnline = () => {
            console.log('[SyncProvider] 🌐 Online — trigger sync');
            triggerSync(userId).catch(console.error);
        };
        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
        // userId bukan userId + isSyncing — agar interval tidak dibuat ulang saat sync
    }, [userId]);

    return null;
}
