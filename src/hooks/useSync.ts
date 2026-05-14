'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    triggerFullSync,
    runPushSync,
    onSyncStateChange,
    getSyncStats,
} from '@/services/sync/syncManager';
import { db } from '@/db/dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStaffStore } from '@/store/useStaffStore';

export const triggerSync = async (userId?: string | boolean): Promise<void> => {
    if (typeof userId === 'string') {
        await triggerFullSync(userId);
    } else {
        await runPushSync();
    }
};

export const useSync = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    const { session } = useStaffStore();
    const userId = session?.id;
    const hasInitialized = useRef(false);

    useEffect(() => {
        return onSyncStateChange(setIsSyncing);
    }, []);

    const pendingCount = useLiveQuery(
        () => db.sync_queue.where('sync_status').equals('pending').count(),
        [],
        0
    );

    useEffect(() => {
        if (pendingCount > 0) {
            console.log('[Sync] Queue count:', pendingCount);
        }
    }, [pendingCount]);

    const failedCount = useLiveQuery(
        () => db.sync_queue.where('sync_status').equals('failed').count(),
        [],
        0
    );

    useEffect(() => {
        if (!userId || hasInitialized.current) return;
        hasInitialized.current = true;

        triggerFullSync(userId).catch(err => {
            console.error('[useSync] Initial sync error:', err);
        });
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            hasInitialized.current = false;
        }
    }, [userId]);

    const performSync = useCallback(async (uid?: string) => {
        const targetId = uid || userId;
        if (!targetId) return;
        await triggerFullSync(targetId);
    }, [userId]);

    return {
        isSyncing,
        pendingCount: pendingCount ?? 0,
        failedCount: failedCount ?? 0,
        performSync,
        triggerSync,
        getSyncStats,
    };
};
