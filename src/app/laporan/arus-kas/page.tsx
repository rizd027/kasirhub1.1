'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalTransaction } from '@/lib/dexie';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Wallet, ArrowDownRight, ArrowUpRight, Search, Receipt, ArrowDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ArusKasPage() {
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [totalMasuk, setTotalMasuk] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.transactions.orderBy('created_at').reverse().toArray().then(txs => {
      const paid = txs.filter(t => t.status === 'paid');
      setTransactions(txs.slice(0, 50));
      setTotalMasuk(paid.reduce((sum, t) => sum + t.total_amount, 0));
      setLoading(false);
    });
  }, []);

  return (
    <ReportLayout title="Laporan Arus Kas">
      <div className="space-y-0">
        {/* Summary Card */}
        <div className="px-6 py-6 bg-white border-b border-slate-100 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Total Saldo Masuk</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-slate-800">
            Rp {totalMasuk.toLocaleString('id-ID')}
          </div>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">
            Akumulasi transaksi lunas & tempo
          </p>
        </div>

        {/* Transaction History */}
        <div className="bg-white pb-10">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-6 py-4 border-b border-slate-100">Aktivitas Terkini</div>
          
          {loading ? (
             <div className="py-20 flex justify-center"><div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : transactions.length === 0 ? (
            <div className="bg-white p-12 flex flex-col items-center text-center gap-3">
              <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
                <Receipt className="h-8 w-8" />
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase">Belum ada aktivitas kas</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="px-6 py-5 border-b border-slate-50 flex items-center gap-4 active:bg-slate-50 transition-colors">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center",
                  tx.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {tx.status === 'paid' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800 truncate">
                    {tx.customer_name || 'Pembeli Umum'}
                  </h4>
                  <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight mt-0.5">
                    {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm', { locale: localeId })} • {tx.payment_method === 'cash' ? 'Tunai' : 'Tempo'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn(
                    "text-sm font-semibold",
                    tx.status === 'paid' ? "text-emerald-600" : "text-amber-600"
                  )}>
                    + Rp {tx.total_amount.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[8px] font-semibold text-slate-300 uppercase tracking-tighter">
                    {tx.status === 'paid' ? 'Lunas' : 'Belum Lunas'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ReportLayout>
  );
}
