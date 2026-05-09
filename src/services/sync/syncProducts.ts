import { db, Product } from '@/db/dexie';
import { supabase } from '../supabase';

export const syncProductsDown = async (userId: string) => {
    try {
        const { data: remoteProducts, error } = await supabase
            .from('products')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        if (!remoteProducts) return;

        for (const remote of remoteProducts) {
            const local = await db.products.get(remote.id);

            if (!local) {
                // New product from remote
                await db.products.put({
                    ...remote,
                    sync_status: 'synced'
                });
                continue;
            }

            // Conflict resolution: latest updated_at wins
            const localUpdatedAt = new Date(local.updated_at || 0).getTime();
            const remoteUpdatedAt = new Date(remote.updated_at || 0).getTime();

            if (remoteUpdatedAt > localUpdatedAt) {
                // Remote is newer
                await db.products.put({
                    ...remote,
                    sync_status: 'synced'
                });
            } else if (local.sync_status === 'synced' && remoteUpdatedAt < localUpdatedAt) {
                // This shouldn't happen often if sync is working, but just in case
                // Local is newer and already synced (maybe from another device?) 
                // Or maybe local was updated but not yet synced (sync_status would be 'pending')
            }
        }

        // Handle deletions (if deleted_at is used in Supabase)
        const deletedRemote = remoteProducts.filter(p => p.deleted_at);
        for (const p of deletedRemote) {
            await db.products.delete(p.id);
        }

    } catch (err) {
        console.error('syncProductsDown failed:', err);
    }
};
