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
  const localCategories = await db.categories.toArray();
  if (localCategories.length === 0) return new Map<string, string>();

  const { data: remoteCategories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId);

  const remoteByName = new Map((remoteCategories ?? []).map((c) => [c.name, c.id]));
  const categoryMap = new Map<string, string>();

  for (const cat of localCategories) {
    if (!cat?.name) continue;
    let remoteId = remoteByName.get(cat.name);

    if (!remoteId) {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert({ name: cat.name, user_id: userId })
        .select('id, name')
        .single();

      if (!error && inserted) {
        remoteId = inserted.id;
        remoteByName.set(inserted.name, inserted.id);
      }
      if (error) {
        const errorMsg = error.message || JSON.stringify(error);
        console.error(`Error inserting category ${cat.name}:`, errorMsg);
        throw new Error(`Category Sync Error: ${errorMsg}`);
      }
    }

    if (remoteId && cat.id) {
      categoryMap.set(cat.id, remoteId);
    }
  }
  return categoryMap;
};

const syncProducts = async (userId: string, categoryMap: Map<string, string>) => {
  const localProducts = await db.products.toArray();
  if (localProducts.length === 0) return;

  const productPayloads = localProducts
    .filter(p => p.sku && p.name)
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
      deleted_at: p.deleted_at || null
    }));

  const { data: upsertedProducts, error: prodError } = await supabase
    .from('products')
    .upsert(productPayloads, { onConflict: 'user_id,sku' })
    .select('id, sku');

  if (!prodError && upsertedProducts) {
    const productIdMap: Record<string, string> = {};
    const remoteBySku = new Map(upsertedProducts.map(p => [p.sku, p.id]));

    for (const lp of localProducts) {
      const remoteId = remoteBySku.get(lp.sku);
      if (remoteId) productIdMap[lp.id] = remoteId;
    }

    localStorage.setItem(`kasirhub_product_id_map_${userId}`, JSON.stringify(productIdMap));
  }

  if (prodError) {
    const errorMsg = prodError.message || JSON.stringify(prodError);
    console.error('Products sync error:', errorMsg, prodError.details);
    throw new Error(`Product Sync Error: ${errorMsg}`);
  }
};

const backfillLocalDataForLinkedAccount = async (userId: string, force = false) => {
  const backfillKey = `kasirhub_backfill_done_${userId}`;
  if (!force && localStorage.getItem(backfillKey) === '1') {
    // Even if backfill is done, we still want to sync NEW data
    const catMap = await syncCategories(userId);
    await syncProducts(userId, catMap);
    return;
  }

  try {
    const categoryMap = await syncCategories(userId);
    await syncProducts(userId, categoryMap);
    localStorage.setItem(backfillKey, '1');
  } catch (error) {
    console.error('Initial local backfill failed:', error);
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
    if (force) throw new Error('User not logged in');
    return; // Silent return for auto-syncs
  }

  // Force backfill on explicit sync or first-time login
  await backfillLocalDataForLinkedAccount(user.id, force);
  await syncSettings(user.id);
  await syncProfile(user.id);

  const productIdMapRaw = localStorage.getItem(`kasirhub_product_id_map_${user.id}`);
  const productIdMap: Record<string, string> = productIdMapRaw ? JSON.parse(productIdMapRaw) : {};

  // Sync unsynced transactions
  const unsynced = await db.transactions.where('synced').equals(0).toArray();

  if (unsynced.length === 0) {
    localStorage.setItem('kasirhub_last_sync', new Date().toISOString());
    return true; // Success, nothing to sync
  }

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

      // Insert items (map local product id to remote uuid when available)
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

      // Mark as synced
      await db.transactions.update(tx.id!, { synced: 1 });
    } catch (err: any) {
      console.error('Failed to sync transaction:', err.message || err);
      throw err;
    }
  }

  // Finalize sync success
  localStorage.setItem('kasirhub_last_sync', new Date().toISOString());
  isSyncInProgress = false;
  return true;
} catch (err) {
  isSyncInProgress = false;
  throw err;
}
};

export function useSync() {
  useEffect(() => {
    const doSync = () => triggerSync().catch(console.error);

    window.addEventListener('online', doSync);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        doSync();
      }
    });
    // Initial sync
    doSync();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', doSync);
    };
  }, []);
}
