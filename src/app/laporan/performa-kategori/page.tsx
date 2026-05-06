'use client';

import { useEffect, useState, useMemo } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db } from '@/lib/dexie';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { LayoutGrid, Info } from 'lucide-react';

interface CategoryPerf {
  name: string;
  revenue: number;
  count: number;
}

export default function PerformaKategoriPage() {
  const [data, setData] = useState<CategoryPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [allTransactions, categories] = await Promise.all([
        db.transactions.toArray(),
        db.categories.toArray()
      ]);

      const catMap: Record<string, { revenue: number; count: number }> = {};
      
      // Initialize with all categories
      categories.forEach(c => {
        catMap[c.id] = { revenue: 0, count: 0 };
      });
      // For items with no category
      catMap['no_cat'] = { revenue: 0, count: 0 };

      // We need to fetch products to know their category_id
      const products = await db.products.toArray();
      const productToCat: Record<string, string> = {};
      products.forEach(p => {
        productToCat[p.name] = p.category_id || 'no_cat';
      });

      allTransactions.forEach(tx => {
        tx.items.forEach(item => {
          const catId = productToCat[item.name] || 'no_cat';
          if (!catMap[catId]) catMap[catId] = { revenue: 0, count: 0 };
          catMap[catId].revenue += item.price * item.quantity;
          catMap[catId].count += item.quantity;
        });
      });

      const result = Object.entries(catMap)
        .map(([id, stats]) => {
          const catName = id === 'no_cat' ? 'Tanpa Kategori' : (categories.find(c => c.id === id)?.name || 'Unknown');
          return { name: catName, ...stats };
        })
        .filter(c => c.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue);

      setData(result);
      setLoading(false);
    };

    fetchData();
  }, []);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const chartData = useMemo(() => data.map(c => ({ name: c.name, value: c.revenue })), [data]);

  return (
    <ReportLayout title="Performa Kategori">
      <div className="space-y-0 pb-10">
        {/* Visual Section */}
        <div className="bg-white p-6 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-widest mb-4">Proporsi Omzet</h3>
          <div className="h-[240px] w-full">
            {loading ? (
               <div className="h-full w-full flex items-center justify-center"><div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : data.length === 0 ? (
               <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-slate-400 uppercase">Tidak ada data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Omzet']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* List Section */}
        <div className="bg-white pb-10">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-6 py-4 border-b border-slate-100">Rincian Per Kategori</div>
          {data.map((cat, idx) => (
            <div key={cat.name} className="px-6 py-5 border-b border-slate-50 flex items-center gap-4 active:bg-slate-50 transition-colors">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 truncate">{cat.name}</h4>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight mt-0.5">{cat.count} unit terjual</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-slate-800">Rp {cat.revenue.toLocaleString('id-ID')}</div>
                <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-tighter">
                  {((cat.revenue / data.reduce((s, c) => s + c.revenue, 0)) * 100).toFixed(1)}% Kontribusi
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && data.length > 0 && (
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3 mx-4 mb-10">
            <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-indigo-600 uppercase leading-relaxed tracking-tight">
              Kategori <b>{data[0].name}</b> merupakan penyumbang omzet terbesar. Pertimbangkan untuk memperbanyak variasi produk di kategori ini.
            </p>
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
