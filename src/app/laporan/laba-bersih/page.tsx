'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, TransactionItem } from '@/db/dexie';
import { TrendingUp, TrendingDown, Info, DollarSign, Calculator, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LabaBersihPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    cogs: 0,
    discounts: 0,
    netProfit: 0,
    margin: 0
  });

  useEffect(() => {
    const calculate = async () => {
      setLoading(true);
      const txs = await db.transactions.toArray();
      const products = await db.products.toArray();
      const productMap = new Map(products.map(p => [p.id, p]));

      let revenue = 0;
      let cogs = 0;
      let discounts = 0;

      txs.forEach(tx => {
        revenue += tx.subtotal;
        discounts += tx.discount_total || 0;
        tx.items.forEach((item: TransactionItem) => {
          // Use historical cost if available, fallback to current
          const cost = item.cost_at_time ?? productMap.get(item.product_id)?.price_cost ?? 0;
          cogs += cost * item.quantity;
        });
      });

      const netProfit = revenue - cogs - discounts;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      setStats({ revenue, cogs, discounts, netProfit, margin });
      setLoading(false);
    };

    calculate();
  }, []);

  return (
    <ReportLayout title="Laba Bersih">
      <div className="space-y-0 pb-20">
        {/* Main Stats - High Contrast */}
        <div className="bg-white">
          <div className="px-6 py-8 border-b border-slate-200">
            <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] mb-8 border-l-4 border-indigo-600 pl-3">Ringkasan Keuangan</h3>
            
            <div className="divide-y-2 divide-slate-100">
              {/* Gross Sales */}
              <div className="py-6 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 text-slate-900 group-hover:text-indigo-600 transition-colors rounded-lg border-2 border-slate-200">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Pendapatan Kotor</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Total Subtotal</span>
                  </div>
                </div>
                <span className="text-base font-black text-slate-900">Rp {stats.revenue.toLocaleString('id-ID')}</span>
              </div>

              {/* COGS */}
              <div className="py-6 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 text-slate-900 group-hover:text-amber-600 transition-colors rounded-lg border-2 border-slate-200">
                    <Calculator className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Beban Pokok (HPP)</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Modal Inventori</span>
                  </div>
                </div>
                <span className="text-base font-black text-slate-900">Rp {stats.cogs.toLocaleString('id-ID')}</span>
              </div>

              {/* Discounts */}
              <div className="py-6 flex justify-between items-center group">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-slate-50 text-slate-900 group-hover:text-red-600 transition-colors rounded-lg border-2 border-slate-200">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Total Diskon</span>
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">Potongan Harga</span>
                  </div>
                </div>
                <span className="text-base font-black text-red-600">-Rp {stats.discounts.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Final Profit Hero */}
          <div className="px-6 py-12 border-b-2 border-slate-200 bg-slate-50 flex flex-col items-center text-center">
             <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mb-4">Laba Bersih Keseluruhan</span>
             <div className={cn(
                "text-6xl font-black tracking-tighter mb-6 transition-all",
                stats.netProfit >= 0 ? "text-emerald-700" : "text-red-700"
              )}>
               Rp {stats.netProfit.toLocaleString('id-ID')}
             </div>
             <div className={cn(
                "px-6 py-2.5 rounded-full text-xs font-black uppercase flex items-center gap-2 border-2 shadow-lg bg-white",
                stats.margin >= 20 ? "text-emerald-700 border-emerald-200" : "text-amber-700 border-amber-200"
              )}>
                {stats.margin >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                Persentase Margin {stats.margin.toFixed(1)}%
              </div>
          </div>
        </div>

        {/* Insight Section */}
        <div className="p-6">
          <div className="p-8 bg-white rounded-lg border-2 border-slate-300 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-[0.08]">
              <Info className="h-28 w-28 -rotate-12 text-slate-900" />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-indigo-600" />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Analisis Performa</h4>
              </div>
              <p className="text-xs font-black text-slate-700 leading-relaxed uppercase tracking-tight max-w-[90%]">
                Laba bersih dihitung dari total pendapatan dikurangi HPP dan diskon. 
                {stats.margin < 15 && " Margin saat ini tergolong rendah, evaluasi kembali biaya modal Anda."}
                {stats.margin >= 15 && " Performa bisnis Anda stabil. Fokus pada efisiensi operasional untuk meningkatkan margin."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ReportLayout>
  );
}

