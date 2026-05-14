import { supabase } from '@/services/supabase';
import { db } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { useCartStore } from '@/store/useCartStore';

export async function clearAllLocalData() {
    try {
        await supabase.auth.signOut();

        const tables = db.tables;
        await Promise.all(tables.map(table => table.clear()));

        useStaffStore.getState().logout();
        useCartStore.getState().clearCart();
        useCartStore.setState({ holdOrders: [], items: [], customerName: '', orderDiscount: { type: 'percent', value: 0 } });

        localStorage.clear();
        sessionStorage.clear();

    } catch (error) {
        console.error('Error during clearing data:', error);
    }
}
