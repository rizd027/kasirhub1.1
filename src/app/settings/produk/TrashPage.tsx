'use client';

import { useState } from 'react';
import { db, LocalProduct } from '@/lib/dexie';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Trash2, RotateCcw, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface TrashPageProps {
  deletedProducts: LocalProduct[];
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

export function TrashPage({ deletedProducts, categories, onClose, onSuccess }: TrashPageProps) {
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const getCategoryName = (catId: string) =>
    categories.find(c => c.id === catId)?.name || '';

  const toCurrency = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

  const handleRestore = async (p: LocalProduct) => {
    setRestoring(p.id);
    try {
      await db.products.update(p.id, { deleted_at: undefined });
      toast.success(`"${p.name}" dipulihkan`);
      onSuccess();
    } catch {
      toast.error('Gagal memulihkan produk');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (p: LocalProduct) => {
    setDeleting(p.id);
    try {
      await db.products.delete(p.id);
      toast.success(`"${p.name}" dihapus permanen`);
      onSuccess();
    } catch {
      toast.error('Gagal menghapus produk');
    } finally {
      setDeleting(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm(`Yakin ingin menghapus ${deletedProducts.length} produk secara permanen? Tidak bisa dibatalkan.`)) return;
    try {
      await Promise.all(deletedProducts.map(p => db.products.delete(p.id)));
      toast.success('Tempat sampah dikosongkan');
      onSuccess();
    } catch {
      toast.error('Gagal mengosongkan tempat sampah');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto pb-20">
      <header className="flex items-center h-14 border-b bg-card sticky top-0 z-40 px-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold ml-1">Tempat Sampah</h1>
        {deletedProducts.length > 0 && (
          <Button size="sm" variant="destructive" className="ml-auto mr-2 text-xs" onClick={handleEmptyTrash}>
            Kosongkan
          </Button>
        )}
      </header>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-3">
        {deletedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
            <div className="p-5 rounded-full bg-muted/30">
              <Trash2 className="h-10 w-10 opacity-30" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Tempat sampah kosong</p>
              <p className="text-sm mt-1">Produk yang dihapus akan muncul di sini</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {deletedProducts.length} produk di tempat sampah. Pulihkan sebelum kehilangan data.
              </p>
            </div>

            {deletedProducts.map(p => (
              <div key={p.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.sku}</p>
                    {getCategoryName(p.category_id) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{getCategoryName(p.category_id)}</p>
                    )}
                    <p className="text-sm font-bold text-primary mt-1">{toCurrency(p.price_sell)}</p>
                    {p.deleted_at && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Dihapus: {new Date(p.deleted_at).toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => handleRestore(p)}
                      disabled={restoring === p.id}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {restoring === p.id ? 'Memulihkan...' : 'Pulihkan'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      onClick={() => handlePermanentDelete(p)}
                      disabled={deleting === p.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting === p.id ? 'Menghapus...' : 'Hapus Permanen'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
