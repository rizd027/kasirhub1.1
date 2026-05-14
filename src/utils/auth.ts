import { supabase } from '@/services/supabase';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { useCartStore } from '@/store/useCartStore';

export async function clearAllLocalData() {
    console.log('[Auth] 🧹 Starting complete local data cleanup...');
    
    try {
        // 1. Sign out from Supabase (Non-blocking with timeout to prevent hanging)
        const signOutPromise = supabase.auth.signOut().catch(err => {
            console.warn('[Auth] ⚠️ Supabase sign out failed, but continuing with local cleanup:', err);
        });

        // We wrap it in a timeout because sometimes GoTrue locks up
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
        await Promise.race([signOutPromise, timeoutPromise]);

        // 2. Reset Zustand Stores IMMEDIATELY (Crucial for UI response)
        try {
            useStaffStore.getState().logout();
            useCartStore.getState().clearCart();
            useCartStore.setState({ holdOrders: [], items: [], customerName: '', orderDiscount: { type: 'percent', value: 0 } });
            console.log('[Auth] ✅ Zustand stores reset');
        } catch (e) {
            console.error('[Auth] ❌ Failed to reset Zustand stores:', e);
        }

        // 3. Clear IndexedDB (Dexie)
        try {
            const tables = db.tables;
            await Promise.all(tables.map(table => table.clear().catch(e => console.warn(`Failed to clear table ${table.name}`, e))));
            console.log('[Auth] ✅ IndexedDB cleared');
        } catch (e) {
            console.error('[Auth] ❌ Failed to clear IndexedDB:', e);
        }

        // 4. Clear LocalStorage and SessionStorage
        localStorage.clear();
        sessionStorage.clear();
        console.log('[Auth] ✅ Browser storage cleared');

    } catch (error) {
        console.error('[Auth] ❌ Critical error during cleanup:', error);
        // Fallback: Force clear storage at minimum
        localStorage.clear();
        sessionStorage.clear();
    }
}
