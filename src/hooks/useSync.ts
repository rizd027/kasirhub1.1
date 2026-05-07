'use client';

import { useEffect } from 'react';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

let isSyncInProgress = false;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const safeParse = (value: string | null, fallback: any = null) => {
  if (!value || value === 'undefined' || value === 'null') return fallback;
  try {
    return JSON.parse(value) || fallback;
  } catch (e) {
    return fallback;
  }
};

const syncProfile = async (userId: string) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (!error && profile) {
      localStorage.setItem('kasirhub_user_profile', JSON.stringify(profile));
    } else if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it if we have auth user metadata
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const newProfile = {
          id: userId,
          full_name: session.user.user_metadata?.full_name || 'Administrator',
          role: 'admin',
          updated_at: new Date().toISOString()
        };
        await supabase.from('profiles').upsert(newProfile);
        localStorage.setItem('kasirhub_user_profile', JSON.stringify(newProfile));
      }
    }
  } catch (err) {
    console.error('Profile sync failed:', err);
  }
};

const syncSettings = async (userId: string) => {
  try {
    // 1. Get current local settings (from localStorage as primary source for now)
    const localToko = localStorage.getItem('toko_info');
    const localPin = localStorage.getItem('kasirhub_app_password');
    const localPrefs = localStorage.getItem('kasirhub_prefs');

    // 2. Fetch remote settings
    const { data: remoteSettings, error: fetchError } = await supabase
      .from('settings')
      .select('user_id, toko_info, pin_code, preferences, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching remote settings:', fetchError);
    }

    // 3. Logic: 
    // - If it's a new device (all local settings empty) and remote has data, download.
    // - Otherwise, treat local as source of truth and upload.
    const isNewDevice = !localToko && !localPin && !localPrefs;

    if (isNewDevice && remoteSettings) {
      if (remoteSettings.toko_info) localStorage.setItem('toko_info', JSON.stringify(remoteSettings.toko_info));
      if (remoteSettings.pin_code) localStorage.setItem('kasirhub_app_password', remoteSettings.pin_code);
      if (remoteSettings.preferences) localStorage.setItem('kasirhub_prefs', JSON.stringify(remoteSettings.preferences));
    } else {
      // Upload local state (even if null, to allow deletion)
      await supabase.from('settings').upsert({
        user_id: userId,
        toko_info: safeParse(localToko, remoteSettings?.toko_info || {}),
        pin_code: localPin, // source of truth for active session
        preferences: safeParse(localPrefs, remoteSettings?.preferences || {}),
        updated_at: new Date().toISOString()
      });
    }

    // Update Dexie as a secondary persistent backup
    await db.settings.bulkPut([
      { key: 'toko_info', value: safeParse(localToko, remoteSettings?.toko_info || {}) },
      { key: 'pin_code', value: localPin || (remoteSettings?.pin_code || null) },
      { key: 'preferences', value: safeParse(localPrefs, remoteSettings?.preferences || {}) }
    ]);

  } catch (err) {
    console.error('Settings sync failed:', err);
  }
};

const syncCategories = async (userId: string) => {
  // 1. Fetch Remote Categories
  const { data: remoteCategories, error: remoteError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (remoteError) {
    console.error('Error fetching remote categories:', remoteError);
    return new Map<string, string>();
  }

  const localCategories = await db.categories.toArray();
  const remoteByName = new Map((remoteCategories ?? []).map((c) => [c.name.toLowerCase(), c.id]));
  const localByName = new Map(localCategories.map(c => [c.name.toLowerCase(), c.id]));

  // 2. Download missing categories from remote to local
  for (const remoteCat of remoteCategories || []) {
    if (!localByName.has(remoteCat.name.toLowerCase())) {
      await db.categories.add({
        id: crypto.randomUUID(), // Local ID
        name: remoteCat.name,
      });
    }
  }

  // Refresh local list after downloads
  const updatedLocalCategories = await db.categories.toArray();
  const categoryMap = new Map<string, string>();

  // 3. Upload missing categories from local to remote
  for (const localCat of updatedLocalCategories) {
    if (!localCat?.name) continue;
    let remoteId = remoteByName.get(localCat.name.toLowerCase());

    if (!remoteId) {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert({ name: localCat.name, user_id: userId })
        .select('id, name')
        .single();

      if (!error && inserted) {
        remoteId = inserted.id;
        remoteByName.set(inserted.name.toLowerCase(), inserted.id);
      } else if (error) {
        console.error(`Error inserting category ${localCat.name}:`, error.message);
      }
    }

    if (remoteId) {
      categoryMap.set(localCat.id, remoteId);
    }
  }

  localStorage.setItem(`kasirhub_category_id_map_${userId}`, JSON.stringify(Object.fromEntries(categoryMap)));
  return categoryMap;
};

const ensureCloudinaryUrl = async (value: string | null) => {
  if (!value || !value.startsWith('data:image')) return value;
  try {
    const res = await fetch(value);
    const blob = await res.blob();
    const file = new File([blob], `sync_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const { uploadImage } = await import('@/services/cloudinary');
    return await uploadImage(file);
  } catch (err) {
    console.error('Failed to upload base64 to Cloudinary during sync:', err);
    return value; // fallback to base64, better than nothing or null
  }
};

const syncProducts = async (userId: string, categoryMap: Map<string, string>) => {
  // 1. Fetch Remote Products
  const { data: remoteProducts, error: remoteError } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (remoteError) {
    console.error('Error fetching remote products:', remoteError);
    return;
  }

  // 1.5 Get list of products with unsynced changes to prevent overwriting stock
  const unsyncedMutations = await db.stock_mutations.where('synced').equals(0).toArray();
  const unsyncedTransactions = await db.transactions.where('synced').equals(0).toArray();
  const dirtyProductIds = new Set([
    ...unsyncedMutations.map(m => m.product_id),
    ...unsyncedTransactions.flatMap(tx => tx.items.map(item => item.id))
  ]);

  const localProducts = await db.products.toArray();
  const remoteBySku = new Map((remoteProducts ?? []).map(p => [p.sku, p]));
  const localBySku = new Map(localProducts.map(p => [p.sku, p]));

  // 2. Sync Remote to Local (Download/Update)
  for (const remoteProd of remoteProducts || []) {
    const localProd = localBySku.get(remoteProd.sku);
    
    // Reverse map remote category UUID back to local ID
    let localCategoryId = '';
    if (remoteProd.category_id) {
       for (const [lId, rId] of categoryMap.entries()) {
         if (rId === remoteProd.category_id) {
           localCategoryId = lId;
           break;
         }
       }
    }

    const productData: any = {
      sku: remoteProd.sku,
      name: remoteProd.name,
      price_sell: Number(remoteProd.price_sell),
      price_cost: Number(remoteProd.price_cost),
      image_url: remoteProd.image_url,
      category_id: localCategoryId,
      deleted_at: remoteProd.deleted_at || undefined,
    };

    // Only update stock if local is NOT dirty
    if (localProd && !dirtyProductIds.has(localProd.id)) {
      productData.stock_store = remoteProd.stock_store;
      productData.stock_warehouse = remoteProd.stock_warehouse;
    }

    if (!localProd) {
      // New product from remote
      await db.products.add({
        id: crypto.randomUUID(),
        ...productData,
        stock_store: remoteProd.stock_store,
        stock_warehouse: remoteProd.stock_warehouse,
      });
    } else {
      // Update existing local product if needed (Simple merge: remote wins)
      await db.products.update(localProd.id, productData);
    }
  }

  // 3. Sync Local to Remote (Upload)
  const finalLocalProducts = await db.products.toArray();
  const productPayloads = await Promise.all(finalLocalProducts
    .filter(p => p.sku && p.name && !p.deleted_at)
    .map(async p => ({
      user_id: userId,
      sku: p.sku,
      name: p.name,
      category_id: categoryMap.get(p.category_id) ?? null,
      price_cost: Number(p.price_cost || 0),
      price_sell: Number(p.price_sell || 0),
      image_url: await ensureCloudinaryUrl(p.image_url || null),
      stock_store: Number(p.stock_store || 0),
      stock_warehouse: Number(p.stock_warehouse || 0),
      deleted_at: p.deleted_at || null
    })));

  if (productPayloads.length > 0) {
    const { data: upsertedProducts, error: prodError } = await supabase
      .from('products')
      .upsert(productPayloads, { onConflict: 'user_id,sku' })
      .select('id, sku');

    if (!prodError && upsertedProducts) {
      const productIdMap: Record<string, string> = {};
      const updatedRemoteBySku = new Map(upsertedProducts.map(p => [p.sku, p.id]));

      for (const lp of finalLocalProducts) {
        const remoteId = updatedRemoteBySku.get(lp.sku);
        if (remoteId) productIdMap[lp.id] = remoteId;
      }

      localStorage.setItem(`kasirhub_product_id_map_${userId}`, JSON.stringify(productIdMap));
    }

    if (prodError) {
      console.error('Products upload error:', prodError.message);
    }
  }
};

const syncStockMutations = async (userId: string) => {
  try {
    const unsynced = await db.stock_mutations.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    const productIdMapRaw = localStorage.getItem(`kasirhub_product_id_map_${userId}`);
    const productIdMap: Record<string, string> = safeParse(productIdMapRaw, {});

    console.log(`Syncing ${unsynced.length} stock mutations...`);
    const payloads = unsynced.map(m => ({
      user_id: userId,
      product_id: isUuid(productIdMap[m.product_id]) ? productIdMap[m.product_id] : null,
      type: m.type,
      from_location: m.from_location || null,
      to_location: m.to_location || null,
      qty: m.qty,
      note: m.note || null,
      created_at: m.created_at
    }));

    const { data, error } = await supabase.from('stock_mutations').insert(payloads).select('id');
    if (!error && data) {
      for (let i = 0; i < unsynced.length; i++) {
        await db.stock_mutations.update(unsynced[i].id!, { 
          synced: 1, 
          remote_id: data[i]?.id 
        });
      }
    } else if (error) {
      console.error('Stock mutations sync error:', error);
    }
  } catch (err) {
    console.error('syncStockMutations failed:', err);
  }
};

const syncDownTransactions = async (userId: string) => {
  try {
    const { data: remoteTxs, error } = await supabase
      .from('transactions')
      .select('*, transaction_items(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !remoteTxs) return;

    const localRemoteIds = new Set(
      (await db.transactions.where('remote_id').notEqual('').toArray()).map(t => t.remote_id)
    );

    const productIdMapRaw = localStorage.getItem(`kasirhub_product_id_map_${userId}`);
    const productIdMapParsed = safeParse(productIdMapRaw, {});
    const remoteIdToLocalId: Record<string, string> = Object.fromEntries(
      Object.entries(productIdMapParsed).map(([l, r]) => [r as string, l as string])
    );

    const newTxs = remoteTxs.filter(rt => !localRemoteIds.has(rt.id));
    if (newTxs.length === 0) return;

    console.log(`Downloading ${newTxs.length} remote transactions...`);
    for (const rt of newTxs) {
      const items = rt.transaction_items.map((ri: any) => ({
        id: remoteIdToLocalId[ri.product_id] || ri.product_id, // Map back to local ID if possible
        name: ri.name_at_time,
        price: ri.price_at_time,
        quantity: ri.quantity
      }));

      const localTx = await db.transactions.where('remote_id').equals(rt.id).first();
      
      if (rt.deleted_at) {
        if (localTx && !localTx.deleted_at) {
          await db.transactions.update(localTx.id!, { deleted_at: rt.deleted_at });
        }
        continue;
      }

      if (!localTx) {
        await db.transactions.add({
          remote_id: rt.id,
          total_amount: rt.total_amount,
          subtotal: rt.subtotal,
          tax_amount: rt.tax_amount,
          service_charge_amount: rt.service_charge_amount,
          discount_total: rt.discount_total,
          payment_method: rt.payment_method,
          status: rt.status,
          items: items,
          customer_name: rt.customer_name,
          employee_id: rt.employee_id,
          cashier_name: rt.cashier_name,
          created_at: rt.created_at,
          synced: 1
        });
      } else {
        // Optional: Update local if remote is newer? 
        // For now, if it exists locally and remote is NOT deleted, we keep it as is.
      }
    }
  } catch (err) {
    console.error('syncDownTransactions failed:', err);
  }
};

const syncDownStockMutations = async (userId: string) => {
  try {
    const { data: remoteMutations, error } = await supabase
      .from('stock_mutations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !remoteMutations) return;

    const localRemoteIds = new Set(
      (await db.stock_mutations.where('remote_id').notEqual('').toArray()).map(m => m.remote_id)
    );

    const productIdMapRaw = localStorage.getItem(`kasirhub_product_id_map_${userId}`);
    const productIdMapParsed = safeParse(productIdMapRaw, {});
    const remoteIdToLocalId: Record<string, string> = Object.fromEntries(
      Object.entries(productIdMapParsed).map(([l, r]) => [r as string, l as string])
    );

    const newMutations = remoteMutations.filter(rm => !localRemoteIds.has(rm.id));
    if (newMutations.length === 0) return;

    console.log(`Downloading ${newMutations.length} remote stock mutations...`);
    for (const rm of newMutations) {
      const localProductId = remoteIdToLocalId[rm.product_id];
      if (!localProductId) continue; // Skip if product doesn't exist locally

      await db.stock_mutations.add({
        remote_id: rm.id,
        product_id: localProductId,
        type: rm.type,
        from_location: rm.from_location,
        to_location: rm.to_location,
        qty: rm.qty,
        note: rm.note,
        created_at: rm.created_at,
        synced: 1
      });
    }
  } catch (err) {
    console.error('syncDownStockMutations failed:', err);
  }
};

const syncAttendance = async (userId: string) => {
  try {
    const unsynced = await db.attendance.where('synced').equals(0).toArray();
    if (unsynced.length === 0) return;

    console.log(`Syncing ${unsynced.length} attendance records...`);
    const payloads = await Promise.all(unsynced.map(async a => ({
      user_id: userId, // owner id
      employee_id: a.employee_id,
      type: a.type,
      photo_url: await ensureCloudinaryUrl(a.photo_url),
      note: a.note || null,
      created_at: a.created_at
    })));

    const { data, error } = await supabase.from('attendance').insert(payloads).select('id');
    if (!error && data) {
      for (let i = 0; i < unsynced.length; i++) {
        await db.attendance.update(unsynced[i].id!, { 
          synced: 1, 
          remote_id: data[i]?.id 
        });
      }
    } else if (error) {
      console.error('Attendance sync error:', error);
    }
  } catch (err) {
    console.error('syncAttendance failed:', err);
  }
};

const syncDownAttendance = async (userId: string) => {
  try {
    const { data: remoteAttendance, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !remoteAttendance) return;

    const localRemoteIds = new Set(
      (await db.attendance.where('remote_id').notEqual('').toArray()).map(a => a.remote_id)
    );

    const newRecords = remoteAttendance.filter(ra => !localRemoteIds.has(ra.id));
    if (newRecords.length === 0) return;

    console.log(`Downloading ${newRecords.length} remote attendance records...`);
    for (const ra of newRecords) {
      await db.attendance.add({
        remote_id: ra.id,
        employee_id: ra.employee_id,
        type: ra.type,
        photo_url: ra.photo_url,
        note: ra.note,
        created_at: ra.created_at,
        synced: 1
      });
    }
  } catch (err) {
    console.error('syncDownAttendance failed:', err);
  }
};
const backfillLocalDataForLinkedAccount = async (userId: string, force = false) => {
  const backfillKey = `kasirhub_backfill_done_${userId}`;
  const lastFullSyncKey = `kasirhub_last_full_sync_${userId}`;
  
  // Try to restore categoryMap from localStorage if not forcing full sync
  const categoryIdMapRaw = localStorage.getItem(`kasirhub_category_id_map_${userId}`);
  const categoryIdMapParsed = safeParse(categoryIdMapRaw, {});
  let categoryMap: Map<string, string> = new Map(Object.entries(categoryIdMapParsed));

  const lastSync = localStorage.getItem(lastFullSyncKey);
  const now = Date.now();
  
  // Only sync categories/products every 5 minutes unless forced
  if (!force && lastSync && (now - parseInt(lastSync)) < 5 * 60 * 1000) {
    return categoryMap;
  }

  try {
    categoryMap = await syncCategories(userId);
    await syncProducts(userId, categoryMap);
    localStorage.setItem(backfillKey, '1');
    localStorage.setItem(lastFullSyncKey, now.toString());
    return categoryMap;
  } catch (error) {
    console.error('Sync categories/products failed:', error);
    throw error;
  }
};

export const triggerSync = async (force = false) => {
  if (isSyncInProgress && !force) return;

  // Safety: Ensure we don't hang if Capacitor plugin is unresponsive
  const networkStatus = await Promise.race([
    Network.getStatus(),
    new Promise<{ connected: boolean }>((_, reject) => setTimeout(() => reject(new Error('Network plugin timeout')), 2000))
  ]).catch(() => ({ connected: navigator.onLine }));

  if (!networkStatus.connected) {
    if (force) throw new Error('Tidak ada koneksi internet');
    return;
  }

  isSyncInProgress = true;
  const timeoutId = setTimeout(() => { isSyncInProgress = false; }, 60000);

  try {
    console.log('Syncing starting...');
    let { data: { user }, error: authError } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 5000))
    ]).catch(err => ({ data: { user: null }, error: err }));
    
    // If auth error (expired token) but we have a session in store, try refreshing
    if (authError || !user) {
      console.log('Session stale, attempting refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.user) {
        isSyncInProgress = false;
        if (force) throw new Error('Sesi berakhir. Silakan login kembali.');
        return;
      }
      user = refreshData.user;
    }

    // 1. Bi-directional Sync for Products/Categories - DO THIS FIRST to get latest IDs
    const categoryMap = await backfillLocalDataForLinkedAccount(user.id, force);

    // 2. Transactions (Local -> Remote Only)
    const productIdMapRaw = localStorage.getItem(`kasirhub_product_id_map_${user.id}`);
    const productIdMap: Record<string, string> = safeParse(productIdMapRaw, {});

    const unsynced = await db.transactions.where('synced').equals(0).toArray();

    if (unsynced.length > 0) {
      console.log(`Syncing ${unsynced.length} transactions...`);
      for (const tx of unsynced) {
        try {
          // 1. Insert Transaction
          const { data: remoteTx, error: txError } = await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              employee_id: tx.employee_id || null, // TRACK THE KASIR
              total_amount: tx.total_amount,
              subtotal: tx.subtotal,
              tax_amount: tx.tax_amount,
              service_charge_amount: tx.service_charge_amount,
              discount_total: tx.discount_total,
              payment_method: tx.payment_method,
              status: tx.status,
              customer_name: tx.customer_name || null,
              created_at: tx.created_at,
              deleted_at: tx.deleted_at || null
            })
            .select('id')
            .single();

          if (txError) throw txError;

          // 3. Upload Items
          if (tx.items && tx.items.length > 0) {
            const itemsToInsert = tx.items.map(item => ({
              transaction_id: remoteTx.id,
              product_id: isUuid(productIdMap[item.id]) ? productIdMap[item.id] : null,
              quantity: item.quantity,
              price_at_time: item.price,
              name_at_time: item.name
            }));

            const { error: itemsError } = await supabase
              .from('transaction_items')
              .insert(itemsToInsert);
            if (itemsError) throw itemsError;
          }

          // 4. Mark as synced locally
          await db.transactions.update(tx.id!, { 
            synced: 1, 
            remote_id: remoteTx.id 
          });
        } catch (err: any) {
          console.error('Failed to sync transaction:', err.message || err);
        }
      }
    }
    
    // 2.5 Download Transactions (Bi-directional)
    await syncDownTransactions(user.id);
    
    // 3. Stock Mutations (Bi-directional)
    await syncStockMutations(user.id);
    await syncDownStockMutations(user.id);

    // 4. Attendance (Bi-directional)
    await syncAttendance(user.id);
    await syncDownAttendance(user.id);

    // 5. Settings & Profile
    await syncSettings(user.id);
    await syncProfile(user.id);

    localStorage.setItem('kasirhub_last_sync', new Date().toISOString());
    isSyncInProgress = false;
    return true;
  } catch (err) {
    isSyncInProgress = false;
    console.error('Global sync error:', err);
    throw err;
  }
};

export function useSync() {
  useEffect(() => {
    const doSync = () => triggerSync().catch(err => {
      console.error('Auto sync failed:', err);
    });

    // Initial sync
    doSync();

    // 1. Reliable Network Listeners (Capacitor)
    const netListener = Network.addListener('networkStatusChange', (status) => {
      if (status.connected) {
        console.log('Network: Connected, triggering sync...');
        doSync();
      }
    });

    // 2. App Resume Listener (Capacitor)
    // Very important: Re-sync when user comes back to the app
    const appListener = App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        console.log('App: Resumed, triggering sync...');
        // Small delay to ensure bridge is ready and prevent WSOD
        setTimeout(() => {
          doSync();
        }, 300);
      }
    });

    // 3. Fallback for Web browser
    window.addEventListener('online', doSync);

    // 4. Background Sync Heartbeat (Every 5 minutes)
    const heartbeat = setInterval(() => {
      console.log('Heartbeat: Checking sync status...');
      doSync();
    }, 5 * 60 * 1000);

    // 5. Realtime Subscriptions
    const channelId = `sync-changes-${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId);
    
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          console.log('Realtime: Product changed, syncing...');
          doSync();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          console.log('Realtime: Category changed, syncing...');
          doSync();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime: Subscribed to changes');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Retry subscription if it drops
          setTimeout(() => channel.subscribe(), 5000);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        doSync();
      }
    });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener('online', doSync);
      clearInterval(heartbeat);
      netListener.then(h => h.remove());
      appListener.then(h => h.remove());
    };
  }, []);
}
