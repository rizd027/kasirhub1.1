'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, TransactionItem } from '@/db/dexie';
import { 
  TrendingUp, Users, ShoppingBag, CreditCard, 
  Wallet, Percent, ArrowUpRight, BarChart3, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

export default function SummaryPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTx: 0,
    totalOmzet: 0,
    totalDiskon: 0,
    tunai: 0,
    tempo: 0,
    avgTx: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [maxQty, setMaxQty] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const txs = await db.transactions.toArray();
      
      const totalOmzet = txs.reduce((s, t) => s + t.total_amount, 0);
      const totalDiskon = txs.reduce((s, t) => s + (t.discount_total || 0), 0);
      const tunai = txs.filter(t => t.payment_method === 'cash').reduce((s, t) => s + t.total_amount, 0);
      const tempo = txs.filter(t => t.payment_method === 'tempo').reduce((s, t) => s + t.total_amount, 0);
      const avgTx = txs.length > 0 ? totalOmzet / txs.length : 0;

      setStats({ totalTx: txs.length, totalOmzet, totalDiskon, tunai, tempo, avgTx });

      // Top products
      const productMap = new Map<string, TopProduct>();
      txs.forEach(tx => {
        tx.items.forEach((item: TransactionItem) => {
          const key = item.name_at_time;
          if (!productMap.has(key)) productMap.set(key, { name: item.name_at_time, qty: 0, revenue: 0 });
          const p = productMap.get(key)!;
          p.qty += item.quantity;
          p.revenue += item.price_at_time * item.quantity;
        });
      });
      
      const sorted = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(sorted);
      if (sorted.length > 0) {
        setMaxQty(sorted[0].qty);
      }
      setLoading(false);
    };

    load();
  }, []);

  return (
    <ReportLayout title="Ringkasan Performa">
      <div className="space-y-0 pb-20">
        {/* Key Metrics - High Contrast Grid */}
        <div className="bg-white px-6 py-8 border-b border-slate-200">
           <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] mb-8 border-l-4 border-indigo-600 pl-3">Metrik Utama</h3>
           <div className="grid grid-cols-2 gap-px bg-slate-200 border-2 border-slate-200 rounded-lg overflow-hidden shadow-sm">
              {[
                { label: 'Total Omzet', val: stats.totalOmzet, icon: TrendingUp, color: 'text-emerald-600' },
                { label: 'Total Transaksi', val: stats.totalTx, icon: ShoppingBag, color: 'text-indigo-600', isQty: true },
                { label: 'Avg Per Nota', val: stats.avgTx, icon: Users, color: 'text-amber-600' },
                { label: 'Total Potongan', val: stats.totalDiskon, icon: Percent, color: 'text-red-600' }
              ].map((m) => (
                <div key={m.label} className="bg-white p-6 flex flex-col gap-3">
                   <div className="flex items-center justify-between">
                      <m.icon className={cn("h-4 w-4", m.color)} />
                      <ArrowUpRight className="h-3 w-3 text-slate-300" />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[14px] font-black text-slate-900 leading-none mb-1">
                        {m.isQty ? m.val : `Rp ${m.val.toLocaleString('id-ID')}`}
                      </span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{m.label}</span>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* Payment Distribution */}
        <div className="px-6 py-10 bg-slate-50 border-b-2 border-slate-200">
          <div className="flex items-center gap-3 mb-8">
             <BarChart3 className="h-4 w-4 text-slate-900" />
             <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Distribusi Pembayaran</h3>
          </div>
          
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Tunai / Cash</span>
                  <span className="text-[12px] font-black text-emerald-600">Rp {stats.tunai.toLocaleString('id-ID')}</span>
                </div>
                <span className="text-[10px] font-black text-slate-400">{stats.totalOmzet > 0 ? ((stats.tunai / stats.totalOmzet) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000" 
                  style={{ width: `${stats.totalOmzet > 0 ? (stats.tunai / stats.totalOmzet) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Tempo / Piutang</span>
                  <span className="text-[12px] font-black text-amber-600">Rp {stats.tempo.toLocaleString('id-ID')}</span>
                </div>
                <span className="text-[10px] font-black text-slate-400">{stats.totalOmzet > 0 ? ((stats.tempo / stats.totalOmzet) * 100).toFixed(1) : 0}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                <div 
                  className="h-full bg-amber-500 transition-all duration-1000" 
                  style={{ width: `${stats.totalOmzet > 0 ? (stats.tempo / stats.totalOmzet) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Sellers - Modern List */}
        <div className="bg-white px-6 py-10">
          <div className="flex items-center gap-3 mb-8">
             <Star className="h-4 w-4 text-indigo-600" />
             <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">5 Produk Terlaris</h3>
          </div>

          <div className="divide-y-2 divide-slate-50">
            {topProducts.length === 0 ? (
              <div className="py-12 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Belum ada data transaksi</div>
            ) : (
              topProducts.map((p, i) => (
                <div key={p.name} className="py-6 flex flex-col gap-3 group">
                   <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                         <span className="text-[10px] font-black text-slate-300 mt-1">{i + 1}</span>
                         <div className="flex flex-col">
                            <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1.5 group-hover:text-indigo-600 transition-colors">
                               {p.name}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                               Total Omzet: Rp {p.revenue.toLocaleString('id-ID')}
                            </span>
                         </div>
                      </div>
                      <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                         <span className="text-[10px] font-black text-slate-900 uppercase">{p.qty} UNIT</span>
                      </div>
                   </div>
                   <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600/30 transition-all duration-1000" 
                        style={{ width: `${(p.qty / maxQty) * 100}%` }}
                      />
                   </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="text-center mt-12 mb-20">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em]">Laporan Terkonsolidasi • KasirHub 2026</p>
        </div>
      </div>
    </ReportLayout>
  );
}

