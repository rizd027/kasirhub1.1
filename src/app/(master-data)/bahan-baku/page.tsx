'use client';

import { useEffect, useState } from 'react';
import { db, Ingredient } from '@/db/dexie';
import {
  Plus, Search, Trash2, Pencil, Package,
  ChevronLeft, Scale, Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { triggerSync } from '@/hooks/useSync';
import { useStaffStore } from '@/store/useStaffStore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MasterDataTabs } from '@/components/master-data/MasterDataTabs';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { useLiveQuery } from 'dexie-react-hooks';
import { inventoryService, InventoryPrediction } from '@/services/inventoryService';
import { Sparkles, TrendingDown, Loader2 } from 'lucide-react';

export default function IngredientsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { session } = useStaffStore();
  const ingredients = useLiveQuery(() => db.ingredients.toArray()) || [];
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<{ products: Record<string, InventoryPrediction>, ingredients: Record<string, InventoryPrediction> } | null>(null);

  const loadIngredients = async () => {
    // Handled by useLiveQuery
  };

  useEffect(() => {
    const loadPredictions = async () => {
      const data = await inventoryService.getPredictions();
      setPredictions(data);
    };
    loadPredictions();
  }, [ingredients]);

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus bahan baku ini?')) return;
    try {
      const now = new Date().toISOString();
      const ingredient = await db.ingredients.get(id);
      if (!ingredient) return;

      const minimalPayload = {
        id,
        name: ingredient.name,
        unit: ingredient.unit,
        type: ingredient.type,
        cost_per_unit: ingredient.cost_per_unit,
        user_id: session?.id,
        deleted_at: now,
        updated_at: now
      };

      // Queue for cloud delete with minimal payload
      await addToSyncQueue('ingredients', 'delete', id, minimalPayload);

      // Delete locally immediately
      await db.ingredients.delete(id);

      triggerSync().catch(console.error);
      toast.success('Berhasil dihapus');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Gagal menghapus');
    }
  };

  const filteredIngredients = ingredients.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <SettingsLayout
      title="Bahan Baku & Kemasan"
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
              placeholder="Cari nama atau SKU..."
              className="pl-7 h-10 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 placeholder:text-slate-300 font-medium w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => router.push('/bahan-baku/add')}
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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Memuat Bahan Baku...</p>
            </div>
          ) : filteredIngredients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-20 bg-slate-50 rounded-lg flex items-center justify-center mb-4">
                <Utensils className="size-10 text-slate-200" />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Belum ada bahan atau kemasan</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 max-w-[200px]">
                {searchTerm ? 'Tidak ada bahan yang cocok dengan pencarian Anda' : 'Mulai kelola inventaris bahan dan kemasan studio Anda'}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => router.push('/bahan-baku/add')}
                  className="mt-6 h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-lg shadow-lg shadow-indigo-100 gap-2 text-[10px]"
                >
                  <Plus className="size-4" />
                  Tambah Bahan Pertama
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col border-t border-slate-100">
              {filteredIngredients.map((item) => (
                <div
                  key={item.id}
                  className="group relative flex items-center gap-4 p-3 hover:bg-muted/30 border-b border-slate-100"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center border border-slate-100">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <Utensils className="size-6 text-slate-300 group-hover:text-indigo-400" />
                    )}
                    <div className={cn(
                      "absolute top-1 right-1 size-2 rounded-full border-2 border-white dark:border-gray-900",
                      (item.stock_current || 0) <= (item.stock_min || 0) ? "bg-red-500" : "bg-emerald-500"
                    )}></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight truncate uppercase">
                        {item.name}
                      </h3>
                      {item.sku && (
                        <span className="inline-flex items-center gap-1 px-1 py-0.5 rounded bg-muted text-[8px] font-bold text-muted-foreground font-mono">
                          {item.sku.toUpperCase()}
                        </span>
                      )}
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest",
                        item.type === 'packaging' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        {item.type === 'packaging' ? 'Kemasan' : 'Bahan'}
                      </span>
                    </div>

                    <div className="text-[12px] font-bold text-indigo-600 mb-1">
                      Rp {item.cost_per_unit.toLocaleString('id-ID')}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn(
                        "text-[8px] font-black px-1 py-0 uppercase tracking-wider h-3.5 border inline-flex items-center rounded-sm",
                        (item.stock_current || 0) <= (item.stock_min || 0)
                          ? "bg-red-500/10 text-red-600 border-red-500/20"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      )}>
                        STOK: {item.stock_current || 0} {item.unit}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                        ID: {item.id.slice(0, 8).toUpperCase()}
                      </span>
                      {predictions?.ingredients[item.id] && predictions.ingredients[item.id].daysRemaining < 30 && predictions.ingredients[item.id].burnRate > 0 && (
                        <span className={cn(
                          "text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest flex items-center gap-1 border",
                          predictions.ingredients[item.id].status === 'critical' 
                            ? "bg-rose-600 text-white border-rose-700 animate-pulse" 
                            : predictions.ingredients[item.id].status === 'warning'
                            ? "bg-amber-100 text-amber-600 border-amber-200"
                            : "bg-indigo-50 text-indigo-600 border-indigo-100"
                        )}>
                          {predictions.ingredients[item.id].status === 'critical' ? <TrendingDown className="size-2" /> : <Sparkles className="size-2" />}
                          HABIS {Math.ceil(predictions.ingredients[item.id].daysRemaining)} HARI LAGI
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 outline-none"
                      onClick={() => router.push(`/bahan-baku/add?id=${item.id}`)}
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

