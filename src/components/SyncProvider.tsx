'use client';

import { useEffect, useRef } from 'react';
import { useSync, triggerSync } from '@/hooks/useSync';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useStaffStore } from '@/store/useStaffStore';
import { retryFailedJobs, forceResetSync } from '@/services/sync/syncManager';

export function SyncProvider() {
    const { session } = useStaffStore();
    const userId = session?.owner_id || session?.id;

    const { isSyncing } = useSync();
    const isSyncingRef = useRef(isSyncing);
    useEffect(() => { isSyncingRef.current = isSyncing; }, [isSyncing]);
    
    useEffect(() => {
        const VERSION_KEY = 'kasirhub_sync_v2';
        if (typeof window !== 'undefined' && !localStorage.getItem(VERSION_KEY)) {
            console.log('[SyncProvider] 🔧 One-time sync recovery reset...');
            forceResetSync();
            localStorage.setItem(VERSION_KEY, '1');
        }
    }, []);

    useRealtimeSync();

    useEffect(() => {
        if (!userId) return;

        const poll = () => {
            if (!navigator.onLine) return;
            if (isSyncingRef.current) return;

            console.log('[SyncProvider] 🔄 Background poll...');
            triggerSync(userId).catch(console.error);
            retryFailedJobs().catch(console.error);
        };

        const intervalId = setInterval(poll, 3 * 60 * 1000);

        const handleOnline = () => {
            console.log('[SyncProvider] 🌐 Online — trigger sync');
            triggerSync(userId).catch(console.error);
        };
        window.addEventListener('online', handleOnline);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
    }, [userId]);

    return null;
}
