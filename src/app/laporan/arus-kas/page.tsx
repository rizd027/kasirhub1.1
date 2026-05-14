'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, LocalTransaction } from '@/db/dexie';
import { format, startOfMonth, endOfMonth, isAfter, isBefore, parseISO, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { 
  Wallet, ArrowDownRight, ArrowUpRight, Search, 
  Receipt, ArrowDownLeft, Clock, Calendar, 
  LayoutGrid, Download, FileText, FileSpreadsheet, FileBox
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportReportPDF, exportReportExcel } from '@/utils/reportExport';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, buttonVariants } from '@/components/ui/button';

export default function ArusKasPage() {
  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [totalMasuk, setTotalMasuk] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<'today' | 'this_month' | 'all'>('this_month');

  useEffect(() => {
    fetchData();
  }, [filterDate]);

  const fetchData = async () => {
    setLoading(true);
    let txs = await db.transactions.orderBy('created_at').reverse().toArray();
    
    // Filter logic
    const now = new Date();
    if (filterDate === 'today') {
      const start = startOfDay(now);
      const end = endOfDay(now);
      txs = txs.filter(t => {
        const d = parseISO(t.created_at);
        return isAfter(d, start) && isBefore(d, end);
      });
    } else if (filterDate === 'this_month') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      txs = txs.filter(t => {
        const d = parseISO(t.created_at);
        return isAfter(d, start) && isBefore(d, end);
      });
    }

    const paid = txs.filter(t => t.status === 'paid');
    setTransactions(txs);
    setTotalMasuk(paid.reduce((sum, t) => sum + t.total_amount, 0));
    setLoading(false);
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Select value={filterDate} onValueChange={(v: any) => setFilterDate(v)}>
        <SelectTrigger className="w-[130px] h-9 rounded-lg bg-slate-50 border-2 border-slate-300 text-[9px] font-black uppercase tracking-widest focus:ring-0 shadow-sm flex items-center px-3">
          <div className="flex items-center gap-2 truncate">
            {filterDate === 'today' && <Clock className="h-3 w-3 text-indigo-600" />}
            {filterDate === 'this_month' && <Calendar className="h-3 w-3 text-indigo-600" />}
            {filterDate === 'all' && <LayoutGrid className="h-3 w-3 text-indigo-600" />}
            <span className="truncate">
              {filterDate === 'today' ? 'Hari Ini' : filterDate === 'this_month' ? 'Bulan Ini' : 'Semua'}
            </span>
          </div>
        </SelectTrigger>
        <SelectContent align="end" className="w-[160px] rounded-lg border-2 border-slate-300 shadow-2xl p-1 animate-none bg-white z-[100]">
          <SelectItem value="today" className="text-[10px] font-black uppercase tracking-widest py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 rounded-lg cursor-pointer outline-none">
            <div className="flex items-center gap-3"><Clock className="h-3.5 w-3.5 opacity-70" /><span>Hari Ini</span></div>
          </SelectItem>
          <SelectItem value="this_month" className="text-[10px] font-black uppercase tracking-widest py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 rounded-lg cursor-pointer outline-none">
            <div className="flex items-center gap-3"><Calendar className="h-3.5 w-3.5 opacity-70" /><span>Bulan Ini</span></div>
          </SelectItem>
          <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest py-2.5 px-3 focus:bg-indigo-50 focus:text-indigo-700 rounded-lg cursor-pointer outline-none">
            <div className="flex items-center gap-3"><LayoutGrid className="h-3.5 w-3.5 opacity-70" /><span>Semua</span></div>
          </SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-9 w-9 rounded-lg border-2 border-slate-300 bg-white text-slate-900 shadow-sm")}>
          <Download className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-lg border-2 border-slate-300 shadow-2xl p-1 animate-none bg-white z-[100]">
          <DropdownMenuItem onClick={exportReportPDF} className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer focus:bg-red-50 focus:text-red-700 outline-none">
            <FileText className="h-4 w-4 text-red-500" /><span className="text-[10px] font-black uppercase tracking-wider">Ekspor PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportReportExcel} className="flex items-center gap-3 py-2.5 px-3 rounded-lg cursor-pointer focus:bg-emerald-50 focus:text-emerald-700 outline-none">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /><span className="text-[10px] font-black uppercase tracking-wider">Ekspor Excel</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <ReportLayout title="Arus Kas" rightElement={headerActions}>
      <div className="space-y-0 pb-20">
        {/* Summary Section - High Contrast & Sharp */}
        <div className="px-4 py-5 lg:px-6 lg:py-6 bg-slate-50/50 border-b-2 border-slate-300 flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] text-slate-500">Total Saldo Masuk</span>
            <div className="h-9 w-9 lg:h-10 lg:w-10 bg-emerald-600 text-white rounded-lg shadow-lg border-2 border-emerald-400 flex items-center justify-center">
              <ArrowDownLeft className="h-4 w-4 lg:h-5 lg:w-5" />
            </div>
          </div>
          <div className="text-2xl lg:text-4xl font-black text-slate-900 tracking-tighter leading-none mb-3 lg:mb-4">
            Rp {totalMasuk.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-2">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
             <p className="text-[8px] lg:text-[9px] font-black text-slate-600 uppercase tracking-widest">
               Akumulasi Transaksi Lunas & Tempo
             </p>
          </div>
        </div>

        {/* Transaction History - High Contrast & Compact List */}
        <div className="bg-white">
          <div className="text-[9px] lg:text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] lg:tracking-[0.4em] px-4 py-4 lg:px-6 lg:py-5 border-b-2 border-slate-100 flex items-center gap-3 bg-slate-50/30">
            <div className="h-2 w-2 rounded-full bg-indigo-600" />
            Aktivitas Terkini
          </div>
          
          {loading ? (
             <div className="py-20 flex justify-center"><div className="h-6 w-6 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : transactions.length === 0 ? (
            <div className="py-32 flex flex-col items-center text-center gap-5">
              <Receipt className="h-12 w-12 text-slate-200" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Belum ada aktivitas kas</p>
            </div>
          ) : (
            <div className="divide-y-2 divide-slate-100 px-2">
              {transactions.map((tx) => (
                <div key={tx.id} className="px-4 py-6 hover:bg-slate-50 flex items-center gap-5">
                  <div className={cn(
                    "h-12 w-12 rounded-lg flex items-center justify-center border-2 shadow-sm shrink-0",
                    tx.status === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                  )}>
                    {tx.status === 'paid' ? <ArrowDownRight className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-2">
                      {tx.customer_name || 'Pembeli Umum'}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {format(new Date(tx.created_at), 'dd MMM, HH:mm', { locale: localeId })}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">
                        {tx.payment_method === 'cash' ? 'TUNAI' : 'TEMPO'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn(
                      "text-[15px] font-black leading-none mb-1.5 tracking-tight",
                      tx.status === 'paid' ? "text-emerald-700" : "text-amber-700"
                    )}>
                      +Rp{tx.total_amount.toLocaleString('id-ID')}
                    </div>
                    <div className={cn(
                      "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border border-current bg-white",
                      tx.status === 'paid' ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"
                    )}>
                      {tx.status === 'paid' ? 'LUNAS' : 'TEMPO'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ReportLayout>
  );
}

