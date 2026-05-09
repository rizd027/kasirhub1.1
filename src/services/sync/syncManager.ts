import { db } from '@/db/dexie';
import { supabase } from '../supabase';
import { createId } from '@/utils/uuid';

let isSyncing = false;

export const runSync = async () => {
    if (isSyncing) return;
    isSyncing = true;

    try {
        const queue = await db.sync_queue
            .orderBy('id')
            .toArray();

        for (const job of queue) {
            try {
                let error;

                // Strip local-only properties before sending to Supabase
                const cleanPayload = { ...job.payload };
                delete cleanPayload.sync_status;
                delete cleanPayload.items;
                delete cleanPayload.icon; 
                delete cleanPayload.image; 
                delete cleanPayload.synced; 
                delete cleanPayload.updated_at; // Handled by Supabase triggers
                // Note: we keep created_at for initial insert if provided

                if (job.operation === 'insert') {
                    const { data, error: insertError, status } = await supabase
                        .from(job.table_name)
                        .insert(cleanPayload)
                        .select();
                    error = insertError;
                    console.log(`[Sync] Insert status for ${job.record_id}:`, status, data);
                } else if (job.operation === 'update') {
                    const pkColumn = (job.table_name === 'settings' || job.table_name === 'profiles') ? 'user_id' : 'id';
                    const { data, error: updateError, status } = await supabase
                        .from(job.table_name)
                        .update(cleanPayload)
                        .eq(pkColumn, job.record_id)
                        .select();
                    error = updateError;
                    console.log(`[Sync] Update status for ${job.record_id}:`, status, data);
                } else if (job.operation === 'delete') {
                    const pkColumn = (job.table_name === 'settings' || job.table_name === 'profiles') ? 'user_id' : 'id';
                    const { error: deleteError, status } = await supabase
                        .from(job.table_name)
                        .delete()
                        .eq(pkColumn, job.record_id);
                    error = deleteError;
                    console.log(`[Sync] Delete status for ${job.record_id}:`, status);
                }

                if (error) {
                    // Special case: Schema cache mismatch for barcode_type - Handle SILENTLY to avoid console noise
                    if (error.message?.toLowerCase().includes("barcode_type") || error.code === 'PGRST204') {
                        console.warn(`[Sync] 🛠️ Schema mismatch for barcode_type. Auto-repairing payload for ${job.record_id}...`);
                        const repairedPayload = { ...job.payload };
                        delete repairedPayload.barcode_type;
                        await db.sync_queue.update(job.id, { payload: repairedPayload, retry_count: 0 });
                        continue; 
                    }

                    console.error(`[Sync] ❌ Failed ${job.table_name} ${job.record_id}:`, error.message || 'Unknown error', {
                        code: error.code,
                        details: error.details,
                        hint: error.hint
                    });

                    // Conflict resolution: skip unrecoverable errors immediately
                    if (
                        error.code === '23505' || // Duplicate key
                        error.code === '23503' || // Foreign key violation (invalid user_id)
                        error.code === '42501' || // RLS policy violation
                        error.code === 'PGRST203'
                    ) { 
                         console.warn(`[Sync] Skipping incompatible job ${job.id} for table ${job.table_name} (${error.code})`);
                         await db.sync_queue.delete(job.id);
                         continue;
                    }

                    const newRetryCount = (job.retry_count || 0) + 1;
                    if (newRetryCount > 3) {
                        console.warn(`[Sync] 🗑️ Skipping job ${job.id} after ${newRetryCount} retries`);
                        await db.sync_queue.delete(job.id);
                        continue;
                    }

                    await db.sync_queue.update(job.id, {
                        retry_count: newRetryCount
                    });

                    // Don't break, try next one
                    continue;
                }

                // Success
                console.log(`[Sync] ✅ Successfully synced ${job.table_name} ${job.record_id}`);
                await db.sync_queue.delete(job.id);

                // Update local sync status
                if (job.operation !== 'delete') {
                    const table = (db as any)[job.table_name];
                    if (table) {
                        await table.update(job.record_id, { sync_status: 'synced' });
                    }
                }

            } catch (err) {
                console.error('[Sync] 💥 Fatal error in sync job:', err);
                break;
            }
        }
    } finally {
        isSyncing = false;
    }
};

export const addToSyncQueue = async (
    tableName: string,
    operation: 'insert' | 'update' | 'delete',
    recordId: string,
    payload: any
) => {
    await db.sync_queue.add({
        table_name: tableName,
        operation,
        record_id: recordId,
        payload,
        created_at: new Date().toISOString(),
        retry_count: 0
    });
};
