'use client';

import { useEffect } from 'react';
import { db } from '@/lib/dexie';
import { supabase } from '@/lib/supabase';

let isSyncInProgress = false;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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

    // 3. Logic: If local exists, it's usually newer or the source of truth for the session
    // If remote exists and local is empty (new device), download remote.

    if (!localToko && remoteSettings?.toko_info) {
      localStorage.setItem('toko_info', JSON.stringify(remoteSettings.toko_info));
    }
    if (!localPin && remoteSettings?.pin_code) {
      localStorage.setItem('kasirhub_app_password', remoteSettings.pin_code);
    }
    if (!localPrefs && remoteSettings?.preferences) {
      localStorage.setItem('kasirhub_prefs', JSON.stringify(remoteSettings.preferences));
    }

    // 4. Always upload current local state to Supabase if anything exists
    if (localToko || localPin || localPrefs) {
      await supabase.from('settings').upsert({
        user_id: userId,
        toko_info: localToko ? JSON.parse(localToko) : (remoteSettings?.toko_info || {}),
        pin_code: localPin || (remoteSettings?.pin_code || null),
        preferences: localPrefs ? JSON.parse(localPrefs) : (remoteSettings?.preferences || {}),
        updated_at: new Date().toISOString()
      });
    }

    // Update Dexie as a secondary persistent backup
    await db.settings.bulkPut([
      { key: 'toko_info', value: localToko ? JSON.parse(localToko) : (remoteSettings?.toko_info || {}) },
      { key: 'pin_code', value: localPin || (remoteSettings?.pin_code || null) },
      { key: 'preferences', value: localPrefs ? JSON.parse(localPrefs) : (remoteSettings?.preferences || {}) }
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

  return categoryMap;
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

    const productData = {
      sku: remoteProd.sku,
      name: remoteProd.name,
      price_sell: Number(remoteProd.price_sell),
      price_cost: Number(remoteProd.price_cost),
      image_url: remoteProd.image_url,
      category_id: localCategoryId,
      stock_store: remoteProd.stock_store,
      stock_warehouse: remoteProd.stock_warehouse,
    };

    if (!localProd) {
      // New product from remote
      await db.products.add({
        id: crypto.randomUUID(),
        ...productData
      });
    } else {
      // Update existing local product if needed (Simple merge: remote wins)
      await db.products.update(localProd.id, productData);
    }
  }

  // 3. Sync Local to Remote (Upload)
  const finalLocalProducts = await db.products.toArray();
  const productPayloads = finalLocalProducts
    .filter(p => p.sku && p.name && !p.deleted_at)
    .map(p => ({
      user_id: userId,
      sku: p.sku,
      name: p.name,
      category_id: categoryMap.get(p.category_id) ?? null,
      price_cost: Number(p.price_cost || 0),
      price_sell: Number(p.price_sell || 0),
      image_url: p.image_url || null,
      stock_store: Number(p.stock_store || 0),
      stock_warehouse: Number(p.stock_warehouse || 0),
      deleted_at: null
    }));

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

const backfillLocalDataForLinkedAccount = async (userId: string, force = false) => {
  const backfillKey = `kasirhub_backfill_done_${userId}`;
  
  // Bidirectional sync always for consistency
  try {
    const categoryMap = await syncCategories(userId);
    await syncProducts(userId, categoryMap);
    localStorage.setItem(backfillKey, '1');
  } catch (error) {
    console.error('Sync categories/products failed:', error);
    throw error;
  }
};

export const triggerSync = async (force = false) => {
  if (isSyncInProgress) return;
  
  if (!navigator.onLine) {
    if (force) throw new Error('Device is offline');
    return;
  }

  isSyncInProgress = true;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      isSyncInProgress = false;
      if (force) throw new Error('User not logged in');
      return; 
    }

    // 1. Bi-directional Sync for Products/Categories
    await backfillLocalDataForLinkedAccount(user.id, force);
    
    // 2. Settings & Profile
    await syncSettings(user.id);
    await syncProfile(user.id);

    // 3. Transactions (Local -> Remote Only)
    const productIdMapRaw = localStorage.getItem(`kasirhub_product_id_map_${user.id}`);
    const productIdMap: Record<string, string> = productIdMapRaw ? JSON.parse(productIdMapRaw) : {};

    const unsynced = await db.transactions.where('synced').equals(0).toArray();

    if (unsynced.length > 0) {
      for (const tx of unsynced) {
        try {
          const { data, error } = await supabase
            .from('transactions')
            .insert({
              user_id: user.id,
              total_amount: tx.total_amount,
              subtotal: tx.subtotal,
              tax_amount: tx.tax_amount,
              service_charge_amount: tx.service_charge_amount,
              discount_total: tx.discount_total,
              payment_method: tx.payment_method,
              status: tx.status,
              customer_name: tx.customer_name || null,
              created_at: tx.created_at
            })
            .select()
            .single();

          if (error) throw error;

          const itemsToInsert = tx.items.map(item => ({
            transaction_id: data.id,
            product_id: isUuid(productIdMap[item.id]) ? productIdMap[item.id] : null,
            quantity: item.quantity,
            price_at_time: item.price,
            discount_details: {
              disc1: item.disc1,
              disc2: item.disc2,
              nominal: item.nominalDisc
            }
          }));

          const { error: itemsError } = await supabase
            .from('transaction_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;

          await db.transactions.update(tx.id!, { synced: 1 });
        } catch (err: any) {
          console.error('Failed to sync transaction:', err.message || err);
        }
      }
    }

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
    const doSync = () => triggerSync().catch(console.error);

    // Initial sync
    doSync();

    // Listen to network status
    window.addEventListener('online', doSync);

    // Realtime Subscriptions
    const channel = supabase
      .channel('schema-db-changes')
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
      .subscribe();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        doSync();
      }
    });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener('online', doSync);
    };
  }, []);
}
