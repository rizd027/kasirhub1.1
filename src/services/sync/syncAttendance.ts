import { db } from '@/db/dexie';
import { supabase } from '../supabase';
import { getLastSyncAt, setLastSyncAt } from './syncManager';

export const syncAttendance = async (userId: string) => {
    try {
        const since = getLastSyncAt('attendance');
        const now = new Date().toISOString();

        const { data: remoteData, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .gt('created_at', since)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        if (!remoteData || remoteData.length === 0) return;

        console.log(`[Sync↓] attendance: ${remoteData.length} record sejak ${since}`);

        for (const remote of remoteData) {
            const local = await db.attendance.get(remote.id);

            if (!local) {
                await db.attendance.put({ ...remote, synced: 1 });
            } else if (local.synced === 0) {
                // Data lokal belum tersinkronisasi — jangan overwrite
                // sync_queue akan menangani push ke server
            } else {
                await db.attendance.put({ ...remote, synced: 1 });
            }
        }

        setLastSyncAt('attendance', now);
        console.log(`[Sync↓] Attendance synced: ${remoteData.length} records.`);
    } catch (err) {
        console.error('[Sync] Attendance sync failed:', err);
    }
};
