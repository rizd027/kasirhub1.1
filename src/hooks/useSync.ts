import { useState, useCallback } from 'react';
import { runSync } from '@/services/sync/syncManager';
import { syncProductsDown } from '@/services/sync/syncProducts';
import { db } from '@/db/dexie';
import { useLiveQuery } from 'dexie-react-hooks';

import { syncCategoriesDown } from '@/services/sync/syncCategories';
import { syncSettingsDown, syncProfileDown } from '@/services/sync/syncSettings';
import { syncAttendance } from '@/services/sync/syncAttendance';

export const triggerSync = async (userId?: string | boolean) => {
    try {
        // 1. Push local changes
        await runSync();

        // 2. Pull remote changes if userId is provided
        if (typeof userId === 'string') {
            await Promise.all([
                syncProductsDown(userId),
                syncCategoriesDown(userId),
                syncSettingsDown(userId),
                syncProfileDown(userId),
                syncAttendance(userId)
            ]);
        }
    } catch (error) {
        console.error('triggerSync failed:', error);
        throw error;
    }
};

export const useSync = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    
    const pendingCount = useLiveQuery(
        () => db.sync_queue.count(),
        []
    ) || 0;

    const performSync = useCallback(async (userId?: string) => {
        if (isSyncing) return;
        setIsSyncing(true);
        try {
            await triggerSync(userId);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    return {
        isSyncing,
        pendingCount,
        performSync,
        triggerSync // Also export from hook for convenience
    };
};
