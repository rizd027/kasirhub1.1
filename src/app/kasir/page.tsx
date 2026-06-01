'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MinimarketMode } from '@/features/cashier/MinimarketMode';
import { RestoMode } from '@/features/cashier/RestoMode';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/useCartStore';
import { useCheckout } from '@/hooks/useCheckout';
import { useSync, triggerSync } from '@/hooks/useSync';
import { useLayoutStore } from '@/store/useLayoutStore';
import { ShoppingCart, LayoutGrid, List, Check, Eye, Trash2, Settings, Printer, Share2, CheckCircle2, Tag, Maximize2, Lock, Inbox, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { db, LocalProduct, LocalTransaction } from '@/db/dexie';
import { useRouter } from 'next/navigation';
import { Receipt } from '@/features/cashier/Receipt';
import { generateReceiptPDF, shareReceipt, printReceipt } from '@/utils/receipt';
import dynamic from 'next/dynamic';

const PaymentOverlay = dynamic(() => import('@/features/cashier/PaymentOverlay').then(mod => mod.PaymentOverlay), { ssr: false });
const CartOverlay = dynamic(() => import('@/features/cashier/CartOverlay').then(mod => mod.CartOverlay), { ssr: false });
const SuccessOverlay = dynamic(() => import('@/features/cashier/SuccessOverlay').then(mod => mod.SuccessOverlay), { ssr: false });
const InboxOverlay = dynamic(() => import('@/features/cashier/InboxOverlay').then(mod => mod.InboxOverlay), { ssr: false });

import { HoldOrderBar } from '@/features/cashier/HoldOrderBar';
import { PinDialog } from '@/components/ui/PinDialog';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStaffStore } from '@/store/useStaffStore';
import { supabase } from '@/services/supabase';
import { clearAllLocalData } from '@/utils/auth';
import { runPushSync } from '@/services/sync/syncManager';
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
  
  // Reactive data fetching with useLiveQuery
  const rawProducts = useLiveQuery(() => db.products.toArray()) || [];
  const rawCategories = useLiveQuery(() => db.categories.toArray()) || [];
  const rawBundles = useLiveQuery(() => db.bundling.toArray()) || [];

  const products = useMemo(() => {
    const activeBundles = rawBundles.filter(bundle => bundle.is_active);
    const bundlesAsProducts = activeBundles.map(bundle => {
      const description = bundle.products.map(item => {
        const prod = rawProducts.find(p => p.id === item.product_id);
        return `${item.qty}x ${prod ? prod.name : 'Produk'}`;
      }).join(' + ');
      return {
        id: `bundle-${bundle.id}`,
        name: bundle.name,
        price_sell: bundle.price_sell,
        price_cost: bundle.products.reduce((sum, item) => sum + (item.hpp * item.qty), 0),
        category_id: 'bundling',
        image_url: '',
        is_bundle: true,
        bundle_items: bundle.products,
        description: description
      };
    });
    return [...rawProducts.filter(prod => !prod.deleted_at), ...bundlesAsProducts as any];
  }, [rawProducts, rawBundles]);

  const categories = useMemo(() => {
    return [...rawCategories, { id: 'bundling', name: 'Bundling Cerdas' }];
  }, [rawCategories]);

  const { items, getTotal, getSubtotal, getOrderDiscountAmount, clearCart, customerName, setCustomerName } = useCartStore();
  const { checkout } = useCheckout();
  const [showVoidPin, setShowVoidPin] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const router = useRouter();
  
  // Activate sync hooks for cashier sync
  const { isSyncing, performSync } = useSync();

  // Auto-sync if IndexedDB is empty
  useEffect(() => {
    if (!kasirUserId || !navigator.onLine) return;

    const checkAndSync = async () => {
      try {
        const count = await db.products.count();
        if (count === 0) {
          console.log('IndexedDB is empty, pulling products from cloud...');
          const toastId = toast.loading('Mengunduh data pertama dari cloud...');
          await performSync(kasirUserId);
          toast.success('Data produk berhasil disinkronkan!', { id: toastId });
        }
      } catch (err) {
        console.error('Auto-sync check failed:', err);
      }
    };

    checkAndSync();
  }, [kasirUserId, performSync]);

  // Effect 1: Fetch admin owner_id (from session)
  useEffect(() => {
    if (session) {
      setKasirUserId(session.owner_id || session.id);
    }
  }, [session]);

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
      router.push('/absensi');
    }
  }, [session, isCheckedIn, router]);

  useEffect(() => {
    router.prefetch('/pengaturan');
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

  const getActiveReceiptId = () => {
    const desktopEl = document.getElementById('receipt-content-desktop');
    if (desktopEl && desktopEl.clientWidth > 0) {
      return 'receipt-content-desktop';
    }
    return 'receipt-content-mobile';
  };

  const handlePrint = async (size?: string) => {
    try {
      console.log('Generating PDF for Print...', size);
      const elementId = getActiveReceiptId();
      const pdfBlob = await generateReceiptPDF(elementId, size);
      
      if (pdfBlob) {
        printReceipt(pdfBlob);
      } else {
        window.print();
      }
    } catch (err: any) {
      console.error('Print failed:', err);
      window.print();
    }
  };

  const handleShare = async (size?: string) => {
    try {
      const elementId = getActiveReceiptId();
      const pdfBlob = await generateReceiptPDF(elementId, size);
      if (pdfBlob && lastTx) {
        await shareReceipt(pdfBlob, `Nota-${lastTx.id}`);
      } else {
        alert('Gagal membuat file nota.');
      }
    } catch (err: any) {
      console.error('Share failed:', err);
      alert('Error Share: ' + (err.message || 'Gagal membuat file'));
    }
  };

  return (
    <div data-kasir-root className={cn("flex flex-col bg-background select-none overflow-hidden", isFullscreen ? "h-screen" : "h-[calc(100dvh-4rem)] lg:h-screen")}>
      {/* Header */}
      {!isFullscreen && (
        <header className="flex items-center justify-between px-3 h-14 border-b bg-white shrink-0 no-print sticky top-0 z-50">
          {/* Session Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-lg transition-all border border-transparent hover:border-slate-100 group outline-none">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/10 text-xs shadow-sm group-hover:scale-105 transition-transform shrink-0">
                {session ? session.name.charAt(0) : <UserCircle2 className="h-4 w-4" />}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-black uppercase text-primary/60 tracking-widest leading-none mb-0.5">
                  {session?.role === 'admin' ? 'Bos Toko' : 'Kasir Aktif'}
                </span>
                <span className="text-xs font-black text-slate-800 leading-tight max-w-[100px] truncate">
                  {session?.name || 'User'}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 rounded-lg p-1 shadow-2xl border-slate-100">
              <div className="px-3 py-2 border-b border-slate-50 mb-1">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sesi Aktif</p>
                <p className="text-sm font-bold text-slate-700">{session?.name}</p>
              </div>
              <DropdownMenuItem onClick={() => router.push('/pengaturan')} className="rounded-lg h-10">
                <Settings className="size-4 mr-2" /> Pengaturan
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowLogoutConfirm(true)} 
                className="rounded-lg h-10 text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <Lock className="size-4 mr-2" /> Keluar Aplikasi
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-lg border border-slate-100">
              <DropdownMenu>
                <DropdownMenuTrigger 
                  className="h-8 w-8 rounded-lg bg-white text-indigo-600 shadow-sm hover:bg-slate-50 transition-all border border-slate-100 flex items-center justify-center"
                  title="Pilih Mode Kasir"
                >
                  {viewMode === 'minimarket' ? (
                    <List className="h-4 w-4" />
                  ) : (
                    <LayoutGrid className="h-4 w-4" />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl p-1 shadow-2xl border-slate-100">
                  <div className="px-3 py-2 border-b border-slate-50 mb-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pilih Mode Tampilan</p>
                  </div>
                  <DropdownMenuItem 
                    onClick={() => setViewMode('minimarket')}
                    className={cn("rounded-lg h-10 gap-3", viewMode === 'minimarket' && "bg-indigo-50 text-indigo-600")}
                  >
                    <List className="size-4" /> 
                    <span className="font-bold text-xs uppercase tracking-tight">Minimarket</span>
                    {viewMode === 'minimarket' && <Check className="size-3 ml-auto" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setViewMode('resto')}
                    className={cn("rounded-lg h-10 gap-3", viewMode === 'resto' && "bg-indigo-50 text-indigo-600")}
                  >
                    <LayoutGrid className="size-4" /> 
                    <span className="font-bold text-xs uppercase tracking-tight">Resto & Cafe</span>
                    {viewMode === 'resto' && <Check className="size-3 ml-auto" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <Button
                variant="ghost"
                size="icon"
                disabled={isSyncing}
                onClick={async () => {
                  if (!kasirUserId) return;
                  const toastId = toast.loading('Menyinkronkan data...');
                  try {
                    await performSync(kasirUserId);
                    toast.success('Data berhasil disinkronkan!', { id: toastId });
                  } catch (err: any) {
                    toast.error('Gagal sinkronisasi: ' + err.message, { id: toastId });
                  }
                }}
                className={cn(
                  "h-8 w-8 rounded-lg transition-all",
                  isSyncing ? "text-indigo-600" : "text-slate-400 hover:bg-slate-100"
                )}
                title="Sinkronisasi Data"
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </Button>
              <div className="w-px h-4 bg-slate-200 mx-0.5" />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className={cn(
                  "h-8 w-8 rounded-lg transition-all",
                  isFullscreen ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-slate-400 hover:bg-slate-100"
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
        <aside 
          data-desktop-cart
          className="hidden lg:flex w-[400px] flex-col bg-slate-50/50 shrink-0 overflow-hidden border-l border-slate-200/60 shadow-[inset_0_0_40px_rgba(0,0,0,0.02)]"
        >
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
              <button
                onClick={() => setInboxOpen(true)}
                className="relative inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all"
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
              <Button 
                variant="outline" 
                size="icon"
                className="size-10 rounded-lg border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all"
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
          <div className="flex-1 overflow-y-auto px-6 py-2 overscroll-contain">
             {items.map((item) => (
               <div key={item.id} className="py-3 border-b border-slate-200/60 flex items-center gap-4 group transition-all">
                 <div className="flex-1 min-w-0">
                   <p className="text-[13px] font-bold text-slate-800 truncate leading-tight mb-1">{item.name}</p>
                   {item.is_bundle && item.description && (
                     <p className="text-[10px] text-indigo-500 font-medium leading-tight mb-1">{item.description}</p>
                   )}
                   <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-indigo-600">
                        {item.quantity}x
                      </span>
                      <span className="text-[10px] font-medium text-slate-400">
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
          <div className="p-3 bg-white border-t border-slate-200/60 space-y-3 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
            <div className="space-y-1.5">
              {getOrderDiscountAmount() > 0 && (
                <div className="flex justify-between items-center text-[10px] text-amber-600">
                  <span className="font-black uppercase tracking-widest">Diskon Nota</span>
                  <span className="font-black">- Rp {getOrderDiscountAmount().toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Total Tagihan</span>
                  <span className="text-2xl font-black text-indigo-600 tracking-tighter">Rp {getTotal().toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <Button 
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-lg shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
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
      {/* Mobile Summary Bar - Fixed at bottom, above nav bar */}
      <div 
        data-mobile-cart-footer
        className={cn(
          "lg:hidden fixed left-0 right-0 border-t bg-white/95 backdrop-blur-sm no-print shadow-[0_-6px_20px_rgba(0,0,0,0.07)] z-40",
          isFullscreen ? "bottom-0 pb-safe" : "bottom-16"
        )}
      >
        {/* Total Row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              {totalQty} Item Tersimpan
            </span>
            {getOrderDiscountAmount() > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100 w-fit">
                <Tag className="h-2.5 w-2.5" />
                -Rp {getOrderDiscountAmount().toLocaleString('id-ID')}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end">
            {getOrderDiscountAmount() > 0 && (
              <span className="text-[10px] font-bold text-slate-300 line-through leading-none mb-0.5">
                Rp {getSubtotal().toLocaleString('id-ID')}
              </span>
            )}
            <span className="text-lg font-black text-primary leading-none tracking-tight">
              Rp {getTotal().toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 px-4 pb-3">
          {/* Inbox */}
          <button
            onClick={() => setInboxOpen(true)}
            className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all active:scale-95"
            title="Inbox Pesanan"
          >
            <Inbox className="h-4 w-4" />
            {pendingOrderCount > 0 && (
              <span className="absolute -top-1 -right-1 flex">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-4 bg-indigo-600 text-white text-[8px] font-black items-center justify-center">
                  {pendingOrderCount > 9 ? '9+' : pendingOrderCount}
                </span>
              </span>
            )}
          </button>

          {/* Void / Clear */}
          <button
            onClick={() => {
              const savedPin = localStorage.getItem('kasirhub_app_password');
              if (savedPin) setShowVoidPin(true);
              else setShowClearConfirm(true);
            }}
            disabled={items.length === 0}
            title="Reset Keranjang"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* Pay Button */}
          <Button 
            className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-200 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2" 
            disabled={items.length === 0}
            onClick={() => {
              if (viewMode === 'resto') {
                setCartDialogOpen(true);
              } else {
                setPayDialogOpen(true);
              }
            }}
          >
            <ShoppingCart className="h-4 w-4" />
            BAYAR
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
          const toastId = toast.loading('Mengunggah data sebelum keluar...');
          try {
            await runPushSync(true);
          } catch (e) {
            console.error('Sync before logout failed:', e);
          }
          await clearAllLocalData();
          router.replace('/login');
          toast.success('Berhasil keluar', { id: toastId });
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
    </div>
  );
}

