'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { TABLE_CONFIG, runPullSync } from '@/services/sync/syncManager';

const VISIBILITY_COOLDOWN_MS = 60_000; // 1 menit
const BACKOFF_DELAYS = [2_000, 5_000, 15_000, 30_000, 60_000];

const safeRemoveChannel = (ch: ReturnType<typeof supabase.channel>): void => {
    setTimeout(() => {
        try { supabase.removeChannel(ch); } catch { /* abaikan */ }
    }, 0);
};

export function useRealtimeSync(): void {
    const { session } = useStaffStore();

    const channelRef      = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const sessionIdRef    = useRef<string | null>(null);
    const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef    = useRef(false);
    const isSettingUpRef  = useRef(false);
    const lastSetupAtRef  = useRef<number>(0);
    const retryCountRef   = useRef<number>(0);

    const teardown = useCallback(() => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }

        if (channelRef.current) {
            safeRemoveChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    const setupChannel = useCallback(async (userId: string) => {
        if (!isMountedRef.current) return;
        if (isSettingUpRef.current) return;

        isSettingUpRef.current = true;
        lastSetupAtRef.current = Date.now();

        teardown();

        await new Promise<void>(r => setTimeout(r, 300));

        if (!isMountedRef.current) {
            isSettingUpRef.current = false;
            return;
        }

        const tag = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
        const channelName = `realtime-kasirhub-${userId}-${tag}`;

        let builder = supabase.channel(channelName, {
            config: { broadcast: { self: false } },
        });

        if ((builder as any).subscription) {
            isSettingUpRef.current = false;
            return;
        }

        for (const [tableName, config] of Object.entries(TABLE_CONFIG)) {
            const filterField = config.hasUserId ? 'user_id' : 'id';

            builder = builder.on(
                'postgres_changes' as any,
                {
                    event: '*',
                    schema: 'public',
                    table: tableName,
                    filter: `${filterField}=eq.${userId}`,
                },
                async (payload: any) => {
                    if (!isMountedRef.current) return;
                    await handleRealtimeEvent(tableName, config, payload);
                }
            );
        }

        builder.subscribe((status) => {
            if (!isMountedRef.current) return;

            if (status === 'SUBSCRIBED') {
                retryCountRef.current = 0;
                // Set channelRef hanya setelah sukses subscribe untuk menghindari race condition di teardown
                channelRef.current = builder;
            }

            if (
                status === 'CLOSED' ||
                status === 'CHANNEL_ERROR' ||
                status === 'TIMED_OUT'
            ) {
                const count = Math.min(retryCountRef.current, BACKOFF_DELAYS.length - 1);
                const delay = BACKOFF_DELAYS[count];
                retryCountRef.current++;

                retryTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        isSettingUpRef.current = false; // reset agar bisa setup ulang
                        setupChannel(userId);
                    }
                }, delay);
            }
        });

        isSettingUpRef.current = false;
    }, [teardown]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRealtimeEvent = async (
        tableName: string,
        config: typeof TABLE_CONFIG[string],
        payload: any
    ): Promise<void> => {
        try {
            const store = (db as any)[tableName];
            if (!store) return;

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const remote = payload.new;
                const pk = remote[config.pk];
                if (!pk) return;

                if (config.hasSoftDelete && remote.deleted_at) {
                    await store.delete(pk);
                    return;
                }

                const local = await store.get(pk);
                if (local?.sync_status === 'pending') return;

                await store.put({ ...remote, sync_status: 'synced' });

            } else if (payload.eventType === 'DELETE') {
                const pk = payload.old?.[config.pk];
                if (pk) {
                    await store.delete(pk);
                }
            }
        } catch (err) {
            console.error(`[RealtimeSync] Error [${tableName}]:`, err);
        }
    };

    useEffect(() => {
        const userId = session?.owner_id || session?.id;
        if (!userId) return;

        if (sessionIdRef.current === userId && channelRef.current) return;

        isMountedRef.current = true;
        sessionIdRef.current = userId;
        retryCountRef.current = 0;

        setupChannel(userId);

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            if (!isMountedRef.current) return;

            const now = Date.now();
            if (now - lastSetupAtRef.current < VISIBILITY_COOLDOWN_MS) return;

            const { isPushActive, isPullActive } = require('@/services/sync/syncManager');
            if (isPushActive || isPullActive) return;

            const tables = Object.keys(TABLE_CONFIG).filter(
                t => t !== 'profiles' && t !== 'settings'
            );
            runPullSync(userId, tables).catch(() => { });

            if (!channelRef.current) {
                setupChannel(userId);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            isMountedRef.current = false;
            sessionIdRef.current = null;
            document.removeEventListener('visibilitychange', handleVisibility);
            teardown();
        };
    }, [session?.id, session?.owner_id, setupChannel, teardown]);
}
