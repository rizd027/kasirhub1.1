import { db } from '@/db/dexie';
import { supabase } from '../supabase';

export const syncCategoriesDown = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        if (!data) return;

        for (const remote of data) {
            const local = await db.categories.get(remote.id);

            if (!local || new Date(remote.created_at).getTime() > new Date(local.updated_at || 0).getTime()) {
                await db.categories.put({
                    ...remote,
                    sync_status: 'synced',
                    updated_at: remote.created_at // Use created_at if updated_at is missing on categories
                });
            }
        }
    } catch (err) {
        console.error('syncCategoriesDown failed:', err);
    }
};
