'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { TABLE_CONFIG, runPullSync } from '@/services/sync/syncManager';

// Cooldown visibilitychange (ms)
const VISIBILITY_COOLDOWN_MS = 60_000; // 1 menit
// Exponential backoff delays
const BACKOFF_DELAYS = [2_000, 5_000, 15_000, 30_000, 60_000];

/**
 * safeRemoveChannel
 *
 * Wrapper aman untuk supabase.removeChannel() yang menghindari
 * "Maximum call stack size exceeded" akibat Supabase internal recursive callbacks.
 * Menggunakan setTimeout(0) untuk memutus call stack.
 */
const safeRemoveChannel = (ch: ReturnType<typeof supabase.channel>): void => {
    setTimeout(() => {
        try { supabase.removeChannel(ch); } catch { /* abaikan */ }
    }, 0);
};

/**
 * useRealtimeSync
 *
 * Mendengarkan semua perubahan Supabase Realtime menggunakan SATU channel
 * dengan multiple postgres_changes listeners — satu per tabel.
 * Ini jauh lebih efisien dan menghindari akumulasi channel yang menyebabkan
 * stack overflow pada Supabase internal event system.
 *
 * Fitur:
 * - Single channel — hanya 1 WebSocket connection untuk semua tabel
 * - Auto-reconnect dengan exponential backoff
 * - Re-subscribe saat tab aktif dengan cooldown 60s
 * - Guard concurrent setup (isSettingUpRef)
 * - Cleanup aman via safeRemoveChannel (non-recursive)
 */
export function useRealtimeSync(): void {
    const { session } = useStaffStore();

    // Hanya satu channel sekarang
    const channelRef      = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const sessionIdRef    = useRef<string | null>(null);
    const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef    = useRef(false);
    const isSettingUpRef  = useRef(false);
    const lastSetupAtRef  = useRef<number>(0);
    const retryCountRef   = useRef<number>(0);

    /** Bersihkan channel aktif secara aman */
    const teardown = useCallback(() => {
        // Cancel retry timer
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }

        // Remove channel lama secara aman (non-blocking, non-recursive)
        if (channelRef.current) {
            safeRemoveChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    /** Setup single channel dengan semua tabel listeners */
    const setupChannel = useCallback(async (userId: string) => {
        if (!isMountedRef.current) return;
        if (isSettingUpRef.current) return;

        isSettingUpRef.current = true;
        lastSetupAtRef.current = Date.now();

        // Teardown channel lama
        teardown();

        // Tunggu sebentar agar Supabase client selesai memproses removal sebelumnya
        await new Promise<void>(r => setTimeout(r, 300));

        if (!isMountedRef.current) {
            isSettingUpRef.current = false;
            return;
        }

        // Buat 1 channel unik dengan tag waktu + random salt untuk menjamin keunikan mutlak
        const tag = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
        const channelName = `realtime-kasirhub-${userId}-${tag}`;

        // Mulai build channel
        let builder = supabase.channel(channelName, {
            config: { broadcast: { self: false } },
        });

        // Cek jika channel sudah subscribed (seharusnya tidak mungkin dengan tag unik, tapi guard untuk safety)
        if ((builder as any).subscription) {
            isSettingUpRef.current = false;
            return;
        }

        // Tambah listener postgres_changes untuk setiap tabel
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

        // Subscribe dan handle status
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
                // Channel mati — schedule reconnect dengan backoff
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

    /** Handle event masuk dari Supabase Realtime */
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

                // Soft-delete dari cloud
                if (config.hasSoftDelete && remote.deleted_at) {
                    await store.delete(pk);
                    return;
                }

                // Local wins: jangan timpa data yang pending push
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
        if (!session?.id) return;

        // StrictMode protection: jangan re-setup jika session sama dan channel aktif
        if (sessionIdRef.current === session.id && channelRef.current) return;

        isMountedRef.current = true;
        sessionIdRef.current = session.id;
        retryCountRef.current = 0;

        setupChannel(session.id);

        // Re-subscribe saat tab kembali aktif — dengan cooldown 60 detik
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            if (!isMountedRef.current) return;

            const now = Date.now();
            // Throttle: hanya pull jika > 60 detik sejak setup terakhir (VISIBILITY_COOLDOWN_MS)
            if (now - lastSetupAtRef.current < VISIBILITY_COOLDOWN_MS) return;

            // Jangan pull jika push/pull sedang berjalan (cek dari syncManager state)
            const { isPushActive, isPullActive } = require('@/services/sync/syncManager');
            if (isPushActive || isPullActive) return;

            // Pull catch-up data yang terlewat
            const tables = Object.keys(TABLE_CONFIG).filter(
                t => t !== 'profiles' && t !== 'settings'
            );
            runPullSync(session.id, tables).catch(() => { });

            // Re-setup hanya jika channel mati
            if (!channelRef.current) {
                setupChannel(session.id);
            }
        };

        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            isMountedRef.current = false;
            sessionIdRef.current = null;
            document.removeEventListener('visibilitychange', handleVisibility);
            teardown();
        };
    }, [session?.id, setupChannel, teardown]);
}
