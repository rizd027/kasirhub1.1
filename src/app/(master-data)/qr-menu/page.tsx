'use client';

import { useState, useEffect, useRef } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { supabase } from '@/services/supabase';
import { useStaffStore } from '@/store/useStaffStore';
import { 
  QrCode, Copy, Download, ExternalLink, CheckCircle2, 
  Smartphone, ShieldCheck, Zap, CloudUpload, AlertTriangle, 
  Loader2, Search, Edit, Trash2, RefreshCw, Database, X 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { runPushSync } from '@/services/sync/syncManager';
import { db } from '@/db/dexie';
import { useLiveQuery } from 'dexie-react-hooks';

export default function QrMenuPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('Toko Saya');
  const [isSyncingKatalog, setIsSyncingKatalog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const { session, isHydrated } = useStaffStore();

  // Cloud Product Management States
  const [activeTab, setActiveTab] = useState<'qr' | 'cloud-products'>('qr');
  const [cloudProducts, setCloudProducts] = useState<any[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [localProductsMap, setLocalProductsMap] = useState<Map<string, any>>(new Map());

  const pendingProducts = useLiveQuery(
    () => db.sync_queue.where('sync_status').equals('pending').count(),
    [],
    0
  );

  const handleUploadKatalog = async () => {
    if (!userId) {
      toast.error('Anda harus login terlebih dahulu.');
      return;
    }
    setIsSyncingKatalog(true);
    const toastId = toast.loading('Mengunggah katalog produk ke Cloud...');
    try {
      await runPushSync(true); // force = true to bypass manual mode guard and sync instantly
      toast.success('Katalog berhasil diunggah! Menu pelanggan kini terupdate.', { id: toastId });
      if (activeTab === 'cloud-products') {
        fetchCloudProducts();
        fetchLocalProducts();
      }
    } catch (err: any) {
      toast.error(`Gagal mengunggah: ${err.message || 'Periksa koneksi internet'}`, { id: toastId });
    } finally {
      setIsSyncingKatalog(false);
    }
  };

  const getBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    if (origin.includes('localhost')) return origin;
    if (origin.startsWith('capacitor://')) return process.env.NEXT_PUBLIC_APP_URL || '';
    return origin;
  };

  const menuUrl = userId
    ? slug
      ? `${getBaseUrl()}/menu/${slug}`
      : `${getBaseUrl()}/menu?uid=${userId}`
    : null;

  const qrCodeUrl = menuUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=20&data=${encodeURIComponent(menuUrl)}`
    : null;

  const fetchCloudProducts = async () => {
    if (!userId) return;
    setIsLoadingCloud(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      setCloudProducts(data || []);
    } catch (err: any) {
      toast.error(`Gagal memuat produk cloud: ${err.message}`);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  const fetchLocalProducts = async () => {
    try {
      const locals = await db.products.toArray();
      const map = new Map<string, any>();
      locals.forEach(p => map.set(p.id, p));
      setLocalProductsMap(map);
    } catch (err) {
      console.error('Failed to fetch local products:', err);
    }
  };

  useEffect(() => {
    const savedInfo = localStorage.getItem('toko_info');
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        if (parsed.slug) setSlug(parsed.slug);
        if (parsed.nama) setShopName(parsed.nama);
      } catch (e) {
        console.error('Error parsing local toko_info:', e);
      }
    }

    // Immediately set from local store if hydrated
    if (isHydrated && session?.id) {
      setUserId(session.id);
    }

    // Subscribe to auth state dynamically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      const uid = currentSession?.user?.id;
      if (uid) {
        setUserId(uid);
        
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, store_name, slug')
            .eq('id', uid)
            .single();

          if (profile) {
            if (profile.store_name || profile.full_name) {
              setShopName(profile.store_name || profile.full_name || 'Toko Saya');
            }
            if (profile.slug) setSlug(profile.slug);
          }
        } catch (err) {
          console.error('Error fetching profile on auth change:', err);
        }
      }
      setLoading(false);
    });

    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [isHydrated, session]);

  useEffect(() => {
    if (userId && activeTab === 'cloud-products') {
      fetchCloudProducts();
      fetchLocalProducts();
    }
  }, [userId, activeTab]);

  const handleCopy = async () => {
    if (!menuUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(menuUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = menuUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('URL berhasil disalin!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Salin URL berikut:', menuUrl);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl || !menuUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `qr-menu-${shopName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.target = '_blank';
    a.click();
    toast.success('QR Code diunduh!');
  };

  const handleOpenPreview = () => {
    if (!menuUrl) return;
    window.open(menuUrl, '_blank');
  };

  const syncMissingCategories = async (productsToSync: any[]) => {
    const categoryIds = Array.from(new Set(productsToSync.map(p => p.category_id).filter(Boolean)));
    if (categoryIds.length === 0) return;

    try {
      const localCategories = await db.categories.toArray();
      const localCatIds = new Set(localCategories.map(c => c.id));
      const missingCatIds = categoryIds.filter(id => !localCatIds.has(id));

      if (missingCatIds.length > 0) {
        const { data: remoteCats } = await supabase
          .from('categories')
          .select('*')
          .in('id', missingCatIds);
        
        if (remoteCats && remoteCats.length > 0) {
          await db.transaction('rw', db.categories, async () => {
            for (const cat of remoteCats) {
              await db.categories.put({
                id: cat.id,
                user_id: cat.user_id,
                name: cat.name,
                type: cat.type || 'product',
                created_at: cat.created_at,
                updated_at: cat.updated_at,
                deleted_at: cat.deleted_at || null,
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to sync missing categories:', e);
    }
  };

  const handlePullToLocal = async (product: any) => {
    const toastId = toast.loading(`Menarik produk "${product.name}" ke database lokal...`);
    try {
      await syncMissingCategories([product]);

      const localPayload = {
        id: product.id,
        user_id: product.user_id,
        sku: product.sku || '',
        name: product.name,
        category_id: product.category_id || '',
        price_cost: product.price_cost || 0,
        price_sell: product.price_sell || 0,
        image_url: product.image_url || '',
        stock_store: product.stock_store || 0,
        stock_warehouse: product.stock_warehouse || 0,
        note: product.note || '',
        created_at: product.created_at,
        updated_at: product.updated_at,
        deleted_at: product.deleted_at || null,
        sync_status: 'synced' as const
      };

      await db.products.put(localPayload);
      toast.success(`Produk "${product.name}" berhasil disinkronkan ke database lokal!`, { id: toastId });
      fetchLocalProducts();
    } catch (err: any) {
      toast.error(`Gagal menarik produk ke lokal: ${err.message}`, { id: toastId });
    }
  };

  const handlePullAllToLocal = async () => {
    if (cloudProducts.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menarik semua (${cloudProducts.length}) produk cloud ke database lokal perangkat ini? Ini akan memperbarui data lokal yang ada.`)) return;

    const toastId = toast.loading('Menarik semua produk dari Cloud...');
    try {
      await syncMissingCategories(cloudProducts);

      let successCount = 0;
      await db.transaction('rw', db.products, async () => {
        for (const product of cloudProducts) {
          const localPayload = {
            id: product.id,
            user_id: product.user_id,
            sku: product.sku || '',
            name: product.name,
            category_id: product.category_id || '',
            price_cost: product.price_cost || 0,
            price_sell: product.price_sell || 0,
            image_url: product.image_url || '',
            stock_store: product.stock_store || 0,
            stock_warehouse: product.stock_warehouse || 0,
            note: product.note || '',
            created_at: product.created_at,
            updated_at: product.updated_at,
            deleted_at: product.deleted_at || null,
            sync_status: 'synced' as const
          };
          await db.products.put(localPayload);
          successCount++;
        }
      });

      toast.success(`${successCount} produk berhasil disinkronkan ke database lokal!`, { id: toastId });
      fetchLocalProducts();
    } catch (err: any) {
      toast.error(`Gagal menarik semua produk: ${err.message}`, { id: toastId });
    }
  };

  const handleSaveProduct = async (updatedData: any) => {
    if (!userId || !editingProduct) return;
    setIsSaving(true);
    const toastId = toast.loading('Menyimpan perubahan ke Cloud...');
    try {
      const newUpdatedAt = new Date().toISOString();
      
      // 1. Update remote (Supabase)
      const { error: remoteError } = await supabase
        .from('products')
        .update({
          name: updatedData.name,
          sku: updatedData.sku,
          price_sell: Number(updatedData.price_sell),
          stock_store: Number(updatedData.stock_store),
          updated_at: newUpdatedAt
        })
        .eq('id', editingProduct.id)
        .eq('user_id', userId);
      
      if (remoteError) throw remoteError;

      // 2. Update local Dexie (if it exists)
      const localProd = await db.products.get(editingProduct.id);
      if (localProd) {
        await db.products.update(editingProduct.id, {
          name: updatedData.name,
          sku: updatedData.sku,
          price_sell: Number(updatedData.price_sell),
          stock_store: Number(updatedData.stock_store),
          updated_at: newUpdatedAt,
          sync_status: 'synced'
        });
      }

      toast.success('Produk berhasil diperbarui di Cloud!', { id: toastId });
      setEditingProduct(null);
      fetchCloudProducts();
      fetchLocalProducts();
    } catch (err: any) {
      toast.error(`Gagal menyimpan: ${err.message}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!userId) return;
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini dari Menu Digital (Cloud)?')) return;

    const toastId = toast.loading('Menghapus produk dari Cloud...');
    try {
      const deletedAt = new Date().toISOString();
      
      // 1. Soft delete in Supabase
      const { error: remoteError } = await supabase
        .from('products')
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt
        })
        .eq('id', productId)
        .eq('user_id', userId);
      
      if (remoteError) throw remoteError;

      // 2. Soft delete or delete locally in Dexie
      const localProd = await db.products.get(productId);
      if (localProd) {
        await db.products.update(productId, {
          deleted_at: deletedAt,
          updated_at: deletedAt,
          sync_status: 'synced'
        });
      }

      toast.success('Produk berhasil dihapus dari Cloud!', { id: toastId });
      fetchCloudProducts();
      fetchLocalProducts();
    } catch (err: any) {
      toast.error(`Gagal menghapus: ${err.message}`, { id: toastId });
    }
  };

  const getSyncStatus = (cloudProd: any) => {
    const localProd = localProductsMap.get(cloudProd.id);
    if (!localProd) return { label: 'Belum di Lokal', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    
    if (localProd.deleted_at) {
      return { label: 'Terhapus di Lokal', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    }

    const isDifferent = 
      localProd.name !== cloudProd.name ||
      Number(localProd.price_sell) !== Number(cloudProd.price_sell) ||
      Number(localProd.stock_store) !== Number(cloudProd.stock_store) ||
      (localProd.sku || '') !== (cloudProd.sku || '');
      
    if (isDifferent) {
      return { label: 'Ada Perbedaan', color: 'bg-sky-50 text-sky-700 border-sky-200' };
    }
    
    return { label: 'Sinkron', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  const filteredProducts = cloudProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <SettingsLayout title="QR Menu Digital" backUrl="/pengaturan">
      <div className="flex-1 bg-slate-50/50 overflow-y-auto lg:h-[calc(100vh-64px)] pb-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 lg:py-6 min-h-full flex flex-col justify-start">
          
          {/* Tab Selection Navigation */}
          <div className="flex border-b border-slate-200 mb-6 gap-6 shrink-0">
            <button
              onClick={() => setActiveTab('qr')}
              className={cn(
                "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
                activeTab === 'qr'
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <QrCode className="size-4" />
              QR Code & Link
            </button>
            <button
              onClick={() => setActiveTab('cloud-products')}
              className={cn(
                "pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
                activeTab === 'cloud-products'
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              <Database className="size-4" />
              Kelola Etalase Cloud
            </button>
          </div>

          {activeTab === 'qr' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
              
              {/* Left Column: QR Display Card */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="bg-white rounded-lg p-6 lg:p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden flex-1 justify-center min-h-[300px]">
                  <div className="absolute -top-24 -right-24 size-48 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                  
                  <div className="relative z-10">
                    {loading ? (
                      <div className="w-48 h-48 lg:w-56 lg:h-56 bg-slate-50 rounded-lg animate-pulse flex items-center justify-center border border-slate-100">
                        <QrCode className="size-12 text-slate-200" />
                      </div>
                    ) : userId && qrCodeUrl ? (
                      <div className="relative p-2 bg-white rounded-lg border-2 border-slate-50 shadow-sm">
                        <div className="w-44 h-44 lg:w-52 lg:h-52 relative">
                          <img
                            ref={imgRef}
                            src={qrCodeUrl}
                            alt="QR Code Menu"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-200">
                          Scan Me
                        </div>
                      </div>
                    ) : (
                      <div className="w-48 h-48 lg:w-56 lg:h-56 bg-rose-50 rounded-lg flex flex-col items-center justify-center gap-2 border border-rose-100">
                        <QrCode className="size-12 text-rose-300" />
                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Login Required</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 space-y-1 relative z-10">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{shopName}</h2>
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-px w-3 bg-indigo-200" />
                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">Menu Digital</p>
                      <span className="h-px w-3 bg-indigo-200" />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-2 w-full relative z-10 max-w-xs">
                    <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                      <ShieldCheck className="size-4 text-emerald-500" />
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Terverifikasi</span>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                      <Zap className="size-4 text-amber-500" />
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Realtime</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleOpenPreview}
                  className="bg-indigo-600 rounded-lg p-4 text-white shadow-md hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-[0.98]"
                >
                  <div className="size-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <ExternalLink className="size-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-black text-xs uppercase tracking-wider">Pratinjau</h3>
                    <p className="text-[10px] text-indigo-100 font-medium">Lihat menu pelanggan</p>
                  </div>
                </button>
              </div>

              {/* Right Column: Actions & Guide */}
              <div className="lg:col-span-7 flex flex-col gap-4 lg:gap-6">
                
                {/* Cloud Sync Warning/Action Card */}
                <div className={cn(
                  "rounded-xl p-5 border shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                  pendingProducts > 0 
                    ? "bg-amber-50 border-amber-200 text-amber-900" 
                    : "bg-emerald-50/50 border-emerald-100 text-emerald-900"
                )}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn(
                      "size-10 rounded-xl flex items-center justify-center shrink-0 border",
                      pendingProducts > 0 
                        ? "bg-amber-100 border-amber-200 text-amber-600" 
                        : "bg-emerald-100 border-emerald-200 text-emerald-600"
                    )}>
                      {pendingProducts > 0 ? (
                        <AlertTriangle className="size-5 animate-pulse" />
                      ) : (
                        <CheckCircle2 className="size-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status Katalog Cloud</h4>
                      <p className="font-black text-slate-800 text-xs truncate">
                        {pendingProducts > 0 
                          ? `${pendingProducts} Perubahan Belum Diunggah` 
                          : 'Katalog Sudah Sinkron dengan Cloud'}
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold leading-normal mt-0.5 max-w-md">
                        {pendingProducts > 0 
                          ? 'Ada produk baru/perubahan lokal yang belum diunggah. Menu digital pelanggan saat ini mungkin kosong atau tidak lengkap.' 
                          : 'Semua produk terbaru Anda sudah terunggah ke Cloud. Pelanggan dapat melihat menu dengan benar.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleUploadKatalog}
                    disabled={isSyncingKatalog || !userId}
                    className={cn(
                      "h-10 px-4 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0",
                      pendingProducts > 0 
                        ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200" 
                        : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                    )}
                  >
                    {isSyncingKatalog ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Mengunggah...
                      </>
                    ) : (
                      <>
                        <CloudUpload className="size-3.5" />
                        Unggah Katalog
                      </>
                    )}
                  </button>
                </div>

                {/* Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleCopy}
                    disabled={!userId}
                    className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all text-left group active:scale-95 flex items-center gap-4"
                  >
                    <div className={cn(
                      "size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      copied ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                    )}>
                      {copied ? <CheckCircle2 className="size-5" /> : <Copy className="size-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Link Menu</h4>
                      <p className="font-black text-slate-800 uppercase tracking-tight text-xs">{copied ? 'URL Tersalin' : 'Salin URL'}</p>
                    </div>
                  </button>

                  <button
                    onClick={handleDownloadQR}
                    disabled={!userId}
                    className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all text-left group active:scale-95 flex items-center gap-4"
                  >
                    <div className="size-10 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Download className="size-5" />
                    </div>
                    <div>
                      <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">File Gambar</h4>
                      <p className="font-black text-slate-800 uppercase tracking-tight text-xs">Unduh QR Code</p>
                    </div>
                  </button>
                </div>

                {/* Guide Card */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                  <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-800">Panduan Aktivasi</h3>
                    <div className="px-2 py-0.5 bg-white rounded-full border border-slate-200 text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                      Ready to use
                    </div>
                  </div>
                  <div className="p-6 flex-1 overflow-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      {[
                        { step: '01', title: 'Cetak QR', desc: 'Download dan cetak QR Code untuk di meja.' },
                        { step: '02', title: 'Scan HP', desc: 'Pelanggan scan QR dengan HP untuk akses katalog.' },
                        { step: '03', title: 'Pilih Menu', desc: 'Pelanggan memilih menu dan checkout tanpa aplikasi.' },
                        { step: '04', title: 'Terima Order', desc: 'Pesanan masuk otomatis ke Inbox Kasir.' },
                      ].map((item) => (
                        <div key={item.step} className="flex gap-3 group">
                          <span className="text-lg font-black text-indigo-100 group-hover:text-indigo-600 transition-colors leading-none">{item.step}</span>
                          <div>
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight mb-0.5">{item.title}</p>
                            <p className="text-[9px] text-slate-500 font-medium leading-normal">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="px-6 py-3 bg-indigo-50/50 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <Smartphone className="size-3.5 text-indigo-600 shrink-0" />
                      <p className="text-[9px] font-bold text-indigo-700 leading-tight">
                        Meningkatkan efisiensi pemesanan hingga 40% & mengoptimalkan alur kerja staf.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            /* Cloud Products Management Tab */
            <div className="flex flex-col h-full min-h-[500px]">
              <div className="pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-800">Daftar Produk Aktif di Cloud</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Menampilkan {filteredProducts.length} produk di menu digital pelanggan
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePullAllToLocal}
                    disabled={cloudProducts.length === 0}
                    className="h-10 px-4 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm"
                  >
                    <RefreshCw className="size-3.5" />
                    Tarik Semua ke Lokal
                  </button>
                  <button 
                    onClick={() => { fetchCloudProducts(); fetchLocalProducts(); }}
                    className="h-10 w-10 bg-white border border-slate-200 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-50 shadow-sm transition-colors active:scale-95"
                    title="Muat Ulang"
                  >
                    <RefreshCw className="size-4" />
                  </button>
                </div>
              </div>

              <div className="pb-6 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari produk cloud berdasarkan nama atau SKU..."
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                  />
                </div>
              </div>

              <div className="pb-6 flex-1 overflow-y-auto max-h-[calc(100vh-340px)] min-h-[300px]">
                {isLoadingCloud ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="size-8 text-indigo-600 animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Memuat data cloud...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Database className="size-12 text-slate-200 mb-3" />
                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Tidak ada produk ditemukan</p>
                    <p className="text-[10px] font-medium text-slate-400 mt-1 max-w-xs">
                      Pastikan Anda sudah mengunggah produk dari menu "Status Katalog Cloud" di tab sebelah.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map(product => {
                      const syncInfo = getSyncStatus(product);
                      
                      return (
                        <div key={product.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                          <div>
                            <div className="flex items-center gap-3">
                              <div className="size-14 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                {product.image_url ? (
                                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Database className="size-6 text-slate-300" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-black text-slate-800 truncate uppercase tracking-tight">{product.name}</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                  SKU: {product.sku || '-'}
                                </p>
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <span className={cn("px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full border", syncInfo.color)}>
                                    {syncInfo.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-4 grid grid-cols-2 gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100/50">
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Harga Jual</span>
                                <span className="text-xs font-black text-indigo-600 block mt-1">
                                  Rp {product.price_sell.toLocaleString('id-ID')}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Stok Toko</span>
                                <span className={cn(
                                  "text-xs font-black block mt-1",
                                  product.stock_store > 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {product.stock_store} pcs
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button 
                              onClick={() => handlePullToLocal(product)}
                              className={cn(
                                "h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95",
                                syncInfo.label === 'Sinkron'
                                  ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  : "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-100"
                              )}
                            >
                              <RefreshCw className="size-3" />
                              {syncInfo.label === 'Sinkron' ? 'Tarik Lagi' : 'Tarik ke Lokal'}
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => setEditingProduct(product)}
                                className="size-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-colors active:scale-90"
                                title="Edit Produk Cloud"
                              >
                                <Edit className="size-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(product.id)}
                                className="size-8 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 flex items-center justify-center transition-colors active:scale-90"
                                title="Hapus dari Cloud"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Edit Modal Component */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingProduct(null)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Edit className="size-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Edit Produk Cloud</h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Perbarui etalase pelanggan</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingProduct(null)}
                className="size-7 rounded-full bg-white flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleSaveProduct({
                name: formData.get('name') as string,
                sku: formData.get('sku') as string,
                price_sell: Number(formData.get('price_sell')),
                stock_store: Number(formData.get('stock_store')),
              });
            }} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama Produk</label>
                <input 
                  type="text" 
                  name="name" 
                  defaultValue={editingProduct.name} 
                  required
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">SKU</label>
                  <input 
                    type="text" 
                    name="sku" 
                    defaultValue={editingProduct.sku || ''} 
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Stok Toko</label>
                  <input 
                    type="number" 
                    name="stock_store" 
                    defaultValue={editingProduct.stock_store || 0} 
                    required
                    min="0"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Harga Jual (Rp)</label>
                <input 
                  type="number" 
                  name="price_sell" 
                  defaultValue={editingProduct.price_sell || 0} 
                  required
                  min="0"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingProduct(null)}
                  className="h-10 px-4 rounded-lg text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="h-10 px-5 rounded-lg bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SettingsLayout>
  );
}
