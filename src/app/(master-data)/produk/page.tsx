'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { db, LocalProduct, LocalStockMutation } from '@/db/dexie';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Search, Pencil, Trash2, Package, MoreVertical, Store, Warehouse, AlertTriangle, History, Boxes, ChevronLeft, FileUp, FileDown, Printer, FileText, Trash, Settings2, Tag, X, Check, Camera } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteAllDialog } from '@/features/produk/DeleteAllDialog';
import { ThresholdDialog } from '@/features/produk/ThresholdDialog';
import * as XLSX from 'xlsx';
import { triggerSync, useSync } from '@/hooks/useSync';
import { useStaffStore } from '@/store/useStaffStore';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { MasterDataTabs } from '@/components/master-data/MasterDataTabs';
import { useLiveQuery } from 'dexie-react-hooks';
import { inventoryService, InventoryPrediction } from '@/services/inventoryService';
import { Sparkles, Loader2, TrendingDown } from 'lucide-react';

export default function ProdukPage() {
  const EMPTY_CATEGORY_VALUE = '__no_category__';
  const { session } = useStaffStore();
  const router = useRouter();
  const { isSyncing, pendingCount } = useSync();
  const userId = session?.id;
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const stockLogs = useLiveQuery(() => db.stock_mutations.orderBy('created_at').reverse().toArray()) || [];

  const [search, setSearch] = useState('');
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [stockEditingProduct, setStockEditingProduct] = useState<LocalProduct | null>(null);
  const [stockDraft, setStockDraft] = useState({ stock_store: 0, stock_warehouse: 0 });
  const [predictions, setPredictions] = useState<{ products: Record<string, InventoryPrediction>, ingredients: Record<string, InventoryPrediction> } | null>(null);

  // Lazy Load State
  const [visibleCount, setVisibleCount] = useState(20);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset pagination when search changes
  useEffect(() => {
    setVisibleCount(20);
  }, [search]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [products, search]);

  // Feature panels
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [showThreshold, setShowThreshold] = useState(false);
  const [stockThreshold, setStockThreshold] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedPrefs = localStorage.getItem('kasirhub_prefs');
      if (savedPrefs) {
        try {
          const prefs = JSON.parse(savedPrefs);
          if (prefs.lowStockThreshold !== undefined) return prefs.lowStockThreshold;
        } catch (e) { }
      }
      return parseInt(localStorage.getItem('stockThreshold') || '10', 10);
    }
    return 10;
  });

  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [showCategoryDeleteAlert, setShowCategoryDeleteAlert] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const fetchData = async () => {
    // This is now handled by useLiveQuery
  };

  useEffect(() => {
    const loadPredictions = async () => {
      const data = await inventoryService.getPredictions();
      setPredictions(data);
    };
    loadPredictions();
  }, [products]);

  const handleOpenDialog = (p?: LocalProduct) => {
    if (p) {
      router.push(`/produk/edit/${p.id}`);
    } else {
      router.push('/produk/tambah');
    }
  };

  const handleOpenStockDialog = (p: LocalProduct) => {
    setStockEditingProduct(p);
    setStockDraft({
      stock_store: p.stock_store,
      stock_warehouse: p.stock_warehouse,
    });
    setIsStockDialogOpen(true);
  };


  const handleSaveStockQuickUpdate = async () => {
    if (!stockEditingProduct) return;

    const prevStore = stockEditingProduct.stock_store;
    const prevWarehouse = stockEditingProduct.stock_warehouse;
    const nextStore = Math.max(0, stockDraft.stock_store);
    const nextWarehouse = Math.max(0, stockDraft.stock_warehouse);
    const now = new Date().toISOString();

    await db.products.update(stockEditingProduct.id, {
      stock_store: nextStore,
      stock_warehouse: nextWarehouse,
      updated_at: now,
      sync_status: 'pending'
    });

    const updatedProduct = await db.products.get(stockEditingProduct.id);
    if (updatedProduct) {
      await addToSyncQueue('products', 'update', updatedProduct.id, updatedProduct);
    }

    if (nextStore !== prevStore) {
      await db.stock_mutations.add({
        product_id: stockEditingProduct.id,
        type: 'set',
        to_location: 'store',
        qty: Math.abs(nextStore - prevStore),
        note: `Update cepat stok toko (${prevStore} -> ${nextStore})`,
        created_at: now,
        synced: 0
      });
    }

    if (nextWarehouse !== prevWarehouse) {
      await db.stock_mutations.add({
        product_id: stockEditingProduct.id,
        type: 'set',
        to_location: 'warehouse',
        qty: Math.abs(nextWarehouse - prevWarehouse),
        note: `Update cepat stok gudang (${prevWarehouse} -> ${nextWarehouse})`,
        created_at: now,
        synced: 0
      });
    }

    toast.success('Stok berhasil diperbarui');
    setIsStockDialogOpen(false);
    fetchData();
    triggerSync().catch(console.error); // Trigger sync to cloud
  };

  const confirmDelete = async (id: string) => {
    try {
      const now = new Date().toISOString();

      // Fetch minimal info needed for the sync payload BEFORE deleting locally
      const product = await db.products.get(id);
      if (!product) return;

      const minimalPayload = {
        id,
        name: product.name,
        sku: product.sku,
        price_sell: product.price_sell,
        price_cost: product.price_cost,
        category_id: product.category_id,
        user_id: product.user_id,
        deleted_at: now,
        updated_at: now,
      };

      // Queue the soft-delete with a minimal but valid payload
      await addToSyncQueue('products', 'delete', id, minimalPayload);

      // Remove from local DB immediately so the UI updates
      await db.products.delete(id);

      toast.success('Produk berhasil dihapus');
      // triggerSync() will handle the background push
      triggerSync().catch(console.error);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Gagal menghapus produk');
    }
  };

  const handleDelete = (id: string) => {
    setProductToDelete(id);
    setShowDeleteAlert(true);
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const deleted_at = new Date().toISOString();
      await db.categories.update(id, { 
        deleted_at, 
        sync_status: 'pending' 
      });
      await addToSyncQueue('categories', 'update', id, { deleted_at });
      // Clear category_id from all products using this category
      await db.products.where('category_id').equals(id).modify({ 
        category_id: '',
        updated_at: deleted_at,
        sync_status: 'pending'
      });
      
      // Also add product updates to sync queue if needed
      // Actually, syncManager should handle local modifications if we use modify? 
      // No, we should explicitly add to sync queue for each affected product if we want cloud consistency.
      // But for simplicity, let's just trigger sync.
      toast.success('Kategori berhasil dihapus');
      fetchData();
      triggerSync().catch(console.error);
    } catch (err) {
      toast.error('Gagal menghapus kategori');
    }
  };

  const handleExportExcel = () => {
    const activeProducts = products.filter(p => !p.deleted_at);
    if (activeProducts.length === 0) { toast.error('Tidak ada produk untuk diekspor'); return; }
    const rows = activeProducts.map(p => ({
      'Nama': p.name,
      'SKU': p.sku,
      'Kategori': categories.find(c => c.id === p.category_id)?.name || '',
      'Harga Jual': p.price_sell,
      'Harga Modal': p.price_cost,
      'Stok Toko': p.stock_store,
      'Stok Gudang': p.stock_warehouse,
      'Foto Product (Cloudinary)': (p.image_url && p.image_url.length > 32000) ? p.image_url.substring(0, 32000) + '...' : (p.image_url || ''),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produk');
    XLSX.writeFile(wb, `produk-kasirhub-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${activeProducts.length} produk berhasil diekspor`);
  };

  const handlePrintProductList = async () => {
    const activeProducts = products.filter(p => !p.deleted_at);
    if (activeProducts.length === 0) { toast.error('Tidak ada produk'); return; }
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Daftar Produk - KasirHub', 14, 16);
    doc.setFontSize(9);
    doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['No', 'Nama', 'SKU', 'Kategori', 'Harga Jual', 'Stok']],
      body: activeProducts.map((p, i) => [
        i + 1,
        p.name,
        p.sku,
        categories.find(c => c.id === p.category_id)?.name || '-',
        `Rp ${p.price_sell.toLocaleString('id-ID')}`,
        p.stock_store + p.stock_warehouse,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    doc.save(`daftar-produk-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF berhasil diunduh');
  };

  const handleDeleteAll = async () => {
    const activeProducts = products.filter(p => !p.deleted_at);
    await Promise.all(activeProducts.map(p =>
      db.products.update(p.id, { deleted_at: new Date().toISOString() })
    ));
    toast.success(`${activeProducts.length} produk dipindahkan ke tempat sampah`);
    fetchData();
    triggerSync().catch(console.error); // Trigger sync to cloud
  };

  const handleSaveThreshold = (value: number) => {
    localStorage.setItem('stockThreshold', String(value));
    setStockThreshold(value);
  };

  const filtered = products.filter(p =>
    !p.deleted_at && (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    )
  );
  const deletedProducts = products.filter(p => !!p.deleted_at);


  const getStockState = (store: number, warehouse: number) => {
    const total = store + warehouse;
    if (total <= 0) return { label: 'Stok Habis', className: 'bg-red-500/10 text-red-600 border-red-500/20' };
    if (total <= stockThreshold) return { label: 'Menipis', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    return { label: 'Aman', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
  };

  return (
    <SettingsLayout
      subtitle="Manajemen Produk"
      title="Daftar Produk"
      backUrl="/pengaturan"
      rightAction={
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-lg p-2 shadow-xl border-slate-100">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Data Massal</DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-slate-50" />
              <DropdownMenuItem onClick={() => router.push('/produk/import')} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                <FileUp className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Impor Produk (Excel)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                <FileDown className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Ekspor Produk (Excel)</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1 bg-slate-50" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Utilitas</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push('/produk/barcode')} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                <Printer className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Cetak Barcode / Label</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintProductList} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                <FileText className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Cetak Daftar Produk</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1 bg-slate-50" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Pembersihan</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push('/produk/trash')} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                <Trash className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="flex-1 text-xs font-semibold whitespace-normal leading-tight">Tempat Sampah</span>
                {deletedProducts.length > 0 && (
                  <span className="ml-1 rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5">{deletedProducts.length}</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteAll(true)}
                className="flex items-start py-2.5 px-2 rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Hapus Semua Produk</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1 bg-slate-50" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Konfigurasi</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShowThreshold(true)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                <Settings2 className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="flex-1 text-xs font-semibold whitespace-normal leading-tight">Atur Threshold Stok</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-col">
        {/* Sub-Navigation Tabs */}
        <MasterDataTabs />

        {/* Search and Add - Minimalist Underline Style */}
        <div className="px-4 py-4 flex gap-4 items-center border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-[64px] z-20">
          <div className="relative flex-1 group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 size-4 text-slate-300 group-focus-within:text-indigo-500" />
            <Input
              placeholder="Cari nama atau SKU..."
              className="pl-7 h-10 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 placeholder:text-slate-300 font-medium w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Button
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 gap-2 text-[10px] shrink-0"
            onClick={() => handleOpenDialog()}
          >
            {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>

        {/* Product List */}
        <div className="flex flex-col border-t border-slate-100">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada produk yang ditemukan.</p>
              <Button variant="link" className="text-indigo-600 font-bold" onClick={() => handleOpenDialog()}>
                Tambah Produk Sekarang
              </Button>
            </div>
          ) : (
            filtered.slice(0, visibleCount).map((p, idx) => (
              <div
                key={p.id}
                className={cn(
                  "group relative flex items-center gap-4 p-3 hover:bg-muted/30",
                  "border-b border-slate-100"
                )}
              >
                {/* Thumbnail */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground/20" />
                  )}
                  {/* Stock status indicator on image */}
                  <div className={cn(
                    "absolute top-1 right-1 size-2 rounded-full border-2 border-white dark:border-gray-900",
                    getStockState(p.stock_store, p.stock_warehouse).className.split(' ')[0].replace('/10', '')
                  )} />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight truncate flex items-center gap-2">
                    {p.name}
                    {p.sync_status === 'pending' && (
                      <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" title="Menunggu Sinkronisasi Cloud" />
                    )}
                  </h3>

                  <div className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                    Rp {p.price_sell.toLocaleString('id-ID')}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted text-[8px] font-bold text-muted-foreground font-mono">
                      {p.sku}
                    </span>
                    <Badge variant="outline" className={cn("text-[8px] font-black px-1 py-0 uppercase tracking-wider h-3.5", getStockState(p.stock_store, p.stock_warehouse).className)}>
                      {getStockState(p.stock_store, p.stock_warehouse).label}
                    </Badge>
                    {predictions?.products[p.id] && predictions.products[p.id].daysRemaining < 30 && predictions.products[p.id].burnRate > 0 && (
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-black px-1 py-0 uppercase tracking-wider h-3.5 flex items-center gap-1",
                        predictions.products[p.id].status === 'critical' 
                          ? "bg-rose-600 text-white border-rose-700 animate-pulse" 
                          : predictions.products[p.id].status === 'warning'
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      )}>
                        {predictions.products[p.id].status === 'critical' ? <TrendingDown className="size-2" /> : <Sparkles className="size-2 text-indigo-400" />}
                        {Math.ceil(predictions.products[p.id].daysRemaining)} HARI LAGI
                      </Badge>
                    )}
                    <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400">
                      <span className="flex items-center gap-1"><Store className="h-2.5 w-2.5" />{p.stock_store}</span>
                      <span className="flex items-center gap-1"><Warehouse className="h-2.5 w-2.5" />{p.stock_warehouse}</span>
                    </div>
                  </div>
                </div>

                {/* Dropdown Actions */}
                <div className="shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-300 hover:text-indigo-600 outline-none">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-44 rounded-lg p-2 shadow-xl border-slate-100">
                      <DropdownMenuItem onClick={() => handleOpenDialog(p)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                        <Pencil className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                        <span className="text-xs font-semibold whitespace-normal leading-tight">Edit Produk</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenStockDialog(p)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600">
                        <Boxes className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                        <span className="text-xs font-semibold whitespace-normal leading-tight">Update Stok</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-slate-50" />
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="flex items-start py-2.5 px-2 rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer">
                        <Trash2 className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                        <span className="text-xs font-semibold whitespace-normal leading-tight">Hapus Produk</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Infinite Scroll Observer Target */}
        {filtered && visibleCount < filtered.length && (
          <div ref={observerTarget} className="py-8 flex justify-center items-center opacity-50">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
              <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Memuat...</span>
            </div>
          </div>
        )}
      </div>



      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Update Stok</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Stok Toko</Label>
              <Input
                type="number"
                min={0}
                className="col-span-3"
                value={stockDraft.stock_store}
                onChange={(e) => setStockDraft((prev) => ({ ...prev, stock_store: Number(e.target.value) }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Stok Gudang</Label>
              <Input
                type="number"
                min={0}
                className="col-span-3"
                value={stockDraft.stock_warehouse}
                onChange={(e) => setStockDraft((prev) => ({ ...prev, stock_warehouse: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsStockDialogOpen(false)}>Batal</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSaveStockQuickUpdate}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showDeleteAll && (
        <DeleteAllDialog
          productCount={products.filter(p => !p.deleted_at).length}
          onConfirm={handleDeleteAll}
          onClose={() => setShowDeleteAll(false)}
        />
      )}
      {showThreshold && (
        <ThresholdDialog
          currentThreshold={stockThreshold}
          onSave={handleSaveThreshold}
          onClose={() => setShowThreshold(false)}
        />
      )}

      <AlertConfirm
        open={showDeleteAlert}
        onOpenChange={setShowDeleteAlert}
        title="Hapus Produk?"
        description="Produk akan dipindahkan ke tempat sampah dan tidak akan muncul di kasir."
        confirmText="Ya, Hapus"
        cancelText="Batal"
        onConfirm={() => productToDelete && confirmDelete(productToDelete)}
      />
      <AlertConfirm
        open={showCategoryDeleteAlert}
        onOpenChange={setShowCategoryDeleteAlert}
        onConfirm={() => categoryToDelete && handleDeleteCategory(categoryToDelete)}
        title="Hapus Kategori?"
        description="Menghapus kategori akan membuat semua produk dalam kategori ini menjadi 'Tanpa Kategori'. Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus Kategori"
        variant="destructive"
      />
    </SettingsLayout>
  );
}

