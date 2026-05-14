import { db } from '@/db/dexie';
import { supabase } from '../supabase';
import { getLastSyncAt, setLastSyncAt } from './syncManager';

export const syncSettingsDown = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const local = await db.settings.get(userId);

        // Hanya overwrite jika server lebih baru DAN lokal bukan pending
        const localUpdatedAt = new Date(local?.updated_at || 0).getTime();
        const remoteUpdatedAt = new Date(data.updated_at || 0).getTime();

        if (!local || remoteUpdatedAt > localUpdatedAt) {
            await db.settings.put(data);
        }
    } catch (err) {
        console.error('syncSettingsDown failed:', err);
    }
};

export const syncProfileDown = async (userId: string) => {
    try {
        const since = getLastSyncAt('profiles');
        const now = new Date().toISOString();

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const local = await db.profiles.get(userId);
        const localUpdatedAt = new Date(local?.updated_at || 0).getTime();
        const remoteUpdatedAt = new Date(data.updated_at || 0).getTime();

        if (!local || remoteUpdatedAt > localUpdatedAt) {
            await db.profiles.put(data);
            setLastSyncAt('profiles', now);
        }
    } catch (err) {
        console.error('syncProfileDown failed:', err);
    }
};
