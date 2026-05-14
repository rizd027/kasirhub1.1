import { db } from '@/db/dexie';
import { createId } from '@/utils/uuid';
import { runSync, addToSyncQueue } from '@/services/sync/syncManager';
import { useCartStore } from '@/store/useCartStore';
import { useStaffStore } from '@/store/useStaffStore';

export const useCheckout = () => {
    const { items, getTotal, getSubtotal, getOrderDiscountAmount, clearCart } = useCartStore();
    const { session } = useStaffStore();

    const checkout = async (method: 'cash' | 'tempo' | 'qris' | 'transfer', customerNameOverride?: string) => {
        if (!session?.id) {
            console.error('No active session for checkout');
            return null;
        }

        const transactionId = createId();
        const now = new Date().toISOString();
        const totalAmount = getTotal();
        const subtotal = getSubtotal();
        const discountTotal = getOrderDiscountAmount();
        const userId = session.role === 'admin' ? session.id : session.owner_id || session.id; 
        // Note: userId should be the admin/store owner ID. 
        // If staff is logged in, we need the admin's ID. 
        // Let's assume session has the correct context.

        try {
            const transaction = {
                id: transactionId,
                user_id: userId,
                employee_id: session.role === 'staff' ? session.id : undefined,
                total_amount: totalAmount,
                subtotal: subtotal,
                tax_amount: 0, 
                service_charge_amount: 0, 
                discount_total: discountTotal,
                payment_method: method,
                status: (method === 'tempo' ? 'unpaid' : 'paid') as 'paid' | 'unpaid',
                customer_name: customerNameOverride,
                created_at: now,
                updated_at: now,
                deleted_at: null,
                sync_status: 'pending' as const,
                items: items.map(i => ({
                    id: createId(),
                    transaction_id: transactionId,
                    product_id: i.id,
                    quantity: i.quantity,
                    price_at_time: i.price,
                    cost_at_time: i.cost,
                    name_at_time: i.name,
                    user_id: userId,
                    created_at: now,
                    updated_at: now,
                    deleted_at: null,
                    sync_status: 'synced' as const 
                }))
            };

            await db.transaction('rw', [db.transactions, db.transaction_items, db.products, db.ingredients, db.product_ingredients, db.sync_queue, db.stock_logs], async () => {
                // 1. Create Transaction
                await db.transactions.add(transaction);

                // 2. Create Transaction Items & Update Stock
                for (const item of items) {
                    const itemId = createId();
                    await db.transaction_items.add({
                        id: itemId,
                        transaction_id: transactionId,
                        product_id: item.id,
                        quantity: item.quantity,
                        price_at_time: item.price,
                        cost_at_time: item.cost,
                        name_at_time: item.name,
                        user_id: userId,
                        created_at: now,
                        updated_at: now,
                        sync_status: 'synced' // Will be pushed as part of the transaction payload or separately
                    });

                    // A. Update local product stock
                    const product = await db.products.get(item.id);
                    if (product) {
                        const newStock = product.stock_store - item.quantity;
                        await db.products.update(item.id, {
                            stock_store: newStock,
                            updated_at: now,
                            sync_status: 'pending'
                        });

                        // Log product stock change locally
                        await db.stock_logs.add({
                            id: createId(),
                            user_id: userId,
                            product_id: item.id,
                            change_amount: -item.quantity,
                            type: 'sale',
                            location: 'store',
                            reference_id: transactionId,
                            created_at: now,
                            updated_at: now,
                            deleted_at: null,
                            sync_status: 'synced' // Sales logs usually don't need independent sync if transaction syncs them, but we follow the schema
                        });
                        
                        // Note: We DO NOT add product stock update to sync_queue here.
                        // Supabase has a trigger `on_transaction_item_added` that will 
                        // automatically deduct the stock when the transaction_item is inserted.
                        // Adding it to sync_queue would cause a double deduction!
                    }

                    // B. Update Ingredient Stocks (BOM)
                    const boms = await db.product_ingredients.where('product_id').equals(item.id).toArray();
                    for (const bom of boms) {
                        const ingredient = await db.ingredients.get(bom.ingredient_id);
                        if (ingredient) {
                            const usedQty = bom.quantity * item.quantity;
                            const newIngStock = (ingredient.stock_current || 0) - usedQty;
                            
                            await db.ingredients.update(bom.ingredient_id, {
                                stock_current: newIngStock,
                                updated_at: now,
                                sync_status: 'pending'
                            });

                            // Log ingredient stock change
                            await db.stock_logs.add({
                                id: createId(),
                                user_id: userId,
                                product_id: bom.ingredient_id,
                                change_amount: -usedQty,
                                type: 'sale_bom',
                                location: 'store',
                                reference_id: transactionId,
                                created_at: now,
                                updated_at: now,
                                deleted_at: null,
                                sync_status: 'synced'
                            });

                            // Add ingredient update to sync queue
                            await addToSyncQueue('ingredients', 'update', bom.ingredient_id, {
                                stock_current: newIngStock,
                                updated_at: now
                            });
                        }
                    }
                }

                // 3. Add Transaction to Sync Queue
                await addToSyncQueue('transactions', 'insert', transactionId, transaction);
                
                // 4. Add Items to Sync Queue
                for (const item of items) {
                     const itemId = createId();
                     const isCustom = item.id.startsWith('custom-');
                     
                     await addToSyncQueue('transaction_items', 'insert', itemId, {
                        id: itemId,
                        transaction_id: transactionId,
                        product_id: isCustom ? null : item.id,
                        quantity: item.quantity,
                        price_at_time: item.price,
                        cost_at_time: item.cost,
                        name_at_time: item.name,
                        user_id: userId,
                        created_at: now,
                        updated_at: now,
                        discount_details: {
                            disc1: item.disc1,
                            disc2: item.disc2,
                            nominalDisc: item.nominalDisc
                        }
                    });
                }
            });

            // Clear cart and trigger sync
            clearCart();
            runSync();

            return transaction;
        } catch (error) {
            console.error('Checkout failed:', error);
            return null;
        }
    };

    return { checkout };
};
