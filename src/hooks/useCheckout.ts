'use client';

import { useCartStore } from "@/store/useCartStore";
import { db, LocalTransaction } from "@/lib/dexie";
import { toast } from "sonner";
import { calculateTieredDiscount } from "@/utils/calculations";

import { useStaffStore } from "@/store/useStaffStore";

export const useCheckout = () => {
  const { items, getTotal, getSubtotal, getTaxAmount, getServiceAmount, clearCart } = useCartStore();
  const { session } = useStaffStore();

  const checkout = async (paymentMethod: 'cash' | 'tempo', customerName?: string) => {
    if (items.length === 0) {
      toast.error("Keranjang kosong!");
      return;
    }

    const total = getTotal();
    const subtotal = getSubtotal();
    const taxAmount = getTaxAmount();
    const serviceAmount = getServiceAmount();

    const discountTotal = items.reduce((acc, item) => {
      const discountedPrice = calculateTieredDiscount(item.price, item.disc1, item.disc2, item.nominalDisc);
      return acc + ((item.price - discountedPrice) * item.quantity);
    }, 0);

    const transaction: LocalTransaction = {
      total_amount: total,
      subtotal: subtotal,
      tax_amount: taxAmount,
      service_charge_amount: serviceAmount,
      discount_total: discountTotal,
      payment_method: paymentMethod,
      status: (paymentMethod === 'cash' ? 'paid' : 'unpaid') as 'paid' | 'unpaid' | 'partial',
      items: items.map(i => ({ ...i })),
      created_at: new Date().toISOString(),
      synced: 0,
      customer_name: customerName,
      employee_id: session?.id,
      cashier_name: session?.name
    };

    try {
      // 1. Save Transaction to IndexedDB
      const txId = await db.transactions.add(transaction);
      const savedTx = { ...transaction, id: txId.toString() };
      
      // 2. Update Local Stock
      for (const item of items) {
        const product = await db.products.get(item.id);
        if (product) {
          await db.products.update(item.id, {
            stock_store: Math.max(0, (product.stock_store || 0) - item.quantity)
          });
        }
      }
      
      clearCart();
      return savedTx as LocalTransaction;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Gagal memproses transaksi.");
    }
  };

  return { checkout };
};
