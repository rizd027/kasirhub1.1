'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { useCartStore } from '@/store/useCartStore';
import { X, ShoppingCart, Clock, Hash, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CustomerOrder {
  id: string;
  table_number: string | null;
  customer_name: string | null;
  items: OrderItem[];
  status: 'pending' | 'accepted' | 'completed';
  created_at: string;
}

interface InboxOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  onSetCustomerName: (name: string) => void;
}

export function InboxOverlay({ open, onOpenChange, userId, onSetCustomerName }: InboxOverlayProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { items: cartItems, addItem } = useCartStore();

  const fetchPendingOrders = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('customer_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setOrders(data || []);
  };

  // Auto-reconnecting realtime channel (handles Android app resume & network drops)
  useRealtimeChannel(
    () => supabase
      .channel(`inbox-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'customer_orders', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newOrder = payload.new as CustomerOrder;
          setOrders(prev => [...prev, newOrder]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `user_id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as CustomerOrder;
          setOrders(prev =>
            updated.status !== 'pending'
              ? prev.filter(o => o.id !== updated.id)
              : prev.map(o => o.id === updated.id ? updated : o)
          );
        }
      ),
    [userId]
  );

  // Fetch initial data + re-fetch on app resume
  useEffect(() => {
    if (!userId) return;
    fetchPendingOrders();

    const handleResume = () => {
      if (document.visibilityState === 'visible') fetchPendingOrders();
    };
    document.addEventListener('visibilitychange', handleResume);
    return () => document.removeEventListener('visibilitychange', handleResume);
  }, [userId]);

  const handlePullToCart = async (order: CustomerOrder) => {
    if (cartItems.length > 0) {
      toast.error('Selesaikan atau kosongkan keranjang saat ini terlebih dahulu!');
      return;
    }

    setLoadingId(order.id);
    try {
      // Add each item to cart using addItem
      for (const item of order.items) {
        // Build a product-like object compatible with addItem
        const productLike = {
          id: item.product_id,
          name: item.name,
          price_sell: item.price,
        };
        for (let i = 0; i < item.quantity; i++) {
          addItem(productLike);
        }
      }

      // Sync customer name/table info
      const info = order.table_number 
        ? `Meja ${order.table_number}${order.customer_name ? ` (${order.customer_name})` : ''}`
        : order.customer_name || '';
      onSetCustomerName(info);
      onOpenChange(false);

      // Mark order as accepted (run in background)
      await supabase
        .from('customer_orders')
        .update({ status: 'accepted' })
        .eq('id', order.id);

      toast.success(`Pesanan ${order.table_number || order.customer_name || 'pelanggan'} ditarik ke keranjang!`);
    } catch {
      toast.error('Gagal memproses pesanan');
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (order: CustomerOrder) => {
    setLoadingId(order.id);
    try {
      await supabase
        .from('customer_orders')
        .update({ status: 'completed' })
        .eq('id', order.id);
      toast.info(`Pesanan ${order.table_number || order.customer_name || ''} ditolak.`);
    } catch {
      toast.error('Gagal menolak pesanan');
    } finally {
      setLoadingId(null);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={() => onOpenChange(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      {/* Panel — slides in from right */}
      <div
        className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pesanan Mandiri</p>
            <h2 className="text-base font-black text-slate-800">
              Inbox {orders.length > 0 && <span className="text-indigo-600">({orders.length})</span>}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <X className="size-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
              <div className="w-20 h-20 rounded-[28px] bg-slate-50 border border-slate-100 flex items-center justify-center mb-5">
                <ShoppingCart className="size-10 text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Belum Ada Pesanan</p>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Pesanan mandiri dari pelanggan<br />akan muncul di sini secara otomatis.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map(order => {
                const isLoading = loadingId === order.id;
                const totalPrice = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
                const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

                return (
                  <div key={order.id} className="p-5 space-y-4">
                    {/* Order Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                          <Hash className="size-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800">
                            {order.table_number ? `Meja ${order.table_number}` : order.customer_name || 'Pelanggan'}
                          </p>
                          {order.customer_name && order.table_number && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.customer_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <Clock className="size-3.5" />
                        <span className="text-[10px] font-black">{formatTime(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-200 rounded-lg w-6 h-6 flex items-center justify-center">{item.quantity}x</span>
                            <span className="text-sm font-bold text-slate-700">{item.name}</span>
                          </div>
                          <span className="text-sm font-black text-slate-600">
                            Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{totalQty} Item · Total</span>
                      <span className="text-base font-black text-indigo-600">Rp {totalPrice.toLocaleString('id-ID')}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(order)}
                        disabled={isLoading}
                        className="flex-1 h-11 rounded-xl bg-red-50 text-red-500 font-black text-xs uppercase tracking-widest border border-red-100 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                        Tolak
                      </button>
                      <button
                        onClick={() => handlePullToCart(order)}
                        disabled={isLoading}
                        className="flex-[2] h-11 rounded-xl bg-indigo-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50 active:scale-[0.98]"
                      >
                        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
                        Tarik ke Keranjang
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
