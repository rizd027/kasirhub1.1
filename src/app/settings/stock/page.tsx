'use client';

import { useEffect, useMemo, useState } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { db, LocalProduct, LocalStockMutation } from '@/lib/dexie';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { toast } from 'sonner';
import {
  Search,
  Package,
  ArrowRightLeft,
  MoreVertical,
  History,
  AlertTriangle,
  Check,
  Download,
  RotateCcw,
  ClipboardList,
  Settings2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type StockDraft = Record<string, { stock_store: number; stock_warehouse: number }>;

export default function StockPage() {
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [logs, setLogs] = useState<LocalStockMutation[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<StockDraft>({});
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [isThresholdDialogOpen, setIsThresholdDialogOpen] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('5');
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);
  const [isStockOpnameOpen, setIsStockOpnameOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [role, setRole] = useState<'owner' | 'admin' | 'kasir' | null>(null);
  const [showResetAlert, setShowResetAlert] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [productToManage, setProductToManage] = useState<LocalProduct | null>(null);

  const fetchProducts = async () => {
    const [data, mutationLogs] = await Promise.all([
      db.products.toArray(),
      db.stock_mutations.orderBy('created_at').reverse().toArray(),
    ]);
    setProducts(data);
    setLogs(mutationLogs);
    const initialDraft: StockDraft = {};
    for (const item of data) {
      initialDraft[item.id] = {
        stock_store: item.stock_store,
        stock_warehouse: item.stock_warehouse,
      };
    }
    setDraft(initialDraft);
  };

  useEffect(() => {
    fetchProducts();
    const savedThreshold = localStorage.getItem('kasirhub_stock_low_threshold');
    if (savedThreshold) {
      setLowStockThreshold(Number(savedThreshold) || 5);
      setThresholdInput(savedThreshold);
    }

    const hydrateRole = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          // If in local mode, default to owner so administrative actions work
          setRole('owner');
          return;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', auth.user.id)
          .maybeSingle();
        if (profile?.role) {
          setRole(profile.role as 'owner' | 'admin' | 'kasir');
        }
      } catch (e) {
        // Fallback for offline/local
        setRole('owner');
      }
    };

    hydrateRole();
  }, []);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.sku.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );

  const updateDraft = (id: string, key: 'stock_store' | 'stock_warehouse', value: number) => {
    setDraft((prev) => ({
      ...prev,
      [id]: {
        stock_store: Math.max(0, key === 'stock_store' ? value : (prev[id]?.stock_store ?? 0)),
        stock_warehouse: Math.max(0, key === 'stock_warehouse' ? value : (prev[id]?.stock_warehouse ?? 0)),
      },
    }));
  };

  const getTotalStock = (item: { stock_store: number; stock_warehouse: number }) =>
    Number(item.stock_store || 0) + Number(item.stock_warehouse || 0);

  const getStockBadge = (item: { stock_store: number; stock_warehouse: number }) => {
    const total = getTotalStock(item);
    if (total <= 0) return { label: 'Habis', className: 'bg-red-500/10 text-red-600 border-red-500/20' };
    if (total <= lowStockThreshold) {
      return { label: 'Menipis', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
    }
    return { label: 'Aman', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
  };

  const getLastUpdated = (productId: string) => logs.find((log) => log.product_id === productId)?.created_at;

  const handleSave = async (item: LocalProduct) => {
    const row = draft[item.id];
    if (!row) return;
    setSavingId(item.id);

    const prevStore = item.stock_store;
    const prevWarehouse = item.stock_warehouse;
    await db.products.update(item.id, {
      stock_store: row.stock_store,
      stock_warehouse: row.stock_warehouse,
    });
    const now = new Date().toISOString();
    if (row.stock_store !== prevStore) {
      await db.stock_mutations.add({
        product_id: item.id,
        type: 'set',
        to_location: 'store',
        qty: Math.abs(row.stock_store - prevStore),
        note: `Penyesuaian stok toko (${prevStore} -> ${row.stock_store})`,
        created_at: now,
        synced: 0
      });
    }
    if (row.stock_warehouse !== prevWarehouse) {
      await db.stock_mutations.add({
        product_id: item.id,
        type: 'set',
        to_location: 'warehouse',
        qty: Math.abs(row.stock_warehouse - prevWarehouse),
        note: `Penyesuaian stok gudang (${prevWarehouse} -> ${row.stock_warehouse})`,
        created_at: now,
        synced: 0
      });
    }
    // Try immediate cloud update for better confidence when account is linked.
    if (navigator.onLine) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        const { error } = await supabase.from('products').upsert(
          {
            sku: item.sku,
            name: item.name,
            price_cost: Number(item.price_cost || 0),
            price_sell: Number(item.price_sell || 0),
            image_url: item.image_url || null,
            stock_store: row.stock_store,
            stock_warehouse: row.stock_warehouse,
          },
          { onConflict: 'sku' }
        );
        if (error) {
          toast.warning('Tersimpan lokal. Sinkron cloud menunggu izin atau koneksi.');
        }
      }
    }

    toast.success(`Stok ${item.name} diperbarui`);
    setSavingId(null);
    setSavedId(item.id);
    setEditingId((prev) => (prev === item.id ? null : prev));
    setTimeout(() => setSavedId((prev) => (prev === item.id ? null : prev)), 1200);
    fetchProducts();
  };

  const handleResetStockItem = async (item: LocalProduct) => {
    await db.products.update(item.id, { stock_store: 0, stock_warehouse: 0 });
    await db.stock_mutations.add({
      product_id: item.id,
      type: 'set',
      qty: Number(item.stock_store || 0) + Number(item.stock_warehouse || 0),
      note: 'Reset stok produk ke 0',
      created_at: new Date().toISOString(),
      synced: 0
    });
    setDraft((prev) => ({
      ...prev,
      [item.id]: { stock_store: 0, stock_warehouse: 0 },
    }));
    toast.success(`Stok ${item.name} direset ke 0`);
    fetchProducts();
  };

  const handleDeleteProduct = async (item: LocalProduct) => {
    await db.products.update(item.id, { deleted_at: new Date().toISOString() });
    toast.success(`Produk ${item.name} dipindahkan ke tempat sampah`);
    fetchProducts();
    const { triggerSync } = await import('@/hooks/useSync');
    triggerSync().catch(console.error);
  };

  const transferStock = async (item: LocalProduct, direction: 'toStore' | 'toWarehouse') => {
    const row = draft[item.id];
    if (!row) return;

    if (direction === 'toStore') {
      if (row.stock_warehouse < 1) {
        toast.error('Stok gudang habis');
        return;
      }
      updateDraft(item.id, 'stock_warehouse', row.stock_warehouse - 1);
      updateDraft(item.id, 'stock_store', row.stock_store + 1);
      await db.stock_mutations.add({
        product_id: item.id,
        type: 'transfer_in',
        from_location: 'warehouse',
        to_location: 'store',
        qty: 1,
        note: 'Mutasi 1 stok dari gudang ke toko',
        created_at: new Date().toISOString(),
        synced: 0
      });
      toast.success('1 stok dipindahkan ke toko');
      return;
    }

    if (row.stock_store < 1) {
      toast.error('Stok toko habis');
      return;
    }
    updateDraft(item.id, 'stock_store', row.stock_store - 1);
    updateDraft(item.id, 'stock_warehouse', row.stock_warehouse + 1);
    await db.stock_mutations.add({
      product_id: item.id,
      type: 'transfer_out',
      from_location: 'store',
      to_location: 'warehouse',
      qty: 1,
      note: 'Mutasi 1 stok dari toko ke gudang',
      created_at: new Date().toISOString(),
      synced: 0
    });
    toast.success('1 stok dipindahkan ke gudang');
  };

  const handleSaveThreshold = () => {
    const parsed = Math.max(0, Number(thresholdInput) || 0);
    setLowStockThreshold(parsed);
    localStorage.setItem('kasirhub_stock_low_threshold', String(parsed));
    toast.success('Batas stok menipis diperbarui');
    setIsThresholdDialogOpen(false);
  };

  const handleExportStockCsv = () => {
    const header = ['SKU', 'Nama', 'Stok Toko', 'Stok Gudang', 'Total'];
    const rows = products.map((p) => [p.sku, p.name, String(p.stock_store), String(p.stock_warehouse), String(getTotalStock(p))]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stok-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Daftar stok berhasil diekspor');
  };

  const handleResetStock = async () => {
    if (role !== 'owner') {
      toast.error('Hanya owner yang bisa reset stok');
      return;
    }
    if (!confirm('Reset semua stok ke 0? Tindakan ini tidak bisa dibatalkan.')) return;
    const now = new Date().toISOString();
    for (const product of products) {
      await db.products.update(product.id, { stock_store: 0, stock_warehouse: 0 });
      await db.stock_mutations.add({
        product_id: product.id,
        type: 'set',
        qty: product.stock_store + product.stock_warehouse,
        note: 'Reset stok periodik ke 0',
        created_at: now,
        synced: 0
      });
    }
    toast.success('Semua stok berhasil direset');
    fetchProducts();
  };

  const handleDeleteAllProducts = async () => {
    if (role !== 'owner') {
      toast.error('Hanya owner yang bisa menghapus inventori');
      return;
    }
    if (!confirm('PERINGATAN: Hapus SEMUA produk dari inventori? Tindakan ini permanen!')) return;
    
    await db.products.clear();
    await db.stock_mutations.clear();
    
    if (navigator.onLine) {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      }
    }
    
    toast.success('Seluruh data inventori telah dihapus');
    fetchProducts();
  };

  const productLogs = historyProductId ? logs.filter((log) => log.product_id === historyProductId).slice(0, 20) : [];

  return (
    <SettingsLayout
      title="Kelola Stock"
      rightAction={
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl p-2 shadow-xl border-slate-100">
            <DropdownMenuItem onClick={() => setIsThresholdDialogOpen(true)} className="flex items-start py-2.5 cursor-pointer">
              <Settings2 className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
              <span className="text-xs font-semibold whitespace-normal leading-tight">Atur Limit Stok Minimum</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsStockOpnameOpen(true)} className="flex items-start py-2.5 cursor-pointer">
              <ClipboardList className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
              <span className="text-xs font-semibold whitespace-normal leading-tight">Mode Stok Opname</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsGlobalHistoryOpen(true)} className="flex items-start py-2.5 cursor-pointer">
              <History className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
              <span className="text-xs font-semibold whitespace-normal leading-tight">Riwayat Mutasi Global</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportStockCsv} className="flex items-start py-2.5 cursor-pointer">
              <Download className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-slate-400" />
              <span className="text-xs font-semibold whitespace-normal leading-tight">Cetak/Export Daftar Stok (CSV)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 bg-slate-50" />
            <DropdownMenuItem onClick={handleResetStock} className="flex items-start py-2.5 cursor-pointer text-amber-600 focus:text-amber-600 focus:bg-amber-50">
              <RotateCcw className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
              <span className="text-xs font-semibold whitespace-normal leading-tight">Reset Semua Stok ke 0</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteAllProducts} className="flex items-start py-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
              <span className="text-xs font-semibold whitespace-normal leading-tight">Hapus Semua Produk (Kosongkan)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="flex flex-col">
        {/* Search Header - Minimalist Underline Style */}
        <div className="px-6 py-2 flex gap-2 bg-background sticky top-0 z-10">
          <div className="relative flex-1 group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <Input
              className="pl-7 h-12 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
              placeholder="Cari nama produk atau SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {/* Stock List */}
        <div className="flex flex-col border-t border-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-slate-50/30">
              <Package className="h-12 w-12 opacity-10 mb-3" />
              <p className="text-sm font-medium">Tidak ada produk yang ditemukan.</p>
            </div>
          ) : (
            filteredProducts.map((item, index) => {
              const row = draft[item.id] ?? {
                stock_store: item.stock_store,
                stock_warehouse: item.stock_warehouse,
              };
              const isEditing = editingId === item.id;
              const stockBadge = getStockBadge(row);
              const totalStock = getTotalStock(row);

              return (
                <div 
                  key={item.id}
                  className={cn(
                    "group flex flex-col transition-all border-b border-slate-100",
                    isEditing ? "bg-indigo-50/40" : "hover:bg-slate-50/50"
                  )}
                >
                  <div className="flex flex-col px-6 py-5 gap-5">
                    {/* Top Row: Identity & Actions */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-14 w-14 shrink-0 rounded-2xl bg-white overflow-hidden flex items-center justify-center border border-slate-100 shadow-sm transition-transform duration-300">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-6 w-6 text-slate-200" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-black text-slate-800 truncate leading-tight mb-1">
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                              {item.sku}
                            </span>
                            <Badge variant="outline" className={cn("text-[8px] font-black h-4 px-1.5 uppercase tracking-[0.1em] border-none shadow-none", stockBadge.className)}>
                              {stockBadge.label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {!isEditing ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-white border border-slate-200 transition-all flex items-center justify-center shadow-sm">
                              <MoreVertical className="h-6 w-6" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-xl p-2 shadow-xl border-slate-100">
                              <DropdownMenuItem onClick={() => setEditingId(item.id)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                                <Pencil className="mr-2 h-4 w-4 mt-0.5 shrink-0 text-indigo-500" />
                                <span className="text-xs font-semibold whitespace-normal leading-tight">Edit Stok</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setHistoryProductId(item.id)} className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 transition-colors">
                                <History className="mr-2 h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                                <span className="text-xs font-semibold whitespace-normal leading-tight">Riwayat Stok</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1 bg-slate-50" />
                              <DropdownMenuItem 
                                onClick={() => {
                                  setProductToManage(item);
                                  setShowResetAlert(true);
                                }} 
                                className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer text-amber-600 focus:text-amber-600 focus:bg-amber-50"
                              >
                                <RotateCcw className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                                <span className="text-xs font-semibold whitespace-normal leading-tight">Reset ke 0</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setProductToManage(item);
                                  setShowDeleteAlert(true);
                                }} 
                                className="flex items-start py-2.5 px-2 rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
                                <span className="text-xs font-semibold whitespace-normal leading-tight">Hapus Permanen</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Button 
                              size="sm" 
                              className={cn(
                                "h-10 px-4 font-black text-xs rounded-xl shadow-lg transition-all active:scale-95",
                                savedId === item.id ? "bg-emerald-600 text-white shadow-emerald-100" : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                              )}
                              disabled={savingId === item.id}
                              onClick={() => handleSave(item)}
                            >
                              {savingId === item.id ? '...' : savedId === item.id ? <Check className="h-3.5 w-3.5" /> : 'SIMPAN'}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-3 font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-red-500 hover:bg-transparent" 
                              onClick={() => setEditingId(null)}
                            >
                              Batal
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Stock Grid (2 Columns) */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Store Stock */}
                      <div className={cn("p-4 rounded-2xl border transition-colors", isEditing ? "bg-white border-indigo-200" : "bg-slate-50 border-slate-100")}>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">JUMLAH DI TOKO</span>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <Input
                              type="number"
                              min={0}
                              className="h-10 text-center font-bold text-lg rounded-xl border-indigo-100 focus-visible:ring-indigo-500 bg-white"
                              value={row.stock_store}
                              onChange={(e) => updateDraft(item.id, 'stock_store', Number(e.target.value))}
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 w-full rounded-lg font-bold text-[8px] uppercase tracking-wider border-indigo-50 text-indigo-400 hover:text-indigo-600 bg-white shadow-none"
                              onClick={() => transferStock(item, 'toWarehouse')}
                            >
                              <ArrowRightLeft className="h-2.5 w-2.5 mr-1.5" />
                              Ke Gudang
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-slate-800">{item.stock_store}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pcs</span>
                          </div>
                        )}
                      </div>

                      {/* Warehouse Stock */}
                      <div className={cn("p-4 rounded-2xl border transition-colors", isEditing ? "bg-white border-indigo-200" : "bg-slate-50 border-slate-100")}>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">JUMLAH DI GUDANG</span>
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <Input
                              type="number"
                              min={0}
                              className="h-10 text-center font-bold text-lg rounded-xl border-indigo-100 focus-visible:ring-indigo-500 bg-white"
                              value={row.stock_warehouse}
                              onChange={(e) => updateDraft(item.id, 'stock_warehouse', Number(e.target.value))}
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 w-full rounded-lg font-bold text-[8px] uppercase tracking-wider border-indigo-50 text-indigo-400 hover:text-indigo-600 bg-white shadow-none"
                              onClick={() => transferStock(item, 'toStore')}
                            >
                              <ArrowRightLeft className="h-2.5 w-2.5 mr-1.5 rotate-180" />
                              Ke Toko
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-slate-800">{item.stock_warehouse}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pcs</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Total & History */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-50 mt-1">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-300">
                         <History className="h-3 w-3" />
                         {getLastUpdated(item.id) ? new Date(getLastUpdated(item.id)!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Belum ada riwayat'}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Total:</span>
                        <span className="text-sm font-black text-indigo-600">{totalStock}</span>
                        <span className="text-[9px] font-black text-indigo-300 uppercase tracking-tighter">PCS</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={isThresholdDialogOpen} onOpenChange={setIsThresholdDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Limit Stok Minimum</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Produk dengan total stok di bawah/ sama dengan limit akan ditandai "Menipis".</p>
            <Input type="number" min={0} value={thresholdInput} onChange={(e) => setThresholdInput(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsThresholdDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSaveThreshold}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyProductId)} onOpenChange={(open) => !open && setHistoryProductId(null)}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Stok Produk</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {productLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada riwayat mutasi untuk produk ini.</p>
            ) : (
              productLogs.map((log) => (
                <div key={log.id} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{log.note || 'Mutasi stok'}</p>
                  <p className="text-muted-foreground">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGlobalHistoryOpen} onOpenChange={setIsGlobalHistoryOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Riwayat Mutasi Global</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {logs.slice(0, 80).map((log) => {
              const p = products.find((x) => x.id === log.product_id);
              return (
                <div key={log.id} className="rounded-md border p-2 text-xs">
                  <p className="font-medium">{p?.name || 'Produk'} ({p?.sku || '-'})</p>
                  <p>{log.note || 'Mutasi stok'} • Qty {log.qty}</p>
                  <p className="text-muted-foreground">{new Date(log.created_at).toLocaleString('id-ID')}</p>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isStockOpnameOpen} onOpenChange={setIsStockOpnameOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Mode Stok Opname</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Ubah stok fisik massal, lalu klik Simpan per produk pada daftar utama.</p>
          <div className="space-y-2">
            {filteredProducts.slice(0, 30).map((item) => {
              const row = draft[item.id] ?? item;
              return (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                  <div className="col-span-6 text-xs">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-muted-foreground font-mono">{item.sku}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    className="col-span-3 h-8"
                    value={row.stock_store}
                    onChange={(e) => updateDraft(item.id, 'stock_store', Number(e.target.value))}
                  />
                  <Input
                    type="number"
                    min={0}
                    className="col-span-3 h-8"
                    value={row.stock_warehouse}
                    onChange={(e) => updateDraft(item.id, 'stock_warehouse', Number(e.target.value))}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsStockOpnameOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertConfirm
        open={showResetAlert}
        onOpenChange={setShowResetAlert}
        title="Reset Stok ke 0?"
        description={`Angka stok untuk "${productToManage?.name}" akan dihapus (0). Produk tidak akan dihapus dari sistem.`}
        confirmText="Ya, Reset"
        cancelText="Batal"
        onConfirm={() => {
          if (productToManage) handleResetStockItem(productToManage);
          setShowResetAlert(false);
        }}
      />
      <AlertConfirm
        open={showDeleteAlert}
        onOpenChange={setShowDeleteAlert}
        title="Hapus Produk Permanen?"
        description={`"${productToManage?.name}" akan dihapus selamanya dari database. Tindakan ini tidak bisa dibatalkan.`}
        confirmText="Ya, Hapus Permanen"
        cancelText="Batal"
        variant="destructive"
        onConfirm={() => {
          if (productToManage) handleDeleteProduct(productToManage);
          setShowDeleteAlert(false);
        }}
      />
    </SettingsLayout>
  );
}
