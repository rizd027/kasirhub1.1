'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db } from '@/lib/dexie';
import { Trophy, ShoppingBag, TrendingUp, Info, Package, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BestSeller {
  name: string;
  count: number;
  revenue: number;
}

export default function AnalisisTerlarisPage() {
  const [data, setData] = useState<{ products: BestSeller[], categories: BestSeller[] }>({ products: [], categories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateTop = async () => {
      const allTransactions = await db.transactions.toArray();
      const productMap: Record<string, { count: number; revenue: number }> = {};
      
      allTransactions.forEach(tx => {
        tx.items.forEach(item => {
          if (!productMap[item.name]) {
            productMap[item.name] = { count: 0, revenue: 0 };
          }
          productMap[item.name].count += item.quantity;
          productMap[item.name].revenue += item.price * item.quantity;
        });
      });

      const sortedProducts = Object.entries(productMap)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setData({ products: sortedProducts, categories: [] });
      setLoading(false);
    };

    calculateTop();
  }, []);

  return (
    <ReportLayout title="Analisis Produk Terlaris">
      <div className="space-y-0 pb-10">
        {/* Stats Summary */}
        <div className="bg-indigo-600 px-6 py-10 text-white relative overflow-hidden">
          <TrendingUp className="absolute right-[-10px] bottom-[-10px] h-32 w-32 text-white/10 -rotate-12" />
          <div className="relative z-10">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">Produk Champion</h3>
            <div className="mt-2 text-4xl font-semibold leading-tight">
              {data.products[0]?.name || '...'}
            </div>
            <p className="text-[10px] font-semibold opacity-80 mt-2 uppercase tracking-tight">
              Terjual {data.products[0]?.count || 0} kali dengan omzet Rp {(data.products[0]?.revenue || 0).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        <Tabs defaultValue="products" className="w-full gap-0">
          <TabsList className="w-full bg-white border-b border-slate-100 p-0 h-12 flex">
            <TabsTrigger 
              value="products" 
              className="flex-1 rounded-none font-semibold text-[10px] uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600"
            >
              Top 10 Produk
            </TabsTrigger>
            <TabsTrigger 
              value="revenue" 
              className="flex-1 rounded-none font-semibold text-[10px] uppercase tracking-wider border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-slate-50 data-[state=active]:text-indigo-600"
            >
              Top Omzet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-0 bg-white">
            {loading ? (
              <div className="py-20 flex justify-center"><div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : data.products.length === 0 ? (
              <div className="bg-white p-12 flex flex-col items-center text-center gap-3">
                <Package className="h-8 w-8 text-slate-200" />
                <p className="text-xs font-semibold text-slate-400 uppercase">Data belum tersedia</p>
              </div>
            ) : (
              data.products.map((item, idx) => (
                <div key={item.name} className="px-6 py-5 border-b border-slate-50 flex items-center gap-4 active:bg-slate-50 transition-colors">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center font-semibold text-sm shrink-0",
                    idx === 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                  )}>
                    {idx === 0 ? <Trophy className="h-5 w-5" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">{item.name}</h4>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight mt-0.5">Omzet: Rp {item.revenue.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold text-indigo-600">{item.count}</div>
                    <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-tighter">Unit</div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="revenue" className="mt-0 bg-white">
            {loading ? (
              <div className="py-20 flex justify-center"><div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : data.products.length === 0 ? (
              <div className="bg-white p-12 flex flex-col items-center text-center gap-3">
                <DollarSign className="h-8 w-8 text-slate-200" />
                <p className="text-xs font-semibold text-slate-400 uppercase">Data belum tersedia</p>
              </div>
            ) : (
              [...data.products].sort((a, b) => b.revenue - a.revenue).map((item, idx) => (
                <div key={item.name} className="px-6 py-5 border-b border-slate-50 flex items-center gap-4 active:bg-slate-50 transition-colors">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center font-semibold text-sm shrink-0",
                    idx === 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                  )}>
                    {idx === 0 ? <Trophy className="h-5 w-5" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">{item.name}</h4>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight mt-0.5">{item.count} Unit Terjual</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-emerald-600">Rp {item.revenue.toLocaleString('id-ID')}</div>
                    <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-tighter">Omzet</div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 mt-4">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[10px] font-medium text-slate-400 uppercase leading-relaxed tracking-tight">
            Gunakan data ini untuk memprioritaskan stok produk terlaris atau meningkatkan promosi produk yang omzetnya tinggi namun penjualannya rendah.
          </p>
        </div>
      </div>
    </ReportLayout>
  );
}
