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
    <div className={cn("flex flex-col bg-background select-none overflow-hidden", isFullscreen ? "h-[100dvh]" : "h-[calc(100dvh-4rem)]")}>
      {/* Header */}
      {!isFullscreen && (
        <header className="flex items-center justify-between px-4 h-14 border-b bg-card shrink-0 no-print">
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
        <aside className="hidden lg:flex w-[380px] flex-col bg-slate-50/30 shrink-0 overflow-hidden">
          {/* Header Sidebar */}
          <div className="p-5 border-b bg-white flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Pesanan</span>
              <h2 className="text-sm font-black text-slate-800">{customerName || 'Pelanggan Umum'}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                className="size-9 rounded-xl border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100"
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {items.map((item) => (
               <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                 <div className="flex-1 min-w-0">
                   <p className="text-xs font-black text-slate-800 truncate">{item.name}</p>
                   <p className="text-[10px] font-bold text-indigo-600">
                     {item.quantity} x Rp {item.price.toLocaleString('id-ID')}
                   </p>
                 </div>
                 <div className="text-right">
                   <p className="text-xs font-black text-slate-800">
                     Rp {(item.price * item.quantity).toLocaleString('id-ID')}
                   </p>
                 </div>
               </div>
             ))}
             {items.length === 0 && (
               <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                 <ShoppingCart className="size-12 mb-2" />
                 <p className="text-xs font-black uppercase tracking-widest">Keranjang Kosong</p>
               </div>
             )}
          </div>

          {/* Sidebar Footer - Totals & Pay */}
          <div className="p-5 bg-white border-t space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400">Subtotal</span>
                <span className="font-black text-slate-700">Rp {getSubtotal().toLocaleString('id-ID')}</span>
              </div>
              {getOrderDiscountAmount() > 0 && (
                <div className="flex justify-between items-center text-xs text-amber-600">
                  <span className="font-bold">Diskon</span>
                  <span className="font-black">- Rp {getOrderDiscountAmount().toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                <span className="text-sm font-black text-slate-800">Total</span>
                <span className="text-xl font-black text-indigo-600">Rp {getTotal().toLocaleString('id-ID')}</span>
              </div>
            </div>

            <Button 
              className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
              disabled={items.length === 0}
              onClick={() => setPayDialogOpen(true)}
            >
              <Check className="size-5" />
              KONFIRMASI BAYAR
            </Button>
          </div>
        </aside>
      </main>

      {/* Footer / Mobile Summary Bar - Hidden on lg+ Desktop Sidebar */}
      <div className={cn(
        "lg:hidden p-4 border-t bg-white shrink-0 no-print shadow-[0_-8px_15px_rgba(0,0,0,0.05)] transition-all z-40",
        isFullscreen && "rounded-t-3xl"
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

      {/* Fullscreen Floating Controls */}
      {isFullscreen && (
        <div className="fixed top-4 left-4 z-[70] flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-100 shadow-2xl no-print animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode('minimarket')}
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                viewMode === 'minimarket' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
              )}
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
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          {/* Inbox in Fullscreen */}
          <button
            onClick={() => setInboxOpen(true)}
            className={cn(
              "relative size-9 rounded-xl flex items-center justify-center transition-all",
              pendingOrderCount > 0 ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50"
            )}
          >
            <Inbox className="h-5 w-5" />
            {pendingOrderCount > 0 && (
              <span className="absolute -top-1 -right-1 flex">
                <span className="relative inline-flex rounded-full size-4 bg-indigo-600 text-white text-[9px] font-black items-center justify-center border-2 border-white">
                  {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
                </span>
              </span>
            )}
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

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

