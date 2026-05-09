'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';

/**
 * useRealtimeSync
 * Subscribes to Supabase Realtime and syncs changes directly into IndexedDB (Dexie).
 * Must be mounted once at the layout level (e.g. inside AuthCheck or layout.tsx).
 */
export function useRealtimeSync() {
    const { session } = useStaffStore();
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    useEffect(() => {
        if (!session?.id) return;

        // Clean up previous subscription if any
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase
            .channel(`realtime-sync-${session.id}`)
            // --- PRODUCTS ---
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products',
                filter: `user_id=eq.${session.id}`,
            }, async (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.products.put({ ...payload.new, sync_status: 'synced' } as any);
                } else if (payload.eventType === 'DELETE') {
                    await db.products.delete(payload.old.id);
                }
            })
            // --- CATEGORIES ---
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'categories',
                filter: `user_id=eq.${session.id}`,
            }, async (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.categories.put({ ...payload.new, sync_status: 'synced' } as any);
                } else if (payload.eventType === 'DELETE') {
                    await db.categories.delete(payload.old.id);
                }
            })
            // --- TRANSACTIONS ---
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'transactions',
                filter: `user_id=eq.${session.id}`,
            }, async (payload) => {
                // Only upsert if we don't already have it (avoid overwriting local data)
                const existing = await db.transactions.get(payload.new.id);
                if (!existing) {
                    await db.transactions.put({ ...payload.new, sync_status: 'synced', items: [] } as any);
                }
            })
            // --- ATTENDANCE ---
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'attendance',
                filter: `user_id=eq.${session.id}`,
            }, async (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.attendance.put({ ...payload.new, synced: 1 } as any);
                } else if (payload.eventType === 'DELETE') {
                    await db.attendance.delete(payload.old.id);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[RealtimeSync] Subscribed to realtime changes');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('[RealtimeSync] Channel error, will retry on next mount');
                }
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [session?.id]);
}
