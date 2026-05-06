'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalTransaction } from '@/lib/dexie';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Calendar, ReceiptText, ChevronRight } from 'lucide-react';

interface DailyGroup {
  date: string;
  transactions: LocalTransaction[];
  total: number;
  count: number;
}

export default function RekapHarianPage() {
  const [groups, setGroups] = useState<DailyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.transactions.orderBy('created_at').reverse().toArray().then(txs => {
      const map = new Map<string, LocalTransaction[]>();
      txs.forEach(tx => {
        const day = format(new Date(tx.created_at), 'yyyy-MM-dd');
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(tx);
      });
      const grouped: DailyGroup[] = [];
      map.forEach((txs, date) => {
        grouped.push({
          date,
          transactions: txs,
          total: txs.reduce((s, t) => s + t.total_amount, 0),
          count: txs.length,
        });
      });
      setGroups(grouped);
      setLoading(false);
    });
  }, []);

  return (
    <ReportLayout title="Rekap Penjualan Harian">
      <div className="space-y-0 pb-10">
        {loading ? (
          <div className="py-20 flex justify-center"><div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-100 flex flex-col items-center text-center gap-3">
             <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
              <ReceiptText className="h-8 w-8" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase">Belum ada data penjualan</p>
          </div>
        ) : (
          <div className="bg-white pb-10">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-6 py-4 border-b border-slate-100">Riwayat Penjualan</div>
            {groups.map((g) => (
              <div key={g.date} className="px-6 py-5 border-b border-slate-50 group active:bg-slate-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                      <h4 className="text-sm font-semibold text-slate-800">
                        {format(new Date(g.date), 'EEEE, dd MMMM yyyy', { locale: localeId })}
                      </h4>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight mt-1">
                        {g.count} Transaksi Berhasil
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 mt-1" />
                </div>
                <div className="mt-5 flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Total Omzet</span>
                  <span className="text-xl font-semibold text-indigo-600">
                    Rp {g.total.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
