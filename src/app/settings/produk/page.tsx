'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { db, LocalProduct, LocalStockMutation } from '@/lib/dexie';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, Pencil, Trash2, Package, MoreVertical, Store, Warehouse, AlertTriangle, History, Boxes, ChevronLeft, FileUp, FileDown, Printer, FileText, Trash, Settings2, Tag, X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportDialog } from './ImportDialog';
import { BarcodeSheet } from './BarcodeSheet';
import { TrashPage } from './TrashPage';
import { DeleteAllDialog } from './DeleteAllDialog';
import { ThresholdDialog } from './ThresholdDialog';
import * as XLSX from 'xlsx';
import { triggerSync } from '@/hooks/useSync';

export default function ProdukPage() {
  const EMPTY_CATEGORY_VALUE = '__no_category__';
  const router = useRouter();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [stockLogs, setStockLogs] = useState<LocalStockMutation[]>([]);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);
  const [stockEditingProduct, setStockEditingProduct] = useState<LocalProduct | null>(null);
  const [stockDraft, setStockDraft] = useState({ stock_store: 0, stock_warehouse: 0 });
  const [skuTouched, setSkuTouched] = useState(false);

  // Feature panels
  const [showImport, setShowImport] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
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

  // Form state
  const [form, setForm] = useState<Partial<LocalProduct>>({
    name: '', sku: '', price_sell: 0, price_cost: 0, image_url: '', category_id: '', stock_store: 0, stock_warehouse: 0, barcode_type: 'CODE128'
  });
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const fetchData = async () => {
    const [p, c, logs] = await Promise.all([
      db.products.toArray(),
      db.categories.toArray(),
      db.stock_mutations.orderBy('created_at').reverse().toArray()
    ]);
    setProducts(p);
    setCategories(c);
    setStockLogs(logs);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = (p?: LocalProduct) => {
    setIsCreatingCategory(false);
    setNewCategoryName('');
    if (p) {
      setEditingProduct(p);
      setForm({
        ...p,
        category_id: p.category_id ?? '',
      });
    } else {
      setEditingProduct(null);
      setForm({ name: '', sku: '', price_sell: 0, price_cost: 0, image_url: '', category_id: '', stock_store: 0, stock_warehouse: 0 });
    }
    setSkuTouched(false);
    setIsDialogOpen(true);
  };

  const handleOpenStockDialog = (p: LocalProduct) => {
    setStockEditingProduct(p);
    setStockDraft({
      stock_store: p.stock_store,
      stock_warehouse: p.stock_warehouse,
    });
    setIsStockDialogOpen(true);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    const maxSizeInBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      toast.error('Ukuran gambar maksimal 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        image_url: typeof reader.result === 'string' ? reader.result : '',
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name || !form.sku) {
      toast.error('Nama dan SKU wajib diisi!');
      return;
    }
    if (existingSkuConflict) {
      toast.error('SKU sudah terpakai produk lain');
      return;
    }
    if (isCreatingCategory && !newCategoryName.trim()) {
      toast.error('Nama kategori baru wajib diisi!');
      return;
    }

    try {
      let finalCategoryId = form.category_id;

      if (isCreatingCategory && newCategoryName.trim()) {
        const newCat = {
          id: Date.now().toString(),
          name: newCategoryName.trim(),
          icon: 'Tag'
        };
        await db.categories.add(newCat);
        finalCategoryId = newCat.id;
      }

      const data = {
        ...form,
        category_id: finalCategoryId,
        id: editingProduct?.id || Date.now().toString(),
        price_sell: Number(form.price_sell),
        price_cost: Number(form.price_cost),
        stock_store: Number(form.stock_store),
        stock_warehouse: Number(form.stock_warehouse),
      } as LocalProduct;

      if (editingProduct) {
        await db.products.put(data);
        toast.success('Produk diperbarui');
      } else {
        await db.products.add(data);
        toast.success('Produk ditambahkan');
      }
      setIsDialogOpen(false);
      fetchData();
      triggerSync().catch(console.error); // Trigger sync to cloud
    } catch (err) {
      toast.error('Gagal menyimpan produk');
    }
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
    });

    if (nextStore !== prevStore) {
      await db.stock_mutations.add({
        product_id: stockEditingProduct.id,
        type: 'set',
        to_location: 'store',
        qty: Math.abs(nextStore - prevStore),
        note: `Update cepat stok toko (${prevStore} -> ${nextStore})`,
        created_at: now,
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
      });
    }

    toast.success('Stok berhasil diperbarui');
    setIsStockDialogOpen(false);
    fetchData();
    triggerSync().catch(console.error); // Trigger sync to cloud
  };

  const confirmDelete = async (id: string) => {
    try {
      await db.products.update(id, { deleted_at: new Date().toISOString() });
      toast.success('Produk berhasil dihapus');
      fetchData();
      triggerSync().catch(console.error); // Trigger sync to cloud
    } catch (error) {
      toast.error('Gagal menghapus produk');
    }
  };

  const handleDelete = (id: string) => {
    setProductToDelete(id);
    setShowDeleteAlert(true);
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

  const normalizeNumber = (value: string) => Number(value.replace(/\D/g, '') || 0);
  const toCurrency = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
  const existingSkuConflict = products.some((p) => p.sku === form.sku && p.id !== editingProduct?.id && !p.deleted_at);
  const isLossWarning = Number(form.price_sell || 0) < Number(form.price_cost || 0);
  const currentProductLogs = editingProduct
    ? stockLogs.filter((log) => log.product_id === editingProduct.id).slice(0, 6)
    : [];

  const getStockState = (store: number, warehouse: number) => {
    const total = store + warehouse;
    if (total <= 0) return { label: 'Stok Habis', className: 'bg-red-500/10 text-red-600 border-red-500/20' };
    if (total <= stockThreshold) return { label: 'Menipis', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    return { label: 'Aman', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
  };

  return (
    <SettingsLayout
      title="Data Produk"
      rightAction={
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl p-2 shadow-xl border-slate-100">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Data Massal</DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-slate-50" />
              <DropdownMenuItem onClick={() => setShowImport(true)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                <FileUp className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Impor Produk (Excel)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                <FileDown className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Ekspor Produk (Excel)</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1 bg-slate-50" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Utilitas</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShowBarcode(true)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                <Printer className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Cetak Barcode / Label</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintProductList} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                <FileText className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="text-xs font-semibold whitespace-normal leading-tight">Cetak Daftar Produk</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-1 bg-slate-50" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 py-1.5">Pembersihan</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShowTrash(true)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
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
              <DropdownMenuItem onClick={() => setShowThreshold(true)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                <Settings2 className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                <span className="flex-1 text-xs font-semibold whitespace-normal leading-tight">Atur Threshold Stok</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-col">
        {/* Search and Add - Minimalist Underline Style */}
        <div className="px-4 py-2 flex gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Cari nama atau SKU..."
              className="pl-7 h-12 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 w-10 rounded-xl shadow-lg shadow-indigo-100 shrink-0 transition-all active:scale-90"
            onClick={() => handleOpenDialog()}
          >
            <Plus className="h-5 w-5" />
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
            filtered.map((p, idx) => (
              <div
                key={p.id}
                className={cn(
                  "group relative flex items-center gap-4 p-3 hover:bg-muted/30 transition-colors",
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
                  <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight truncate">
                    {p.name}
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
                    <DropdownMenuContent align="end" className="w-44 rounded-xl p-2 shadow-xl border-slate-100">
                      <DropdownMenuItem onClick={() => handleOpenDialog(p)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                        <Pencil className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
                        <span className="text-xs font-semibold whitespace-normal leading-tight">Edit Produk</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenStockDialog(p)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
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
      </div>

      {/* Add/Edit Full Screen */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto pb-12">
          <header className="relative flex items-center justify-between h-14 border-b bg-card sticky top-0 z-40 px-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setIsDialogOpen(false)} className="text-slate-400 z-10">
              <X className="h-5 w-5" />
            </Button>

            <h1 className="absolute inset-0 flex items-center justify-center text-base font-bold pointer-events-none tracking-tight">
              {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
            </h1>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              className={cn(
                "text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-all active:scale-90 z-10",
                existingSkuConflict && "opacity-30 cursor-not-allowed"
              )}
              disabled={existingSkuConflict}
            >
              <Check className="h-6 w-6" />
            </Button>
          </header>
          <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
            <Tabs defaultValue="form" className="pt-2">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="form">Form Produk</TabsTrigger>
                {editingProduct && <TabsTrigger value="history">Riwayat Stok</TabsTrigger>}
              </TabsList>

              <TabsContent value="form" className="pt-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Nama Produk</Label>
                    <Input
                      className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                      placeholder="Contoh: Kopi Susu"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Jenis Barcode</Label>
                    <Select
                      value={form.barcode_type || 'CODE128'}
                      onValueChange={v => setForm({ ...form, barcode_type: v ?? undefined })}
                    >
                      <SelectTrigger className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium shadow-none">
                        <SelectValue placeholder="Pilih Jenis Barcode" />
                      </SelectTrigger>
                      <SelectContent className="w-[300px]" side="bottom" align="start" sideOffset={4}>
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground py-2 px-2 bg-muted/30 mb-1">Ritel & Minimarket</SelectLabel>
                          <SelectItem value="EAN13" className="text-xs">EAN-13 (Standar Indonesia / 13 Digit)</SelectItem>
                          <SelectItem value="EAN8" className="text-xs">EAN-8 (Kemasan Kecil / 8 Digit)</SelectItem>
                          <SelectItem value="UPC" className="text-xs">UPC-A (Standar Internasional / 12 Digit)</SelectItem>
                        </SelectGroup>
                        <SelectGroup className="mt-2">
                          <SelectLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground py-2 px-2 bg-muted/30 mb-1">Logistik & Gudang</SelectLabel>
                          <SelectItem value="CODE128" className="text-xs">Code 128 (Support Huruf & Angka)</SelectItem>
                          <SelectItem value="CODE39" className="text-xs">Code 39 (Alfanumerik Sederhana)</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">SKU</Label>
                    <Input
                      className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium font-mono"
                      placeholder={
                        form.barcode_type === 'EAN13' ? 'Contoh: 8991234567890' :
                          form.barcode_type === 'EAN8' ? 'Contoh: 12345678' :
                            form.barcode_type === 'UPC' ? 'Contoh: 123456789012' :
                              'KPS-001'
                      }
                      value={form.sku}
                      onBlur={() => setSkuTouched(true)}
                      onChange={e => {
                        let val = e.target.value;
                        const bType = form.barcode_type || 'CODE128';
                        const isStrict = ['EAN13', 'EAN8', 'UPC'].includes(bType);

                        if (isStrict) {
                          val = val.replace(/\D/g, ''); // Only numbers
                          if (bType === 'EAN13') val = val.slice(0, 13);
                          if (bType === 'EAN8') val = val.slice(0, 8);
                          if (bType === 'UPC') val = val.slice(0, 12);
                        } else {
                          val = val.toUpperCase();
                        }

                        setForm({ ...form, sku: val });
                      }}
                    />
                    {skuTouched && existingSkuConflict && (
                      <p className="text-xs text-destructive">SKU sudah digunakan produk lain.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Kategori</Label>
                    <Select
                      value={isCreatingCategory ? '__new_category__' : (form.category_id ? form.category_id : EMPTY_CATEGORY_VALUE)}
                      onValueChange={v => {
                        if (v === '__new_category__') {
                          setIsCreatingCategory(true);
                          setForm({ ...form, category_id: '' });
                        } else {
                          setIsCreatingCategory(false);
                          const nextValue = v ?? EMPTY_CATEGORY_VALUE;
                          setForm({ ...form, category_id: nextValue === EMPTY_CATEGORY_VALUE ? '' : nextValue });
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium shadow-none">
                        <SelectValue placeholder="Pilih Kategori" />
                      </SelectTrigger>
                      <SelectContent side="bottom" align="start" sideOffset={4}>
                        <SelectItem value={EMPTY_CATEGORY_VALUE}>Tanpa Kategori</SelectItem>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                        <Separator className="my-1" />
                        <SelectItem value="__new_category__" className="text-primary font-medium">+ Kategori Baru</SelectItem>
                      </SelectContent>
                    </Select>
                    {isCreatingCategory && (
                      <Input
                        className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium mt-2"
                        placeholder="Nama kategori baru..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Harga Jual</Label>
                    <Input
                      inputMode="numeric"
                      className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium text-primary font-bold"
                      placeholder="Rp 0"
                      value={form.price_sell ? toCurrency(Number(form.price_sell)) : ''}
                      onChange={e => setForm({ ...form, price_sell: normalizeNumber(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Harga Modal</Label>
                    <Input
                      inputMode="numeric"
                      className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                      placeholder="Rp 0"
                      value={form.price_cost ? toCurrency(Number(form.price_cost)) : ''}
                      onChange={e => setForm({ ...form, price_cost: normalizeNumber(e.target.value) })}
                    />
                  </div>
                  {isLossWarning && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Harga jual di bawah modal
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Stok Toko</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                      placeholder="0"
                      value={form.stock_store || ''}
                      onChange={e => setForm({ ...form, stock_store: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Stok Gudang</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                      placeholder="0"
                      value={form.stock_warehouse || ''}
                      onChange={e => setForm({ ...form, stock_warehouse: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-4 pt-2 pb-10">
                    <div className="flex items-center justify-between px-1">
                      <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-[0.15em]">Gambar Produk</Label>
                      {form.image_url && (
                        <button
                          onClick={() => setForm(prev => ({ ...prev, image_url: '' }))}
                          className="text-[10px] text-destructive hover:text-destructive/80 transition-colors font-bold uppercase tracking-wider"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <label className="flex flex-col items-center justify-center h-48 w-full cursor-pointer rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/5 transition-all hover:bg-muted/10 hover:border-primary/30 overflow-hidden shadow-sm">
                        {form.image_url ? (
                          <div className="relative h-full w-full flex items-center justify-center p-6">
                            <img src={form.image_url} alt="Preview produk" className="max-h-full max-w-full object-contain drop-shadow-md" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 backdrop-blur-[2px]">
                              <span className="text-white text-[10px] font-bold px-4 py-1.5 bg-black/50 rounded-full border border-white/20">GANTI GAMBAR</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-muted-foreground p-6">
                            <div className="p-3 rounded-full bg-muted/50 text-primary/40">
                              <Package className="h-6 w-6" />
                            </div>
                            <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">PILIH GAMBAR</p>
                          </div>
                        )}
                        <Input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                    </div>
                  </div>

                </div>
              </TabsContent>

              {editingProduct && (
                <TabsContent value="history" className="pt-3">
                  <div className="rounded-lg border overflow-hidden">
                    {currentProductLogs.length === 0 ? (
                      <div className="p-4 text-xs text-muted-foreground">Belum ada riwayat mutasi stok.</div>
                    ) : (
                      currentProductLogs.map((log, idx) => (
                        <div key={log.id ?? idx}>
                          {idx > 0 && <Separator />}
                          <div className="p-3 text-xs space-y-1">
                            <div className="flex items-center gap-2">
                              <History className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{log.note || 'Mutasi stok'}</span>
                            </div>
                            <p className="text-muted-foreground">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      )}

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

      {/* Feature Panels */}
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onSuccess={fetchData}
          existingProducts={products.filter(p => !p.deleted_at)}
          categories={categories}
        />
      )}
      {showBarcode && (
        <BarcodeSheet
          products={products.filter(p => !p.deleted_at)}
          onClose={() => setShowBarcode(false)}
        />
      )}
      {showTrash && (
        <TrashPage
          deletedProducts={deletedProducts}
          categories={categories}
          onClose={() => setShowTrash(false)}
          onSuccess={fetchData}
        />
      )}
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
    </SettingsLayout>
  );
}
