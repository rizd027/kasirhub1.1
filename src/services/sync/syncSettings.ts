import { db } from '@/db/dexie';
import { supabase } from '../supabase';

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

        if (!local || new Date(data.updated_at).getTime() > new Date(local.updated_at).getTime()) {
            await db.settings.put(data);
        }
    } catch (err) {
        console.error('syncSettingsDown failed:', err);
    }
};

export const syncProfileDown = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const local = await db.profiles.get(userId);

        if (!local || new Date(data.updated_at).getTime() > new Date(local.updated_at).getTime()) {
            await db.profiles.put(data);
        }
    } catch (err) {
        console.error('syncProfileDown failed:', err);
    }
};
