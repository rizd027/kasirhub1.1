'use client';

import { useState, useEffect } from 'react';
import { useStaffStore } from '@/store/useStaffStore';
import { db, Category } from '@/db/dexie';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Trash2, Check, Sparkles, Package, Utensils } from 'lucide-react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { MasterDataTabs } from '@/components/master-data/MasterDataTabs';
import { Badge } from '@/components/ui/badge';
import { triggerSync } from '@/hooks/useSync';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function KategoriPage() {
  const { session } = useStaffStore();
  const userId = session?.id;
  const categories = useLiveQuery(() => db.categories.filter(c => !c.deleted_at).toArray()) || [];
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<Category['type']>('product');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    // Categories handled by useLiveQuery
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDuplicate = categories.some(cat =>
      cat.name.toLowerCase() === name.trim().toLowerCase() && cat.id !== editingId
    );
    if (isDuplicate) {
      toast.error('Kategori dengan nama ini sudah ada');
      return;
    }

    try {
      if (editingId) {
        await db.categories.update(editingId, {
          name,
          type,
          sync_status: 'pending'
        });
        const updated = await db.categories.get(editingId);
        if (updated) {
          await addToSyncQueue('categories', 'update', editingId, updated);
        }
        toast.success('Kategori diperbarui');
      } else {
        const id = createId();
        const data = {
          id,
          name,
          type,
          user_id: userId,
          sync_status: 'pending' as const,
          updated_at: new Date().toISOString(),
          deleted_at: null
        };
        await db.categories.add(data);
        await addToSyncQueue('categories', 'insert', id, data);
        toast.success('Kategori ditambahkan');
      }
      setName('');
      setType('product');
      toast.success('Kategori berhasil disimpan');
      setIsDialogOpen(false);
      triggerSync(userId).catch(console.error); // Trigger sync to cloud
    } catch (err) {
      toast.error('Gagal menyimpan kategori');
    }
  };

  const handleEdit = (cat: Category) => {
    setName(cat.name);
    setType(cat.type || 'product');
    setEditingId(cat.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kategori ini?')) return;
    try {
      const deletedAt = new Date().toISOString();
      // 1. Update lokal (Soft Delete)
      await db.categories.update(id, { 
        deleted_at: deletedAt, 
        sync_status: 'pending' 
      });
      
      // 2. Kirim ke antrean sinkronisasi sebagai UPDATE (bukan DELETE)
      await addToSyncQueue('categories', 'update', id, { 
        deleted_at: deletedAt,
        user_id: userId 
      });

      toast.success('Kategori berhasil dihapus');
      triggerSync(userId).catch(console.error); // Trigger sync to cloud
    } catch (err) {
      toast.error('Gagal menghapus kategori');
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      <SettingsLayout
        subtitle="Manajemen Produk"
        title="Daftar Kategori"
        backUrl="/pengaturan"
      >
        <div className="flex flex-col relative z-10">
          <MasterDataTabs />

          {/* Search & Stats Section - Minimalist Underline Style */}
          <section className="px-4 py-4 flex gap-4 items-center border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-[64px] z-20">
            <div className="relative flex-1 group">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500" />
              <Input
                placeholder="Cari kategori..."
                className="pl-7 h-10 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 placeholder:text-slate-300 font-medium w-full"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center shrink-0">
              <Button
                onClick={() => {
                  setEditingId(null);
                  setName('');
                  setType('product');
                  setIsDialogOpen(true);
                }}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 gap-2 text-[10px] shrink-0"
              >
                <Plus className="size-4" />
              </Button>
            </div>

          </section>

          {/* List Section */}
          <section className="flex flex-col min-h-[400px] w-full">
            {filteredCategories.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <div className="relative mb-6">
                  <div className="size-24 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center rotate-3 shadow-sm">
                    <Search className="size-10 text-slate-200 -rotate-3" />
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 size-6 text-indigo-200" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em]">No Categories Found</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    Start by adding your first product category<br />to organize your inventory studio.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col border-t border-slate-100">
                {filteredCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="group relative flex items-center gap-4 p-3 hover:bg-muted/30 border-b border-slate-100"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center">
                      <div className={cn(
                        "h-full w-full flex items-center justify-center text-xl font-black",
                        cat.type === 'ingredient' ? "bg-amber-50 text-amber-600" : 
                        cat.type === 'packaging' ? "bg-emerald-50 text-emerald-600" :
                        "bg-indigo-50 text-indigo-600"
                      )}>
                        {cat.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={cn(
                        "absolute top-1 right-1 size-2 rounded-full border-2 border-white dark:border-gray-900",
                        cat.sync_status === 'synced' ? "bg-emerald-500" : "bg-amber-500"
                      )}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight truncate uppercase">
                        {cat.name}
                      </h3>
                      <div className={cn(
                        "text-[12px] font-bold mb-1",
                        cat.type === 'ingredient' ? "text-amber-600" : 
                        cat.type === 'packaging' ? "text-emerald-600" :
                        "text-indigo-600"
                      )}>
                        {cat.type === 'ingredient' ? 'Bahan Baku' : 
                         cat.type === 'packaging' ? 'Kemasan' : 'Produk'}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted text-[8px] font-bold text-muted-foreground font-mono">
                          {cat.id.slice(0, 8).toUpperCase()}
                        </span>
                        {cat.sync_status === 'synced' ? (
                          <span className="text-[8px] font-black px-1 py-0 uppercase tracking-wider h-3.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 inline-flex items-center">
                            Synced
                          </span>
                        ) : (
                          <span className="text-[8px] font-black px-1 py-0 uppercase tracking-wider h-3.5 bg-amber-500/10 text-amber-600 border-amber-500/20 inline-flex items-center animate-pulse">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 outline-none"
                        onClick={() => handleEdit(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-gray-300 hover:text-red-600 hover:bg-red-50 outline-none"
                        onClick={() => handleDelete(cat.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SettingsLayout>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-lg border-none shadow-2xl p-0 overflow-hidden bg-white">
          <DialogHeader className={cn(
            "px-6 pt-8 pb-4 text-white relative overflow-hidden transition-colors",
            type === 'ingredient' ? "bg-amber-600" : 
            type === 'packaging' ? "bg-emerald-600" :
            "bg-indigo-600"
          )}>
            <div className="relative z-10">
              <DialogTitle className="text-xl font-black uppercase tracking-widest">
                {editingId ? 'Edit Kategori' : 'Kategori Baru'}
              </DialogTitle>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">Studio Management Studio</p>
            </div>
            <Sparkles className="absolute -right-4 -top-4 size-32 text-white/10 rotate-12" />
          </DialogHeader>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Kategori</Label>
                  <div className="relative group">
                    <Input
                      placeholder="Misal: Minuman Dingin..."
                      className="h-14 bg-slate-50 border-none focus:ring-2 focus:ring-indigo-600 rounded-lg text-base font-bold placeholder:text-slate-300"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const productCats = ['Kopi', 'Teh', 'Makanan Berat', 'Snack', 'Minuman Dingin', 'Dessert', 'Roti', 'Salad'];
                        const ingredientCats = ['Tepung', 'Gula', 'Susu', 'Sayuran', 'Daging', 'Bumbu'];
                        const packagingCats = ['Plastik', 'Cup', 'Sedotan', 'Paper Bag', 'Label'];
                        const rand = Math.random();
                        const randomType = rand > 0.66 ? 'product' : rand > 0.33 ? 'ingredient' : 'packaging';
                        
                        const randomName = randomType === 'product' 
                          ? productCats[Math.floor(Math.random() * productCats.length)]
                          : randomType === 'ingredient'
                          ? ingredientCats[Math.floor(Math.random() * ingredientCats.length)]
                          : packagingCats[Math.floor(Math.random() * packagingCats.length)];
                        
                        setName(randomName);
                        setType(randomType);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity hover:scale-110 active:scale-95 cursor-pointer z-10 p-1"
                      title="Generate Random"
                    >
                      <Sparkles className="size-5 text-indigo-600 animate-pulse" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Kategori</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('product')}
                      className={cn(
                        "h-12 rounded-lg flex flex-col items-center justify-center gap-1 border-2 font-black text-[9px] uppercase tracking-widest transition-all",
                        type === 'product'
                          ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Package className="size-4" />
                      Produk
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('ingredient')}
                      className={cn(
                        "h-12 rounded-lg flex flex-col items-center justify-center gap-1 border-2 font-black text-[9px] uppercase tracking-widest transition-all",
                        type === 'ingredient'
                          ? "bg-amber-50 border-amber-600 text-amber-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Utensils className="size-4" />
                      Bahan Baku
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('packaging')}
                      className={cn(
                        "h-12 rounded-lg flex flex-col items-center justify-center gap-1 border-2 font-black text-[9px] uppercase tracking-widest transition-all",
                        type === 'packaging'
                          ? "bg-emerald-50 border-emerald-600 text-emerald-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Package className="size-4" />
                      Kemasan
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 h-14 rounded-lg font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  className={cn(
                    "flex-[2] h-14 text-white rounded-lg font-black uppercase tracking-widest text-[10px] shadow-lg gap-2",
                    type === 'ingredient' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100" :
                    type === 'packaging' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" :
                    "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  {editingId ? <Check className="size-4" /> : <Plus className="size-4" />}
                  {editingId ? 'Simpan' : 'Buat Kategori'}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decorative Background Elements */}
      <div className="fixed -bottom-20 -right-20 opacity-[0.03] pointer-events-none select-none">
        <Sparkles className="size-96 text-indigo-600" />
      </div>
      <div className="fixed -top-20 -left-20 opacity-[0.02] pointer-events-none select-none rotate-45">
        <div className="size-80 rounded-full border-[40px] border-indigo-600" />
      </div>
    </div>
  );
}
