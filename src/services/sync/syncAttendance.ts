import { db } from '@/db/dexie';
import { supabase } from '../supabase';

export const syncAttendance = async (userId: string) => {
    try {
        console.log('[Sync] Starting attendance sync...');
        
        // 1. Get remote attendance for this user
        const { data: remoteData, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        if (!remoteData) return;

        // 2. Sync to local Dexie
        for (const remote of remoteData) {
            const local = await db.attendance.get(remote.id);
            
            if (!local) {
                // Insert new remote record
                await db.attendance.put({
                    ...remote,
                    synced: 1
                });
            } else if (local.synced === 0) {
                // If local exists but not synced, it will be handled by sync_queue
                // No action needed here to avoid conflicts
            } else {
                // Update existing record if needed (rare for attendance as it's mostly immutable)
                await db.attendance.put({
                    ...remote,
                    synced: 1
                });
            }
        }

        console.log(`[Sync] Attendance synced: ${remoteData.length} records processed.`);
    } catch (err) {
        console.error('[Sync] Attendance sync failed:', err);
    }
};
