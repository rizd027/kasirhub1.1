'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, Bundling } from '@/db/dexie';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { MasterDataTabs } from '@/components/master-data/MasterDataTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Trash2, Pencil, Boxes, Package } from 'lucide-react';
import { toast } from 'sonner';
import { triggerSync } from '@/hooks/useSync';
import { cn } from '@/lib/utils';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { BundleImageCollage } from '@/components/master-data/BundleImageCollage';
import { useLiveQuery } from 'dexie-react-hooks';
import { useStaffStore } from '@/store/useStaffStore';

export default function BundlingListPage() {
  const router = useRouter();
  const bundles = useLiveQuery(() => db.bundling.toArray()) || [];
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { session } = useStaffStore();

  const fetchBundles = async () => {
    // Handled by useLiveQuery
  };

  useEffect(() => {
    // Handled by useLiveQuery
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus paket bundling ini?')) return;
    try {
      const now = new Date().toISOString();
      const bundle = await db.bundling.get(id);
      if (!bundle) return;

      const minimalPayload = {
        id,
        name: bundle.name,
        price_sell: bundle.price_sell,
        products: bundle.products, // Essential for validation
        user_id: session?.id,
        deleted_at: now,
        updated_at: now
      };

      // Queue the delete with minimal but valid payload
      await addToSyncQueue('bundling', 'delete', id, minimalPayload);

      // Delete locally immediately
      await db.bundling.delete(id);

      triggerSync().catch(console.error);
      toast.success('Paket berhasil dihapus');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Gagal menghapus paket');
    }
  };

  const filteredBundles = bundles.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <SettingsLayout
      title="Bundling Paket"
      subtitle="Manajemen Produk"
      backUrl="/pengaturan"
    >
      <div className="flex flex-col relative z-10">
        <MasterDataTabs />

        {/* Search Bar - Minimalist Underline Style */}
        <div className="px-4 py-4 flex gap-4 items-center border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-[64px] z-20">
          <div className="relative flex-1 group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 size-4 text-slate-300 group-focus-within:text-indigo-500" />
            <Input
              placeholder="Cari nama paket..."
              className="pl-7 h-10 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 placeholder:text-slate-300 font-medium w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => router.push('/paket-bundling/tambah')}
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 gap-2 text-[10px] shrink-0"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {/* List Section */}
        <div className="flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="size-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat Paket...</p>
            </div>
          ) : filteredBundles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-20 bg-slate-50 rounded-lg flex items-center justify-center mb-4">
                <Boxes className="size-10 text-slate-200" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Belum ada paket bundling</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 max-w-[200px]">
                {searchTerm ? 'Tidak ada paket yang cocok dengan pencarian Anda' : 'Buat paket bundling produk untuk mempermudah penjualan paket hemat'}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => router.push('/paket-bundling/tambah')}
                  className="mt-6 h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 gap-2 text-[10px]"
                >
                  <Plus className="size-4" />
                  Tambah Paket Pertama
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col border-t border-slate-100">
              {filteredBundles.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex items-center gap-4 p-3 hover:bg-muted/30 border-b border-slate-100"
                >
                  <div className="relative shrink-0">
                    <BundleImageCollage 
                      productIds={item.products.map(p => p.product_id)} 
                      className="h-14 w-14"
                    />
                    <div className={cn(
                      "absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-white dark:border-gray-900 z-10",
                      item.is_active !== false ? "bg-emerald-500" : "bg-slate-300"
                    )}></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight truncate uppercase">
                        {item.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted text-[8px] font-bold text-muted-foreground font-mono">
                        {item.products.length} PRODUK
                      </span>
                    </div>

                    <div className="text-[12px] font-bold text-indigo-600 mb-1">
                      Rp {item.price_sell.toLocaleString('id-ID')}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn(
                        "text-[8px] font-black px-1 py-0 uppercase tracking-wider h-3.5 border inline-flex items-center rounded-sm",
                        item.is_active !== false
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-600 border-slate-500/20"
                      )}>
                        STATUS: {item.is_active !== false ? 'AKTIF' : 'NON-AKTIF'}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                        ID: {item.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 outline-none"
                      onClick={() => router.push(`/paket-bundling/tambah?id=${item.id}`)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-gray-300 hover:text-red-600 hover:bg-red-50 outline-none"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
}
