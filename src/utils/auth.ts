import { supabase } from '@/services/supabase';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { useCartStore } from '@/store/useCartStore';

export async function clearAllLocalData() {
    try {
        // 1. Sign out from Supabase
        await supabase.auth.signOut();

        // 2. Clear IndexedDB (Dexie)
        // We use clear() on each table to keep the schema intact
        const tables = db.tables;
        await Promise.all(tables.map(table => table.clear()));

        // 3. Reset Zustand Stores
        // Since they are persisted, we should clear the specific keys or reset them
        useStaffStore.getState().logout();
        useCartStore.getState().clearCart();
        // Additional reset for cart if needed (holdOrders)
        useCartStore.setState({ holdOrders: [], items: [], customerName: '', orderDiscount: { type: 'percent', value: 0 } });

        // 4. Clear LocalStorage and SessionStorage
        localStorage.clear();
        sessionStorage.clear();

    } catch (error) {
        console.error('Error during clearing data:', error);
    }
}
