import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateTieredDiscount } from '@/utils/calculations';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  cost: number; // Harga modal
  quantity: number;
  disc1: number;
  disc2: number;
  nominalDisc: number;
  isCustom?: boolean;
  is_bundle?: boolean;
}

export interface HeldOrder {
  id: string;
  label: string;
  items: CartItem[];
  orderDiscount: OrderDiscount;
  createdAt: string;
}

export interface OrderDiscount {
  type: 'percent' | 'nominal';
  value: number;
}

interface CartState {
  items: CartItem[];
  holdOrders: HeldOrder[];
  orderDiscount: OrderDiscount;
  customerName: string;

  // Item actions
  addItem: (product: any) => void;
  addCustomItem: (name: string, price: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateDiscount: (id: string, disc1: number, disc2: number, nominalDisc: number) => void;
  clearCart: () => void;

  // Metadata actions
  setCustomerName: (name: string) => void;

  // Order-level discount
  setOrderDiscount: (discount: OrderDiscount) => void;

  // Hold order
  holdCart: (label?: string) => void;
  restoreCart: (id: string) => void;
  deleteHeldOrder: (id: string) => void;

  // Calculations
  getTotal: () => number;
  getSubtotal: () => number;
  getOrderDiscountAmount: () => number;
  getTaxAmount: () => number;
  getServiceAmount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      holdOrders: [],
      orderDiscount: { type: 'percent', value: 0 },
      customerName: '',

      addItem: (product: any) => {
        const existing = get().items.find(i => i.id === product.id);
        if (existing) {
          set({
            items: get().items.map(i =>
              i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            )
          });
        } else {
          set({
            items: [...get().items, {
              id: product.id,
              name: product.name,
              price: product.price_sell,
              cost: product.price_cost || 0,
              quantity: 1,
              disc1: 0,
              disc2: 0,
              nominalDisc: 0,
              isCustom: false,
              is_bundle: product.is_bundle || false,
            }]
          });
        }
      },

      addCustomItem: (name: string, price: number) => {
        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        set({
          items: [...get().items, {
            id,
            name,
            price,
            cost: 0, // Item custom diasumsikan modal 0 atau bisa dikembangkan nanti
            quantity: 1,
            disc1: 0,
            disc2: 0,
            nominalDisc: 0,
            isCustom: true,
          }]
        });
      },

      removeItem: (id: string) => set({ items: get().items.filter(i => i.id !== id) }),

      updateQuantity: (id: string, quantity: number) => set({
        items: get().items.map(i => i.id === id ? { ...i, quantity } : i)
      }),

      updateDiscount: (id: string, disc1: number, disc2: number, nominalDisc: number) => set({
        items: get().items.map(i => i.id === id ? { ...i, disc1, disc2, nominalDisc } : i)
      }),

      clearCart: () => set({ items: [], orderDiscount: { type: 'percent', value: 0 }, customerName: '' }),

      setCustomerName: (name: string) => set({ customerName: name }),

      setOrderDiscount: (discount: OrderDiscount) => set({ orderDiscount: discount }),

      holdCart: (label?: string) => {
        const { items, orderDiscount, holdOrders } = get();
        if (items.length === 0) return;
        const heldOrder: HeldOrder = {
          id: `hold-${Date.now()}`,
          label: label || `Pesanan ${holdOrders.length + 1}`,
          items: [...items],
          orderDiscount: { ...orderDiscount },
          createdAt: new Date().toISOString(),
        };
        set({
          holdOrders: [...holdOrders, heldOrder],
          items: [],
          orderDiscount: { type: 'percent', value: 0 },
          customerName: '',
        });
      },

      restoreCart: (id: string) => {
        const { items, orderDiscount, holdOrders } = get();
        const held = holdOrders.find(o => o.id === id);
        if (!held) return;

        const newHoldOrders = holdOrders.filter(o => o.id !== id);
        if (items.length > 0) {
          const currentHeld: HeldOrder = {
            id: `hold-${Date.now()}`,
            label: `Pesanan ${newHoldOrders.length + 1}`,
            items: [...items],
            orderDiscount: { ...orderDiscount },
            createdAt: new Date().toISOString(),
          };
          newHoldOrders.push(currentHeld);
        }

        set({
          items: held.items,
          orderDiscount: held.orderDiscount,
          holdOrders: newHoldOrders,
        });
      },

      deleteHeldOrder: (id: string) => set({
        holdOrders: get().holdOrders.filter(o => o.id !== id)
      }),

      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          const discountedPrice = calculateTieredDiscount(item.price, item.disc1, item.disc2, item.nominalDisc);
          return total + (discountedPrice * item.quantity);
        }, 0);
      },

      getOrderDiscountAmount: () => {
        const { orderDiscount } = get();
        const subtotal = get().getSubtotal();
        if (!orderDiscount.value) return 0;
        if (orderDiscount.type === 'percent') {
          return (subtotal * orderDiscount.value) / 100;
        }
        return Math.min(orderDiscount.value, subtotal);
      },

      getServiceAmount: () => {
        const subtotal = get().getSubtotal() - get().getOrderDiscountAmount();
        if (typeof window === 'undefined') return 0;
        const savedPrefs = localStorage.getItem('kasirhub_prefs');
        if (!savedPrefs) return 0;
        try {
          const p = JSON.parse(savedPrefs);
          const servicePercent = p.serviceChargePercent || 0;
          return (subtotal * servicePercent) / 100;
        } catch { return 0; }
      },

      getTaxAmount: () => {
        const subtotal = get().getSubtotal() - get().getOrderDiscountAmount();
        const service = get().getServiceAmount();
        if (typeof window === 'undefined') return 0;
        const savedPrefs = localStorage.getItem('kasirhub_prefs');
        if (!savedPrefs) return 0;
        try {
          const p = JSON.parse(savedPrefs);
          const ppnPercent = p.ppnPercent || 0;
          const taxMode = p.taxMode || 'exclusive';
          if (taxMode === 'inclusive') {
            return subtotal - (subtotal / (1 + ppnPercent / 100));
          } else {
            return ((subtotal + service) * ppnPercent) / 100;
          }
        } catch { return 0; }
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        const orderDisc = get().getOrderDiscountAmount();
        const service = get().getServiceAmount();
        const tax = get().getTaxAmount();

        if (typeof window === 'undefined') return subtotal - orderDisc;
        const savedPrefs = localStorage.getItem('kasirhub_prefs');
        if (!savedPrefs) return subtotal - orderDisc;
        try {
          const p = JSON.parse(savedPrefs);
          const taxMode = p.taxMode || 'exclusive';
          const base = subtotal - orderDisc;
          if (taxMode === 'inclusive') {
            return base + service;
          } else {
            return base + service + tax;
          }
        } catch { return subtotal - orderDisc + service + tax; }
      },
    }),
    {
      name: 'kasirhub-cart-storage',
    }
  )
);
