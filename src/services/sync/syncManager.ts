import { db, SyncQueue } from '@/db/dexie';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

// ─── Last Sync Timestamp Helpers ─────────────────────────────────────────────
export const getLastSyncAt = (tableName: string): string => {
    return localStorage.getItem(`last_sync_${tableName}`) || '2000-01-01T00:00:00.000Z';
};

export const setLastSyncAt = (tableName: string, timestamp: string): void => {
    localStorage.setItem(`last_sync_${tableName}`, timestamp);
};

export const resetLastSyncAt = (tableName: string): void => {
    localStorage.setItem(`last_sync_${tableName}`, '2000-01-01T00:00:00.000Z');
};

// ─── Session Initial Sync Flag ────────────────────────────────────────────────
/**
 * sessionStorage flag — reset otomatis saat refresh / tab baru.
 * Menjamin satu kali full pull per sesi, tidak di setiap navigasi halaman.
 */
const INITIAL_SYNC_KEY = 'kasirhub_initial_sync_done';

export const hasCompletedInitialSync = (): boolean => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(INITIAL_SYNC_KEY) === '1';
};

export const markInitialSyncDone = (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(INITIAL_SYNC_KEY, '1');
};

export const resetInitialSync = (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(INITIAL_SYNC_KEY);
};

// ─── Constants ───────────────────────────────────────────────────────────────
const PUSH_LOCK_KEY  = 'kasirhub_push_lock';
const PULL_LOCK_KEY  = 'kasirhub_pull_lock';
const LOCK_TTL_MS    = 30_000;   // 30 detik (cukup untuk operasi panjang, tidak blokir refresh)
const PUSH_BATCH     = 10;       // Supabase upsert efisien menangani 10-20 record
const PULL_BATCH     = 100;      // record per iterasi pull
const REQ_TIMEOUT_MS = 60_000;   // Ditingkatkan ke 60s agar tidak mudah timeout di Supabase Free Tier
const PUSH_DELAY_MS  = 100;      // Delay kecil antar batch untuk stabilitas
const MAX_RETRIES    = 5;
const BACKOFF_MS     = [1_000, 3_000, 10_000, 30_000, 60_000];
const FULL_SYNC_COOLDOWN_MS = 30_000;
const WATCHDOG_INTERVAL_MS  = 30_000; // Dipercepat dari 5 menit menjadi 30 detik agar jika gagal cepat re-try tanpa refresh

// ─── Table Configuration ──────────────────────────────────────────────────────
export const TABLE_CONFIG: Record<string, {
    pk: string;
    hasUserId: boolean;
    hasSoftDelete: boolean;
    syncFields?: string[];
}> = {
    profiles:            { pk: 'id',      hasUserId: false, hasSoftDelete: false },
    settings:            { pk: 'user_id', hasUserId: true,  hasSoftDelete: false },
    categories:          { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    products:            { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    ingredients:         { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    hpp_batches:         { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    bundling:            { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    processing_costs:    { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    product_ingredients: { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    transactions:        { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    transaction_items:   { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    expenses:            { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    stock_logs:          { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    employees:           { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    attendance:          { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
    customer_orders:     { pk: 'id',      hasUserId: true,  hasSoftDelete: true  },
};

// ─── Tab Identity ─────────────────────────────────────────────────────────────
const TAB_ID = (() => {
    if (typeof window === 'undefined') return 'server';
    const stored = sessionStorage.getItem('kasirhub_tab_id');
    if (stored) return stored;
    const id = Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('kasirhub_tab_id', id);
    return id;
})();

// ─── Internal State ───────────────────────────────────────────────────────────
let isPushActive = false;
let isPullActive = false;
let needsAnotherPush = false;
let lastFullSyncAt = 0;
let pushStartedAt = 0;
let pullStartedAt = 0;

// ─── State Listeners (untuk UI) ──────────────────────────────────────────────
const listeners = new Set<(state: boolean) => void>();

export const onSyncStateChange = (cb: (state: boolean) => void): (() => void) => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
};

const notifyState = (): void => {
    const active = isPushActive || isPullActive;
    listeners.forEach(cb => { try { cb(active); } catch { } });
};

// ─── Distributed Lock (per-type: push / pull) ────────────────────────────────
const acquireLock = (lockKey: string, force = false): boolean => {
    if (typeof window === 'undefined') return true;
    const now = Date.now();
    const raw = localStorage.getItem(lockKey);
    if (raw && !force) {
        try {
            const { tabId, timestamp } = JSON.parse(raw);
            // Lock milik tab ini → boleh re-acquire
            if (tabId === TAB_ID) return true;
            // Lock dari tab lain yang masih valid → tolak
            if (now - timestamp < LOCK_TTL_MS) return false;
            // Lock expired → paksa ambil
        } catch { /* JSON rusak, ambil lock */ }
    }
    localStorage.setItem(lockKey, JSON.stringify({ tabId: TAB_ID, timestamp: now }));
    return true;
};

const releaseLock = (lockKey: string): void => {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(lockKey);
        if (!raw) return;
        const { tabId } = JSON.parse(raw);
        if (tabId === TAB_ID) localStorage.removeItem(lockKey);
    } catch { localStorage.removeItem(lockKey); }
};

const refreshLock = (lockKey: string): void => {
    // Perbarui timestamp agar lock tidak expire saat operasi panjang
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(lockKey);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (obj.tabId === TAB_ID) {
            obj.timestamp = Date.now();
            localStorage.setItem(lockKey, JSON.stringify(obj));
        }
    } catch { }
};

// ─── Watchdog: auto-reset jika sync stuck ────────────────────────────────────
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

const startWatchdog = (): void => {
    if (watchdogTimer || typeof window === 'undefined') return;
    watchdogTimer = setInterval(() => {
        const now = Date.now();
        if (isPushActive && pushStartedAt > 0 && now - pushStartedAt > WATCHDOG_INTERVAL_MS) {
            console.warn('[Sync Watchdog] 🐕 Push recovery — auto-reset stuck process');
            isPushActive = false;
            pushStartedAt = 0;
            releaseLock(PUSH_LOCK_KEY);
            notifyState();
        }
        if (isPullActive && pullStartedAt > 0 && now - pullStartedAt > WATCHDOG_INTERVAL_MS) {
            console.warn('[Sync Watchdog] 🐕 Pull recovery — auto-reset stuck process');
            isPullActive = false;
            pullStartedAt = 0;
            releaseLock(PULL_LOCK_KEY);
            notifyState();
        }
        
        // Background Auto-Retry: Trigger push jika ada pending jobs yang siap
        if (!isPushActive && !isPullActive) {
            // Recovery: Jika ada job tanpa status (stuck), set ke pending
            db.sync_queue.where('sync_status').equals('').toArray().then(stuck => {
                if (stuck.length > 0) {
                    console.log(`[Sync Watchdog] 🐕 Recovering ${stuck.length} stuck jobs without status`);
                    db.sync_queue.bulkUpdate(stuck.map(s => ({ key: s.id, changes: { sync_status: 'pending' } })));
                }
            });

            db.sync_queue.where('sync_status').equals('pending').limit(1).count().then(count => {
                if (count > 0) {
                    console.log('[Sync Watchdog] 🐕 Triggering background push for pending jobs');
                    runPushSync().catch(() => {});
                }
            });
        }
    }, 20_000); // cek setiap 20 detik
};

if (typeof window !== 'undefined') {
    startWatchdog();
    // Release lock saat tab ditutup
    window.addEventListener('beforeunload', () => {
        releaseLock(PUSH_LOCK_KEY);
        releaseLock(PULL_LOCK_KEY);
    });
    // Saat tab visibility kembali, perbarui lock
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if (isPushActive) refreshLock(PUSH_LOCK_KEY);
            if (isPullActive) refreshLock(PULL_LOCK_KEY);
        }
    });
}

// ─── Timeout Helper ───────────────────────────────────────────────────────────
const withTimeout = async <T>(
    builderFn: (signal: AbortSignal) => any,
    ms = REQ_TIMEOUT_MS,
    parentSignal?: AbortSignal
): Promise<T> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
        try { ctrl.abort(); } catch { }
    }, ms);

    return Promise.race([
        (async () => {
            try {
                return await builderFn(ctrl.signal);
            } catch (err: any) {
                if (err.name === 'AbortError' || ctrl.signal.aborted) {
                    throw new Error('TIMEOUT');
                }
                throw err;
            }
        })(),
        new Promise<T>((_, reject) => {
            if (parentSignal?.aborted) {
                reject(new Error('ABORTED'));
                return;
            }
            parentSignal?.addEventListener('abort', () => reject(new Error('ABORTED')));
            ctrl.signal.addEventListener('abort', () => {
                reject(new Error('TIMEOUT'));
            });
        })
    ]).finally(() => {
        clearTimeout(timer);
        try { ctrl.abort(); } catch { }
    });
};

// ─── Error Classification ─────────────────────────────────────────────────────
type SyncErrorType = 'network' | 'auth' | 'validation' | 'rate_limit' | 'unknown';

const classifyError = (error: any): SyncErrorType => {
    const msg = (error?.message || '').toLowerCase();
    const code = error?.code || error?.status;
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('fetch') || msg.includes('offline') || code === 0) return 'network';
    if (msg.includes('auth') || msg.includes('jwt') || code === 401 || code === 403) return 'auth';
    if (msg.includes('violates') || msg.includes('null') || msg.includes('constraint') || code === 400 || code === 409) return 'validation';
    if (msg.includes('rate limit') || code === 429) return 'rate_limit';
    return 'unknown';
};

const isRetryable = (type: SyncErrorType, count: number): boolean =>
    count < MAX_RETRIES && (type === 'network' || type === 'rate_limit');

const backoff = (count: number): number =>
    BACKOFF_MS[Math.min(count, BACKOFF_MS.length - 1)];

// ─── Payload Preparation ──────────────────────────────────────────────────────
/**
 * Bersihkan payload sebelum dikirim ke Supabase.
 * Selalu sertakan primary key. Hapus field lokal-only.
 */
const LOCAL_ONLY_FIELDS = new Set([
    'sync_status', 'is_new', 'expanded', 'synced', 'remote_id', 'temp_id',
    'is_active_local', 'is_loading', 'ai_suggested', 'is_ai_generated', 'items',
]);

const preparePayload = (
    raw: Record<string, any>,
    table: string,
    op: 'insert' | 'update' | 'delete'
): Record<string, any> => {
    const config = TABLE_CONFIG[table];
    const pk = config?.pk || 'id';

    if (op === 'delete') {
        if (config?.hasSoftDelete) {
            return { [pk]: raw[pk], deleted_at: new Date().toISOString() };
        }
        return { [pk]: raw[pk] };
    }

    // insert / update: selalu sertakan PK + user_id (jika ada)
    const clean: Record<string, any> = {};

    // Primary key — WAJIB ada
    if (raw[pk] !== undefined) clean[pk] = raw[pk];

    // user_id
    if (config?.hasUserId && raw.user_id !== undefined) {
        clean.user_id = raw.user_id;
    }

    // Semua field kecuali local-only
    Object.entries(raw).forEach(([key, value]) => {
        if (LOCAL_ONLY_FIELDS.has(key)) return;
        if (key === pk || key === 'user_id') return; // sudah ditambah di atas
        clean[key] = value;
    });

    // updated_at — pastikan selalu ada
    if (!clean.updated_at) {
        clean.updated_at = new Date().toISOString();
    }

    return clean;
};

// ─── Push: Local → Cloud ──────────────────────────────────────────────────────
export const runPushSync = async (force = false, signal?: AbortSignal): Promise<void> => {
    if (isPushActive || isPullActive) { // Cegah tabrakan dengan pull
        if (!force) needsAnotherPush = true;
        return;
    }

    if (typeof navigator !== 'undefined' && navigator.locks) {
        let acquired = false;
        await navigator.locks.request(PUSH_LOCK_KEY, { ifAvailable: true }, async (lock) => {
            if (!lock) {
                if (!force) needsAnotherPush = true;
                return;
            }
            acquired = true;
            try {
                await _runPushSyncCore(force, signal);
            } finally {
                isPushActive = false;
                if (needsAnotherPush) {
                    needsAnotherPush = false;
                    setTimeout(() => runPushSync().catch(() => {}), 500);
                }
            }
        });
        if (!acquired) {
            console.log('[Sync Push] 🔒 Lock aktif di tab lain (Web Lock), skip');
        }
    } else {
        // Fallback ke sistem lock berbasis timestamp untuk browser lama
        const now = Date.now();
        const raw = localStorage.getItem(PUSH_LOCK_KEY);
        if (raw && !force) {
            try {
                const { tabId, timestamp } = JSON.parse(raw);
                if (tabId === TAB_ID) {
                    // Lock milik tab ini
                } else if (now - timestamp < 5_000) { 
                    // Jika lock dari tab lain dan baru dibuat (< 5 detik), beri grace period
                    console.log('[Sync Push] 🔒 Lock aktif di tab lain (Fallback), skip');
                    needsAnotherPush = true;
                    return;
                }
            } catch { }
        }
        localStorage.setItem(PUSH_LOCK_KEY, JSON.stringify({ tabId: TAB_ID, timestamp: now }));
        
        try {
            await _runPushSyncCore(force, signal);
        } finally {
            localStorage.removeItem(PUSH_LOCK_KEY);
            isPushActive = false;
            if (needsAnotherPush) {
                needsAnotherPush = false;
                setTimeout(() => runPushSync().catch(() => {}), 500);
            }
        }
    }
};

const _runPushSyncCore = async (force: boolean, signal?: AbortSignal): Promise<void> => {
    isPushActive = true;
    pushStartedAt = Date.now();
    notifyState();

    try {
        let iteration = 0;

        while (!signal?.aborted) {
            iteration++;
            if (iteration > 200) {
                console.warn('[Sync Push] ⚠️ Safety break — terlalu banyak iterasi');
                break;
            }

            refreshLock(PUSH_LOCK_KEY);

            // Ambil hanya job yang benar-benar siap diproses
            const now = new Date().toISOString();
            const queue = await db.sync_queue
                .where('sync_status')
                .equals('pending')
                .and(job =>
                    !job.next_retry_at || job.next_retry_at <= now
                )
                .limit(PUSH_BATCH)
                .toArray();

            if (queue.length === 0) break;

            console.log(`[Sync Push] 📡 Batch #${iteration}: ${queue.length} jobs`);

            // Group by table untuk batch upsert
            const groups = new Map<string, { jobs: typeof queue; payloads: Record<string, any>[] }>();
            for (const job of queue) {
                if (!groups.has(job.table_name)) {
                    groups.set(job.table_name, { jobs: [], payloads: [] });
                }
                const g = groups.get(job.table_name)!;
                g.jobs.push(job);
                g.payloads.push(preparePayload(job.payload ?? {}, job.table_name, job.operation));
            }

            for (const [table, { jobs, payloads }] of groups) {
                if (signal?.aborted) break;

                const config = TABLE_CONFIG[table];
                if (!config) {
                    console.warn(`[Sync Push] ⚠️ Tabel "${table}" tidak terdaftar — skip & hapus`);
                    await db.sync_queue.bulkDelete(jobs.map(j => j.id!));
                    continue;
                }

                const payloadSize = JSON.stringify(payloads).length;

                try {
                    if (payloadSize > 100000) {
                        console.warn(`[Sync Push] ⚠️ Payload [${table}] besar: ${(payloadSize / 1024).toFixed(2)} KB`);
                    }

                    const { error } = await withTimeout<any>(
                        (signal) => supabase.from(table).upsert(payloads, {
                            onConflict: config.pk,
                            ignoreDuplicates: false,
                        }).abortSignal(signal),
                        REQ_TIMEOUT_MS,
                        signal
                    );

                    if (error) throw error;

                    // Sukses: hapus dari queue & tandai synced di store lokal
                    const store = (db as any)[table];
                    await db.transaction('rw', [db.sync_queue, store], async () => {
                        await db.sync_queue.bulkDelete(jobs.map(j => j.id!));

                        if (store) {
                            for (const job of jobs) {
                                if (job.operation === 'delete') {
                                    await store.delete(job.record_id).catch(() => { });
                                } else {
                                    await store.where(config.pk)
                                        .equals(job.record_id)
                                        .modify({ sync_status: 'synced' })
                                        .catch(() => { });
                                }
                            }
                        }
                    });

                    console.log(`[Sync Push] ✅ [${table}]: ${payloads.length} records`);
                    
                    if (PUSH_DELAY_MS > 0) await new Promise(r => setTimeout(r, PUSH_DELAY_MS));

                } catch (err: any) {
                    if (err.message === 'ABORTED') break;

                    const errType = classifyError(err);
                    if (errType === 'auth') {
                        const msg = `Sinkronisasi ${table} gagal (Izin Ditolak). Hubungi Admin untuk perbaikan RLS.`;
                        console.error(`[Sync Push] 🔐 Auth error pada ${table}:`, msg);
                        toast.error(msg, { id: `sync-error-${table}` });
                        
                        // Mark as failed so it doesn't cause an infinite loop
                        for (const job of jobs) {
                            await db.sync_queue.update(job.id!, {
                                sync_status: 'failed',
                                last_error: msg,
                                error_type: 'auth',
                                failed_at: new Date().toISOString(),
                            });
                        }
                        continue;

                    }

                    console.warn(`[Sync Push] ⚠️ Batch failed for [${table}] (${payloads.length} records, ${(payloadSize/1024).toFixed(2)} KB), retrying individually... Error:`, err.message);
                    if (err.message === 'TIMEOUT' || errType === 'network') {
                        console.warn(`[Sync Push] ⏱️ Timeout/Network pada job ${jobs.length}. Skip & lanjutkan job berikutnya.`);
                        
                        for (const job of jobs) {
                            const count = (job.retry_count || 0) + 1;
                            await db.sync_queue.update(job.id!, {
                                retry_count: count,
                                next_retry_at: new Date(Date.now() + backoff(count)).toISOString(),
                                last_error: `[${errType}] ${err.message}`,
                                error_type: errType,
                                last_attempt_at: new Date().toISOString(),
                            });
                        }
                        continue; // ✅ Lanjutkan ke tabel/job berikutnya
                    }

                    // INDIVIDUAL RETRY (Poison Pill Handling)
                    for (const job of jobs) {
                        const singlePayload = payloads.find(p => p[config.pk] === job.record_id) || preparePayload(job.payload ?? {}, table, job.operation);
                        
                        try {
                            const { error: singleError } = await withTimeout<any>(
                                    (signal) => supabase.from(table).upsert(singlePayload, {
                                        onConflict: config.pk,
                                        ignoreDuplicates: false,
                                    }).abortSignal(signal),
                                    REQ_TIMEOUT_MS, // Gunakan full timeout agar tidak premature abort
                                    signal
                                );

                            if (singleError) throw singleError;

                            const store = (db as any)[table];
                            await db.transaction('rw', [db.sync_queue, store], async () => {
                                await db.sync_queue.delete(job.id!);
                                if (store) {
                                    if (job.operation === 'delete') {
                                        await store.delete(job.record_id).catch(() => {});
                                    } else {
                                        await store.where(config.pk).equals(job.record_id).modify({ sync_status: 'synced' }).catch(() => {});
                                    }
                                }
                            });
                            console.log(`[Sync Push] ✅ [${table}] Individual Success: ${job.record_id}`);
                        } catch (singleErr: any) {
                            if (singleErr.message === 'ABORTED') break;
                            const singleErrType = classifyError(singleErr);
                            
                            if (singleErrType === 'auth') {
                                await db.sync_queue.update(job.id!, {
                                    sync_status: 'failed',
                                    last_error: singleErr.message,
                                    error_type: 'auth',
                                    failed_at: new Date().toISOString(),
                                });
                                continue;
                            }

                            const count = (job.retry_count || 0) + 1;
                            if (isRetryable(singleErrType, count)) {
                                await db.sync_queue.update(job.id!, {
                                    retry_count: count,
                                    next_retry_at: new Date(Date.now() + backoff(count)).toISOString(),
                                    last_error: `[${singleErrType}] ${singleErr.message}`,
                                    error_type: singleErrType,
                                    last_attempt_at: new Date().toISOString(),
                                });
                            } else {
                                // Masuk DLQ
                                await db.sync_queue.update(job.id!, {
                                    sync_status: 'failed',
                                    retry_count: count,
                                    last_error: `[${singleErrType}] ${singleErr.message}`,
                                    error_type: singleErrType,
                                    failed_at: new Date().toISOString(),
                                    last_attempt_at: new Date().toISOString(),
                                });
                            }
                        }
                    }
                }
            }
        }

    } catch (err: any) {
        if (err.message !== 'ABORTED' && err.message !== 'TIMEOUT') {
            console.error('[Sync Push] 🔥 Critical error:', err.message);
        }
    } finally {
        isPushActive = false;
        pushStartedAt = 0;
        releaseLock(PUSH_LOCK_KEY);
        notifyState();
    }
};

// ─── Pull: Cloud → Local ──────────────────────────────────────────────────────
export const runPullSync = async (
    userId: string,
    tableNames: string[],
    signal?: AbortSignal
): Promise<void> => {
    if (isPullActive || isPushActive) return; // Satu per satu, tidak paralel dengan push

    if (typeof navigator !== 'undefined' && navigator.locks) {
        let acquired = false;
        await navigator.locks.request(PULL_LOCK_KEY, { ifAvailable: true }, async (lock) => {
            if (!lock) return;
            acquired = true;
            await _runPullSyncCore(userId, tableNames, signal);
        });
        if (!acquired) {
            console.log('[Sync Pull] 🔒 Lock aktif di tab lain (Web Lock), skip');
        }
    } else {
        // Fallback
        const now = Date.now();
        const raw = localStorage.getItem(PULL_LOCK_KEY);
        if (raw) {
            try {
                const { tabId, timestamp } = JSON.parse(raw);
                if (tabId !== TAB_ID && now - timestamp < LOCK_TTL_MS) {
                    console.log('[Sync Pull] 🔒 Lock aktif di tab lain (Fallback), skip');
                    return;
                }
            } catch { }
        }
        localStorage.setItem(PULL_LOCK_KEY, JSON.stringify({ tabId: TAB_ID, timestamp: now }));

        try {
            await _runPullSyncCore(userId, tableNames, signal);
        } finally {
            localStorage.removeItem(PULL_LOCK_KEY);
        }
    }
};

const _runPullSyncCore = async (
    userId: string,
    tableNames: string[],
    signal?: AbortSignal
): Promise<void> => {
    isPullActive = true;
    pullStartedAt = Date.now();
    notifyState();

    try {
        for (const table of tableNames) {
            if (signal?.aborted) break;

            const config = TABLE_CONFIG[table];
            if (!config) continue;

            refreshLock(PULL_LOCK_KEY);

            const since = getLastSyncAt(table);

            try {
                let query = supabase.from(table).select('*');

                // Filter user
                if (config.hasUserId) {
                    query = query.eq('user_id', userId);
                } else if (table === 'profiles') {
                    query = query.eq('id', userId);
                }

                // Filter timestamp — ambil yang baru atau soft-deleted
                // Gunakan gte (>=) untuk memastikan tidak ada data di milidetik yang sama yang tertinggal
                query = query.gte('updated_at', since);
                query = query.order('updated_at', { ascending: true }).limit(PULL_BATCH);

                const { data, error } = await withTimeout<any>(
                    (signal) => query.abortSignal(signal),
                    REQ_TIMEOUT_MS,
                    signal
                );

                if (error) {
                    const errType = classifyError(error);
                    if (errType === 'auth') {
                        const msg = `Gagal mengambil data ${table} (Izin Ditolak).`;
                        console.warn(`[Sync Pull] 🔐 Auth error pada ${table}:`, msg);
                        toast.error(msg, { id: `pull-error-${table}` });
                        continue;
                    }
                    console.warn(`[Sync Pull] ⚠️ [${table}]:`, error.message);
                    continue;
                }

                if (!data || data.length === 0) continue;

                const store = (db as any)[table];
                if (!store) continue;

                const toUpsert: any[] = [];
                const toDelete: string[] = [];

                for (const remote of data) {
                    const pk = remote[config.pk];
                    if (!pk) continue;

                    // Jangan timpa data yang sedang pending push (local wins)
                    const local = await store.get(pk);
                    if (local?.sync_status === 'pending') continue;

                    // Jika data identik dengan lokal (sudah ada & updated_at sama), skip untuk optimasi
                    if (local && local.updated_at === remote.updated_at && local.sync_status === 'synced') continue;

                    if (config.hasSoftDelete && remote.deleted_at) {
                        toDelete.push(pk);
                    } else {
                        toUpsert.push({ ...remote, sync_status: 'synced' });
                    }
                }

                await db.transaction('rw', store, async () => {
                    if (toDelete.length > 0) await store.bulkDelete(toDelete);
                    if (toUpsert.length > 0) await store.bulkPut(toUpsert);
                });

                // Update watermark ke timestamp record terakhir
                const latest = data[data.length - 1].updated_at;
                if (latest) {
                    setLastSyncAt(table, latest);
                }

                console.log(`[Sync Pull] 📥 [${table}]: +${data.length} (${toDelete.length} deleted, ${toUpsert.length} upserted)`);

            } catch (err: any) {
                if (err.message === 'ABORTED' || err.message === 'TIMEOUT') continue;
                console.error(`[Sync Pull] 🔥 [${table}]:`, err.message);
            }
        }

    } finally {
        isPullActive = false;
        pullStartedAt = 0;
        releaseLock(PULL_LOCK_KEY);
        notifyState();
    }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Tambahkan operasi ke sync queue.
 * Otomatis men-deduplicate: jika sudah ada job pending untuk record yang sama,
 * update payload-nya saja (tidak double-push).
 */
export const addToSyncQueue = async (
    tableName: string,
    operation: 'insert' | 'update' | 'delete',
    recordId: string,
    payload: any
): Promise<void> => {
    if (!TABLE_CONFIG[tableName]) {
        console.warn(`[Sync Queue] ⚠️ Tabel "${tableName}" tidak terdaftar`);
        return;
    }

    try {
        // Cek apakah sudah ada job pending untuk record ini
        const existing = await db.sync_queue
            .where('record_id')
            .equals(recordId)
            .and(j => j.table_name === tableName && j.sync_status === 'pending')
            .first();

        if (existing) {
            // Update payload dan operation (merge)
            const mergedOp = operation === 'delete' ? 'delete' : existing.operation === 'insert' ? 'insert' : 'update';
            await db.sync_queue.update(existing.id!, {
                operation: mergedOp,
                payload: { ...(existing.payload || {}), ...(payload || {}) },
                next_retry_at: undefined,
                retry_count: 0,
                last_error: undefined,
            });
        } else {
            await db.sync_queue.add({
                table_name: tableName,
                operation,
                record_id: recordId,
                payload: payload || {},
                created_at: new Date().toISOString(),
                retry_count: 0,
                sync_status: 'pending',
            });
        }
    } catch (err) {
        console.error('[Sync Queue] ❌ addToSyncQueue error:', err);
    }

    // Trigger push dengan delay kecil (debounce alami)
    if (!isPushActive) {
        setTimeout(() => runPushSync().catch(() => { }), 500);
    }
};

/**
 * Full sync: push dulu, lalu pull.
 *
 * 🔐 Strategi session-aware:
 * - Jika initial sync BELUM selesai di sesi ini → lakukan push + full pull
 *   kemudian tandai selesai (markInitialSyncDone).
 * - Jika initial sync SUDAH selesai → hanya push queue lokal.
 *   Pull dilakukan oleh realtime subscription (useRealtimeSync) saat ada perubahan.
 *
 * Dengan ini: perpindahan halaman TIDAK memicu pull ulang — data sudah ada di IndexedDB.
 */
export const triggerFullSync = async (userId: string, force = false): Promise<void> => {
    // Setelah initial sync selesai: hanya push, skip full pull
    if (hasCompletedInitialSync() && !force) {
        runPushSync().catch(() => { });
        return;
    }

    const now = Date.now();
    if (!force && now - lastFullSyncAt < FULL_SYNC_COOLDOWN_MS) {
        // Masih dalam cooldown: push saja
        runPushSync().catch(() => { });
        return;
    }

    lastFullSyncAt = now;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000); // 2 menit max

    try {
        // Push dulu — kirim data lokal ke cloud
        await runPushSync(false, ctrl.signal);

        // Pull semua tabel (initial sync)
        if (!ctrl.signal.aborted) {
            const tables = Object.keys(TABLE_CONFIG).filter(t => t !== 'profiles' && t !== 'settings');
            await runPullSync(userId, tables, ctrl.signal);
        }

        // Tandai initial sync selesai — sesi ini tidak perlu full pull lagi
        markInitialSyncDone();

    } catch (err: any) {
        if (err.message !== 'ABORTED') {
            console.error('[Sync] 🔥 Full sync error:', err.message);
        }
    } finally {
        clearTimeout(timeout);
    }
};


/**
 * Jadwalkan ulang job yang failed untuk di-retry.
 * Hanya retry error network / rate_limit — validation error (409, 400) TIDAK diretry
 * karena tidak akan pernah berhasil tanpa perbaikan data.
 */
export const retryFailedJobs = async (): Promise<void> => {
    const failed = await db.sync_queue
        .where('sync_status')
        .equals('failed')
        .toArray();

    if (failed.length === 0) return;

    // Hanya retry error yang bersifat transient
    const retryable = failed.filter(j =>
        j.error_type === 'network' || j.error_type === 'rate_limit' || !j.error_type
    );

    if (retryable.length === 0) return;

    for (const job of retryable) {
        await db.sync_queue.update(job.id!, {
            sync_status: 'pending',
            retry_count: 0,
            last_error: undefined,
            next_retry_at: undefined,
            failed_at: undefined,
        });
    }

    console.log(`[Sync] 🔄 ${retryable.length}/${failed.length} failed jobs dijadwalkan ulang (skip validation errors)`);
    runPushSync().catch(() => { });
};

/**
 * Force reset semua state sync (darurat).
 */
export const forceResetSync = (): void => {
    isPushActive = false;
    isPullActive = false;
    pushStartedAt = 0;
    pullStartedAt = 0;
    if (typeof window !== 'undefined') {
        localStorage.removeItem(PUSH_LOCK_KEY);
        localStorage.removeItem(PULL_LOCK_KEY);
    }
    notifyState();
    console.log('[Sync] 🔧 Force reset done');
};

/**
 * Statistik queue untuk diagnostics.
 */
export const getSyncStats = async () => {
    const [pending, failed, total] = await Promise.all([
        db.sync_queue.where('sync_status').equals('pending').count(),
        db.sync_queue.where('sync_status').equals('failed').count(),
        db.sync_queue.count(),
    ]);
    return {
        pending,
        failed,
        total,
        isPushActive,
        isPullActive,
        lastFullSyncAt: new Date(lastFullSyncAt).toISOString(),
    };
};

// ─── Legacy Compatibility ─────────────────────────────────────────────────────
export const runSync = runPushSync;

/** @deprecated — gunakan retryFailedJobs() */
export const retrySyncErrors = async (_userId?: string): Promise<void> => {
    return retryFailedJobs();
};

/**
 * @deprecated — dipertahankan untuk backward compat dengan file syncXxx.ts lama.
 * Sebaiknya gunakan runPullSync() langsung.
 */
export const queryWithTimestampFallback = async (
    table: string,
    userId: string,
    since: string
): Promise<{ data: any[] | null; error: any }> => {
    const config = TABLE_CONFIG[table];
    if (!config) return { data: null, error: new Error(`Table "${table}" not in config`) };

    let query = supabase.from(table).select('*');
    if (config.hasUserId) {
        query = query.eq('user_id', userId);
    } else {
        query = query.eq('id', userId);
    }
    query = query
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .limit(PULL_BATCH);

    return query as unknown as Promise<{ data: any[] | null; error: any }>;
};

// ─── Debug Window Object ──────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
    (window as any).kasirhubSync = {
        forceResetSync,
        retryFailedJobs,
        triggerFullSync,
        getSyncStats,
        getQueueStats: getSyncStats, // alias lama
    };
}