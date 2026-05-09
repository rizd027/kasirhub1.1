'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, LocalProduct } from '@/db/dexie';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';

export default function TrashPage() {
  const router = useRouter();
  const [deletedProducts, setDeletedProducts] = useState<LocalProduct[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      console.log('[Trash] Fetching deleted products...');
      const [c, allProducts] = await Promise.all([
        db.categories.toArray(),
        db.products.toArray()
      ]);
      
      // Use a more robust filter
      const deleted = allProducts.filter(p => 
        p.deleted_at !== undefined && 
        p.deleted_at !== null && 
        p.deleted_at !== ""
      );
      
      console.log(`[Trash] Found ${deleted.length} deleted products out of ${allProducts.length} total`);
      setDeletedProducts(deleted);
      setCategories(c);
    } catch (error) {
      console.error('[Trash] Failed to fetch data:', error);
      toast.error('Gagal memuat data tempat sampah');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCategoryName = (catId: string) =>
    categories.find(c => c.id === catId)?.name || '';

  const toCurrency = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

  const handleRestore = async (p: LocalProduct) => {
    setRestoring(p.id);
    try {
      const updatedProduct = { 
        ...p,
        deleted_at: null,
        sync_status: 'pending' as const
      };
      
      await db.products.update(p.id, updatedProduct);
      await addToSyncQueue('products', 'update', p.id, updatedProduct);
      
      toast.success(`"${p.name}" dipulihkan`);
      fetchData();
      
      // Trigger sync in background
      triggerSync().catch(console.error);
    } catch (error) {
      console.error('[Trash] Restore failed:', error);
      toast.error('Gagal memulihkan produk');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (p: LocalProduct) => {
    if (!window.confirm(`Hapus "${p.name}" secara permanen? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeleting(p.id);
    try {
      await db.products.delete(p.id);
      await addToSyncQueue('products', 'delete', p.id, { id: p.id });
      
      toast.success(`"${p.name}" dihapus permanen`);
      fetchData();
      
      // Trigger sync in background
      triggerSync().catch(console.error);
    } catch (error) {
      console.error('[Trash] Permanent delete failed:', error);
      toast.error('Gagal menghapus produk');
    } finally {
      setDeleting(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm(`Yakin ingin menghapus ${deletedProducts.length} produk secara permanen? Tidak bisa dibatalkan.`)) return;
    try {
      await Promise.all(deletedProducts.map(async (p) => {
        await db.products.delete(p.id);
        await addToSyncQueue('products', 'delete', p.id, { id: p.id });
      }));
      
      toast.success('Tempat sampah dikosongkan');
      fetchData();
      
      // Trigger sync
      triggerSync().catch(console.error);
    } catch (error) {
      console.error('[Trash] Empty trash failed:', error);
      toast.error('Gagal mengosongkan tempat sampah');
    }
  };

  return (
    <SettingsLayout
      title="Tempat Sampah"
      rightAction={
        deletedProducts.length > 0 && (
          <Button size="sm" variant="destructive" className="text-xs font-bold uppercase tracking-widest rounded-xl" onClick={handleEmptyTrash}>
            <Trash2 className="h-4 w-4 mr-2" />
            Kosongkan
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {deletedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-slate-300">
            <div className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100">
              <Trash2 className="h-12 w-12 opacity-20" />
            </div>
            <div className="text-center">
              <p className="font-black uppercase tracking-widest text-xs">Tempat sampah kosong</p>
              <p className="text-[10px] mt-1 font-bold text-slate-400">Produk yang dihapus akan muncul di sini</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                {deletedProducts.length} produk di tempat sampah. Pulihkan sebelum sinkronisasi permanen.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {deletedProducts.map(p => (
                <div key={p.id} className="group relative flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-100 transition-all shadow-sm">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate mb-0.5">{p.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{p.sku}</span>
                      <span className="text-[10px] font-bold text-slate-400">{toCurrency(p.price_sell)}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                      onClick={() => handleRestore(p)}
                      disabled={restoring === p.id}
                      title="Pulihkan"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      onClick={() => handlePermanentDelete(p)}
                      disabled={deleting === p.id}
                      title="Hapus Permanen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
