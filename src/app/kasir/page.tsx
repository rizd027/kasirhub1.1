'use client';

import { useState, useEffect } from 'react';
import { MinimarketMode } from '@/features/cashier/MinimarketMode';
import { RestoMode } from '@/features/cashier/RestoMode';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import { useCheckout } from '@/hooks/useCheckout';
import { useSync, triggerSync } from '@/hooks/useSync';
import { useLayoutStore } from '@/store/useLayoutStore';
import { ShoppingCart, LayoutGrid, List, Check, Eye, Trash2, Settings, Printer, Share2, CheckCircle2, Tag, Maximize2, Lock, Inbox } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { db, LocalProduct, LocalTransaction } from '@/lib/dexie';
import { useRouter } from 'next/navigation';
import { Receipt } from '@/features/cashier/Receipt';
import { generateReceiptPDF, shareReceipt } from '@/utils/receipt';
import { PaymentOverlay } from '@/features/cashier/PaymentOverlay';
import { CartOverlay } from '@/features/cashier/CartOverlay';
import { SuccessOverlay } from '@/features/cashier/SuccessOverlay';
import { InboxOverlay } from '@/features/cashier/InboxOverlay';
import { HoldOrderBar } from '@/features/cashier/HoldOrderBar';
import { PinDialog } from '@/components/ui/PinDialog';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStaffStore } from '@/store/useStaffStore';
import { supabase } from '@/lib/supabase';
import { UserCircle2, ArrowRight } from 'lucide-react';

export default function KasirPage() {
  const { isFullscreen, toggleFullscreen } = useLayoutStore();
  const { session, isCheckedIn, logout } = useStaffStore();
  const [viewMode, setViewMode] = useState<'minimarket' | 'resto'>('minimarket');
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [cartDialogOpen, setCartDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [kasirUserId, setKasirUserId] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<LocalTransaction | null>(null);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const { items, getTotal, getSubtotal, getOrderDiscountAmount, clearCart, customerName, setCustomerName } = useCartStore();
  const { checkout } = useCheckout();
  const [showVoidPin, setShowVoidPin] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const router = useRouter();
  
  // Activate background sync
  useSync();

  // Effect 1: Fetch admin user_id (async, runs once)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setKasirUserId(data.user?.id ?? null);
    });
  }, []);

  // Effect 2: Subscribe to customer_orders Realtime (runs when kasirUserId is ready)
  // Separated from Effect 1 so that .on() is always called BEFORE .subscribe(),
  // avoiding the "cannot add callbacks after subscribe()" error from React Strict Mode.
  useEffect(() => {
    if (!kasirUserId) return;

    // Initial pending count
    supabase
      .from('customer_orders')
      .select('id', { count: 'exact' })
      .eq('user_id', kasirUserId)
      .eq('status', 'pending')
      .then(({ count }) => setPendingOrderCount(count || 0));

    // Realtime subscription — all .on() calls happen synchronously before .subscribe()
    const channel = supabase
      .channel(`kasir-inbox-badge-${kasirUserId}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customer_orders', filter: `user_id=eq.${kasirUserId}` }, () => {
        setPendingOrderCount(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `user_id=eq.${kasirUserId}` }, (payload: any) => {
        if (payload.new.status !== 'pending') setPendingOrderCount(prev => Math.max(0, prev - 1));
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [kasirUserId]);


  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  // Auth & Attendance Check
  useEffect(() => {
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.role === 'staff' && !isCheckedIn) {
      toast.info('Mohon lakukan absensi terlebih dahulu');
      router.push('/settings/absensi');
    }
  }, [session, isCheckedIn, router]);

  useEffect(() => {
    router.prefetch('/settings');
    Promise.all([
      db.products.toArray(),
      db.categories.toArray()
    ]).then(([p, c]) => {
      setProducts(p.filter(prod => !prod.deleted_at));
      setCategories(c);
    });
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Enter to Pay or open Cart
      if (e.ctrlKey && e.key === 'Enter' && items.length > 0) {
        e.preventDefault();
        if (viewMode === 'resto') {
          setCartDialogOpen(true);
        } else {
          setPayDialogOpen(true);
        }
      }
      // Esc to Reset
      if (e.key === 'Escape' && items.length > 0 && !payDialogOpen && !successDialogOpen) {
        setShowClearConfirm(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, payDialogOpen, cartDialogOpen, successDialogOpen, viewMode]);

  const handleCheckout = async (method: 'cash' | 'tempo' | 'qris' | 'transfer', customerName?: string) => {
    const tx = await checkout(method === 'tempo' ? 'tempo' : 'cash', customerName);
    if (tx) {
      setLastTx(tx);
      setPayDialogOpen(false);
      setSuccessDialogOpen(true);

      // Auto Print Logic
      const savedPrefs = localStorage.getItem('kasirhub_prefs');
      if (savedPrefs) {
        try {
          const prefs = JSON.parse(savedPrefs);
          if (prefs.autoPrint) {
            setTimeout(() => {
              window.print();
            }, 500);
          }
        } catch (e) {}
      }
      
      // Immediate sync if online
      triggerSync().catch(console.error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const pdfBlob = await generateReceiptPDF('receipt-content-success');
    if (pdfBlob && lastTx) {
      shareReceipt(pdfBlob, `Nota-${lastTx.id}`);
    }
  };

  return (
    <div className={cn("flex flex-col bg-background select-none overflow-hidden", isFullscreen ? "h-screen" : "h-[calc(100dvh-4rem)] lg:h-screen")}>
      {/* Header */}
      {!isFullscreen && (
        <header className="flex items-center justify-between px-4 h-14 border-b bg-white shrink-0 no-print sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {/* Session Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 hover:bg-slate-50 p-1.5 px-2 rounded-xl transition-all border border-transparent hover:border-slate-100 group outline-none">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/10 text-xs shadow-sm group-hover:scale-105 transition-transform">
                {session ? session.name.charAt(0) : <UserCircle2 className="h-4 w-4" />}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black uppercase text-primary/60 tracking-widest leading-none mb-0.5">
                  {session?.role === 'admin' ? 'Bos Toko' : 'Kasir Aktif'}
                </span>
                <span className="text-xs font-black text-slate-800 leading-tight">
                  {session?.name || 'User'}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 rounded-2xl p-1 shadow-2xl border-slate-100">
              <div className="px-3 py-2 border-b border-slate-50 mb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sesi Aktif</p>
                <p className="text-sm font-bold text-slate-700">{session?.name}</p>
              </div>
              <DropdownMenuItem onClick={() => router.push('/settings')} className="rounded-xl h-10">
                <Settings className="size-4 mr-2" /> Pengaturan
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowLogoutConfirm(true)} 
                className="rounded-xl h-10 text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Lock className="size-4 mr-2" /> Keluar Aplikasi
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          {/* Inbox Button */}
          <button
            onClick={() => setInboxOpen(true)}
            className="relative inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Inbox Pesanan"
          >
            <Inbox className="h-5 w-5" />
            {pendingOrderCount > 0 && (
              <span className="absolute -top-1 -right-1 flex">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-4 bg-indigo-600 text-white text-[9px] font-black items-center justify-center">
                  {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
                </span>
              </span>
            )}
          </button>
          {/* ... existing header content ... */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('minimarket')}
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                viewMode === 'minimarket' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
              )}
              title="Mode Minimarket"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('resto')}
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                viewMode === 'resto' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
              )}
              title="Mode Resto"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-slate-200 mx-0.5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                isFullscreen ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
              )}
              title="Layar Penuh"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      )}

      {/* Main Content Area - Responsive Split Layout */}
      <main className="flex-1 overflow-hidden flex lg:flex-row flex-col min-h-0 no-print bg-white">
        {/* Left Side: Product Catalog / Modes */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 border-r border-slate-100">
          <HoldOrderBar />
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {viewMode === 'minimarket' ? (
              <MinimarketMode products={products} isFullscreen={isFullscreen} setViewMode={setViewMode} toggleFullscreen={toggleFullscreen} />
            ) : (
              <RestoMode products={products} categories={categories} isFullscreen={isFullscreen} setViewMode={setViewMode} toggleFullscreen={toggleFullscreen} />
            )}
          </div>
        </div>

        {/* Right Side: Desktop Cart Sidebar (Visible only on lg+) */}
        <aside className="hidden lg:flex w-[400px] flex-col bg-slate-50/50 shrink-0 overflow-hidden border-l border-slate-200/60 shadow-[inset_0_0_40px_rgba(0,0,0,0.02)]">
          {/* Header Sidebar */}
          <div className="h-16 px-6 border-b bg-white/80 backdrop-blur-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-indigo-600/60 uppercase tracking-[0.2em] mb-1">Daftar Belanja</span>
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <div className="size-2 rounded-full bg-indigo-600 animate-pulse" />
                {customerName || 'Pelanggan Umum'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {isFullscreen && (
                <button
                  onClick={() => setInboxOpen(true)}
                  className="relative inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all"
                  title="Inbox Pesanan"
                >
                  <Inbox className="size-4" />
                  {pendingOrderCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-4 bg-indigo-600 text-white text-[9px] font-black items-center justify-center">
                        {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
                      </span>
                    </span>
                  )}
                </button>
              )}
              <Button 
                variant="outline" 
                size="icon"
                className="size-10 rounded-xl border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all"
                onClick={() => {
                  const savedPin = localStorage.getItem('kasirhub_app_password');
                  if (savedPin) setShowVoidPin(true);
                  else setShowClearConfirm(true);
                }}
                disabled={items.length === 0}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {/* Cart Items List - Desktop */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
             {items.map((item) => (
               <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-sm flex items-center gap-4 group hover:border-indigo-100 transition-all">
                 <div className="flex-1 min-w-0">
                   <p className="text-[13px] font-black text-slate-800 truncate leading-tight mb-1">{item.name}</p>
                   <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded-lg bg-indigo-50 text-[10px] font-black text-indigo-600">
                        {item.quantity}x
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        @ Rp {item.price.toLocaleString('id-ID')}
                      </span>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-[13px] font-black text-slate-800">
                     Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                   </p>
                 </div>
               </div>
             ))}
             {items.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center py-20 grayscale opacity-30">
                 <div className="size-20 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-4">
                   <ShoppingCart className="size-8 text-slate-400" />
                 </div>
                 <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Keranjang Masih Kosong</p>
               </div>
             )}
          </div>

          {/* Sidebar Footer - Totals & Pay */}
          <div className="p-4 bg-white border-t border-slate-200/60 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
                <span className="font-black text-slate-700">Rp {getSubtotal().toLocaleString('id-ID')}</span>
              </div>
              {getOrderDiscountAmount() > 0 && (
                <div className="flex justify-between items-center text-[10px] text-amber-600">
                  <span className="font-black uppercase tracking-widest">Diskon Nota</span>
                  <span className="font-black">- Rp {getOrderDiscountAmount().toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="h-px bg-slate-100 w-full" />
              <div className="flex justify-between items-end py-0.5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Total Tagihan</span>
                  <span className="text-2xl font-black text-indigo-600 tracking-tighter">Rp {getTotal().toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <Button 
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              disabled={items.length === 0}
              onClick={() => setPayDialogOpen(true)}
            >
              <Check className="size-5 stroke-[3px]" />
              BAYAR SEKARANG
            </Button>
          </div>
        </aside>
      </main>

      {/* Footer / Mobile Summary Bar - Hidden on lg+ Desktop Sidebar */}
      <div className={cn(
        "lg:hidden fixed left-0 right-0 p-4 border-t bg-white no-print shadow-[0_-8px_15px_rgba(0,0,0,0.05)] transition-all z-40",
        isFullscreen ? "bottom-0 rounded-t-3xl" : "bottom-16"
      )}>
        <div className="flex items-end justify-between mb-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{totalQty} Item Tersimpan</span>
            {getOrderDiscountAmount() > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 w-fit">
                <Tag className="h-2.5 w-2.5" />
                Diskon: Rp {getOrderDiscountAmount().toLocaleString('id-ID')}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            {getOrderDiscountAmount() > 0 && (
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest line-through decoration-gray-300 mb-0.5">
                Rp {getSubtotal().toLocaleString('id-ID')}
              </span>
            )}
            <span className="text-xl font-black text-primary leading-none">Rp {getTotal().toLocaleString('id-ID')}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          {isFullscreen && (
            <Button
              variant="outline"
              className="w-10 h-10 flex-shrink-0 text-indigo-600 rounded-lg border-indigo-100 bg-indigo-50 relative"
              onClick={() => setInboxOpen(true)}
            >
              <Inbox className="h-4 w-4" />
              {pendingOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                   <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-600 text-[8px] font-black text-white items-center justify-center">
                     {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
                   </span>
                </span>
              )}
            </Button>
          )}
          <Button 
            variant="outline" 
            className="w-10 h-10 flex-shrink-0 text-gray-400 rounded-lg border-gray-200" 
            onClick={() => {
              const savedPin = localStorage.getItem('kasirhub_app_password');
              if (savedPin) setShowVoidPin(true);
              else setShowClearConfirm(true);
            }} 
            disabled={items.length === 0}
            title="Reset Keranjang"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button 
            className="flex-1 h-10 bg-primary hover:bg-primary/90 text-white font-black text-sm shadow-lg shadow-primary/10 rounded-lg transition-all active:scale-95" 
            disabled={items.length === 0}
            onClick={() => {
              if (viewMode === 'resto') {
                setCartDialogOpen(true);
              } else {
                setPayDialogOpen(true);
              }
            }}
          >
            <ShoppingCart className="h-3.5 w-3.5 mr-2" />
            BAYAR
            <span className="ml-2 opacity-50 text-[8px] font-medium hidden xs:inline">[Ctrl+Enter]</span>
          </Button>
        </div>
      </div>

      <PinDialog 
        isOpen={showVoidPin}
        onClose={() => setShowVoidPin(false)}
        onSuccess={() => {
          clearCart();
          setShowVoidPin(false);
          toast.success('Keranjang dikosongkan');
        }}
        title="Otorisasi Void"
        description="Pembatalan seluruh pesanan memerlukan verifikasi PIN Pemilik."
      />

      {/* Resto Mode Cart Overlay */}
      <CartOverlay
        open={cartDialogOpen}
        onOpenChange={setCartDialogOpen}
        products={products}
        onProceedPay={() => setPayDialogOpen(true)}
      />

      {/* Payment Fullscreen Overlay */}
      <PaymentOverlay 
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        total={getTotal()}
        initialCustomerName={customerName}
        onConfirm={(method: 'cash' | 'tempo' | 'qris' | 'transfer', paidAmount: number, customerName?: string) => handleCheckout(method, customerName)}
      />

      {/* Success Fullscreen Overlay */}
      {lastTx && (
        <SuccessOverlay 
          open={successDialogOpen}
          onOpenChange={setSuccessDialogOpen}
          transaction={lastTx}
          onPrint={handlePrint}
          onShare={handleShare}
        />
      )}

      <AlertConfirm
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Kosongkan Keranjang?"
        description="Semua item yang telah dipilih akan dihapus dari daftar pesanan."
        confirmText="Ya, Kosongkan"
        cancelText="Batal"
        variant="destructive"
        onConfirm={() => {
          clearCart();
          setShowClearConfirm(false);
        }}
      />

      <AlertConfirm
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Keluar Aplikasi?"
        description="Anda akan keluar dari sesi aktif. Pastikan data telah tersinkronisasi."
        confirmText="Ya, Keluar"
        cancelText="Batal"
        variant="destructive"
        onConfirm={async () => {
          await supabase.auth.signOut();
          logout();
          localStorage.clear();
          sessionStorage.clear();
          router.replace('/login');
        }}
      />

      {/* Inbox Overlay */}
      <InboxOverlay
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        userId={kasirUserId}
        onSetCustomerName={setCustomerName}
      />

      {/* Print-only receipt view */}
      <div className="only-print hidden">
        {lastTx && <Receipt transaction={lastTx} idElement="print-receipt" />}
      </div>


      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .only-print { display: block !important; }
          body { background: white !important; }
          @page { margin: 0; }
        }
      `}</style>
    </div>
  );
}

