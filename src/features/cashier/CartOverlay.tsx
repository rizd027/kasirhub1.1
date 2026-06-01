import { useState, useEffect } from 'react';
import { useCartStore } from "@/store/useCartStore";
import { Button } from "@/components/ui/button";
import { LocalProduct } from "@/db/dexie";
import { ChevronRight, Trash2, Plus, Minus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateTieredDiscount } from "@/utils/calculations";
import { PinDialog } from "@/components/ui/PinDialog";
import { toast } from 'sonner';
import { useStaffStore } from '@/store/useStaffStore';

interface CartOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: LocalProduct[];
  onProceedPay: () => void;
}

export function CartOverlay({ open, onOpenChange, products, onProceedPay }: CartOverlayProps) {
  const { items, updateQuantity, removeItem, getTotal, clearCart } = useCartStore();
  const { session } = useStaffStore();
  const [showVoidPin, setShowVoidPin] = useState(false);
  const [pinAction, setPinAction] = useState<{ type: 'clear' | 'remove' | 'decrease', id?: string, value?: number } | null>(null);

  const handleClearCart = () => {
    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (session?.role === 'staff' || savedPin) {
      setPinAction({ type: 'clear' });
      setShowVoidPin(true);
    } else {
      if (confirm('Kosongkan keranjang?')) clearCart();
    }
  };

  const handleRemoveItem = (id: string) => {
    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (session?.role === 'staff' || savedPin) {
      setPinAction({ type: 'remove', id });
      setShowVoidPin(true);
    } else {
      removeItem(id);
    }
  };

  const handleUpdateQuantity = (id: string, current: number, next: number) => {
    if (next >= current) {
      updateQuantity(id, next);
      return;
    }

    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (session?.role === 'staff' || savedPin) {
      setPinAction({ type: 'decrease', id, value: next });
      setShowVoidPin(true);
    } else {
      updateQuantity(id, next);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      onOpenChange(false);
    };

    if (open) {
      // Push state for hardware back button support
      window.history.pushState({ modal: 'cart' }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-white animate-in slide-in-from-bottom duration-300 no-print">
      {/* Header */}
      <div className="pt-6 pb-4 bg-white border-b flex items-center px-4 shrink-0 shadow-sm relative z-10">
        <button 
          onClick={() => onOpenChange(false)}
          className="p-2 -ml-2 mr-2 hover:bg-slate-100 rounded-full transition-colors active:scale-90"
        >
          <ChevronRight className="h-6 w-6 rotate-180 text-slate-700" />
        </button>
        <h2 className="text-lg font-black text-slate-800 tracking-tight flex-1">Keranjang Pesanan</h2>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 font-bold text-xs" 
          onClick={handleClearCart}
        >
          Kosongkan
        </Button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {items.map(item => {
          const product = products.find(p => p.id === item.id);
          const finalPrice = calculateTieredDiscount(item.price, item.disc1, item.disc2, item.nominalDisc);
          return (
            <div key={item.id} className="py-3 px-4 border-b border-slate-100 last:border-0 flex flex-col gap-1 animate-in fade-in duration-200">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-slate-800 leading-tight">{item.name}</h3>
                  {item.is_bundle && item.description && (
                    <div className="text-[10px] text-indigo-500 font-medium leading-tight mt-0.5">{item.description}</div>
                  )}
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5">Rp {finalPrice.toLocaleString('id-ID')} / item</div>
                </div>
                <button 
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-2 -mr-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex items-end justify-between mt-2">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-lg p-1">
                  <button 
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded-md transition-all active:scale-95"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity, item.quantity - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                  <button 
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded-md transition-all active:scale-95"
                    onClick={() => handleUpdateQuantity(item.id, item.quantity, item.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-right">
                  {(item.disc1 > 0 || item.disc2 > 0 || item.nominalDisc > 0) && (
                    <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">
                      <Tag className="h-3 w-3" />
                      Diskon Aktif
                    </div>
                  )}
                  <div className="text-indigo-600 font-black text-base">
                    Rp {(finalPrice * item.quantity).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-medium text-sm">
            Keranjang masih kosong
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-white border-t shrink-0">
        <div className="max-w-md mx-auto">
          <Button 
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base rounded-lg shadow-lg shadow-indigo-100 transition-all active:scale-95"
            disabled={items.length === 0}
            onClick={() => {
              onOpenChange(false);
              onProceedPay();
            }}
          >
            Lanjut Bayar - Rp {getTotal().toLocaleString('id-ID')}
          </Button>
        </div>
      </div>

      <PinDialog 
        isOpen={showVoidPin}
        onClose={() => {
          setShowVoidPin(false);
          setPinAction(null);
        }}
        onSuccess={() => {
          if (pinAction?.type === 'clear') {
            clearCart();
            toast.success('Keranjang dikosongkan');
          } else if (pinAction?.type === 'remove' && pinAction.id) {
            removeItem(pinAction.id);
            toast.success('Item dihapus');
          } else if (pinAction?.type === 'decrease' && pinAction.id && pinAction.value !== undefined) {
            updateQuantity(pinAction.id, pinAction.value);
          }
          setShowVoidPin(false);
          setPinAction(null);
        }}
        title="Otorisasi Pesanan"
        description="Pengurangan atau pembatalan pesanan memerlukan verifikasi PIN Pemilik."
      />
    </div>
  );
}

