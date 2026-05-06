'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, LocalTransaction } from '@/lib/dexie';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ReceiptText, CloudOff, CloudCheck, RefreshCw, Trash2, 
  MoreVertical, Download, Printer, ChevronDown, ChevronUp,
  Search, Filter, Calendar, Info
} from 'lucide-react';
import { format, isToday, subDays, startOfDay, isAfter } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReprintModal } from '@/features/cashier/ReprintModal';
import { exportTransactionsToExcel } from '@/utils/excelExport';
import { supabase } from '@/lib/supabase';
import { PinDialog } from '@/components/ui/PinDialog';

import { useStaffStore } from '@/store/useStaffStore';

export default function RiwayatTransaksiPage() {
  const { session } = useStaffStore();
  const [transactions, setTransactions] = useState<LocalTransaction[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'synced' | 'unsynced'>('all');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | '7days' | '30days'>(session?.role === 'staff' ? 'today' : 'all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [reprintData, setReprintData] = useState<LocalTransaction | null>(null);
  const [pinTargetId, setPinTargetId] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    let query = db.transactions.orderBy('created_at').reverse();
    const data = await query.toArray();
    setTransactions(data);
  }, []);

  useEffect(() => {
    fetchTransactions();
    const handleFocus = () => fetchTransactions();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchTransactions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
    toast.success('Data diperbarui');
  };

  const handleDelete = async (txId: string | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!txId) return;

    // Staff ALWAYS needs PIN to delete
    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (session?.role === 'staff' || savedPin) {
      setPinTargetId(txId);
      return;
    }

    if (!confirm('Hapus transaksi ini secara permanen?')) return;
    await performDelete(txId);
  };

  const performDelete = async (txId: string) => {
    await db.transactions.delete(txId);
    await fetchTransactions();
    toast.success('Transaksi dihapus');
    
    // Attempt background sync
    try {
      const { triggerSync } = await import('@/hooks/useSync');
      triggerSync().catch(console.error);
    } catch (e) {}
  };

  const handleBulkSync = async () => {
    if (!navigator.onLine) {
      toast.error('Gagal: Perangkat sedang offline');
      return;
    }
    
    const unsynced = transactions?.filter(t => !t.synced) || [];
    if (unsynced.length === 0) {
      toast.info('Semua data sudah tersinkron');
      return;
    }

    setRefreshing(true);
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          const { triggerSync } = await import('@/hooks/useSync');
          await triggerSync(true);
          await fetchTransactions();
          resolve(true);
        } catch (e) {
          reject(e);
        }
      }),
      {
        loading: 'Menyinkronkan data...',
        success: 'Sinkronisasi selesai',
        error: 'Gagal menyinkronkan data'
      }
    );
    setRefreshing(false);
  };

  const handleExport = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }
    const fileName = `Riwayat_Transaksi_${format(new Date(), 'yyyyMMdd_HHmm')}`;
    exportTransactionsToExcel(filteredTransactions, fileName);
    toast.success('Laporan Excel berhasil diunduh');
  };

  const handleClearOld = async () => {
    if (!confirm('Hapus transaksi yang sudah lebih dari 30 hari?')) return;
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    await db.transactions.where('created_at').below(thirtyDaysAgo).delete();
    await fetchTransactions();
    toast.success('Data lama berhasil dibersihkan');
  };

  const toggleExpand = (id: string) => {
    const newIds = new Set(expandedIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    setExpandedIds(newIds);
  };

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(tx => {
      // Staff Restriction: Only their own transactions
      if (session?.role === 'staff' && tx.employee_id !== session.id) return false;

      // Filter Status
      if (filterStatus === 'synced' && !tx.synced) return false;
      if (filterStatus === 'unsynced' && tx.synced) return false;

      // Filter Date (Staff is locked to today if they select today, but we can allow them to see other days IF they are allowed, 
      // but user said "Filter Riwayat Hari Ini: Melihat daftar nota yang mereka keluarkan pada hari yang sedang berjalan.")
      // We'll enforce "today" for staff if they aren't allowed to see reports.
      const txDate = new Date(tx.created_at);
      if (session?.role === 'staff' && !isToday(txDate)) return false;

      if (filterDate === 'today' && !isToday(txDate)) return false;
      if (filterDate === '7days' && !isAfter(txDate, subDays(new Date(), 7))) return false;
      if (filterDate === '30days' && !isAfter(txDate, subDays(new Date(), 30))) return false;

      // Search Query (ID or Customer or Items)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesId = tx.id?.toString().toLowerCase().includes(q);
        const matchesCustomer = tx.customer_name?.toLowerCase().includes(q);
        const matchesItems = tx.items.some(i => i.name.toLowerCase().includes(q));
        if (!matchesId && !matchesCustomer && !matchesItems) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, filterStatus, filterDate, session]);

  const stats = useMemo(() => {
    if (!filteredTransactions) return { total: 0, cash: 0, tempo: 0, unsynced: 0 };
    return filteredTransactions.reduce((acc, tx) => ({
      total: acc.total + tx.total_amount,
      cash: acc.cash + (tx.payment_method === 'cash' ? tx.total_amount : 0),
      tempo: acc.tempo + (tx.payment_method === 'tempo' ? tx.total_amount : 0),
      unsynced: acc.unsynced + (tx.synced ? 0 : 1)
    }), { total: 0, cash: 0, tempo: 0, unsynced: 0 });
  }, [filteredTransactions]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="sticky top-0 z-50 bg-white shadow-sm">
        <header className="flex items-center justify-between px-6 h-16 bg-background/80 backdrop-blur-md border-b shrink-0">
        <div className="flex-1" />
        <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-800">Riwayat</h1>
        <div className="flex-1 flex justify-end">
          <Button variant="ghost" size="icon" className="size-9 rounded-xl hover:bg-slate-50" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 text-slate-600", refreshing && "animate-spin")} />
          </Button>
          
          {session?.role === 'admin' && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all hover:bg-slate-50 outline-none">
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-2xl p-1 shadow-2xl border-slate-100">
                <div className="px-3 py-2 border-b border-slate-50 mb-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Manajemen</p>
                </div>
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleBulkSync} className="h-10 rounded-xl focus:bg-indigo-50 focus:text-indigo-600">
                    <CloudCheck className="h-4 w-4 mr-2 text-indigo-500" /> Sinkronkan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport} className="h-10 rounded-xl focus:bg-emerald-50 focus:text-emerald-600">
                    <Download className="h-4 w-4 mr-2 text-emerald-500" /> Ekspor Excel
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem 
                  onClick={handleClearOld} 
                  className="h-10 rounded-xl text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Bersihkan Data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white border-b px-4 pt-1 pb-4 space-y-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cari ID, pelanggan, atau produk..."
            className="pl-7 h-12 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <Select value={filterDate} onValueChange={(v: any) => setFilterDate(v)}>
            <SelectTrigger className="h-10 rounded-none bg-transparent border-0 border-b-2 border-slate-100 shadow-none text-xs font-bold flex-1 focus:ring-0 focus:border-indigo-500 transition-all px-0 gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                <SelectValue placeholder="Waktu" />
              </div>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">Semua Waktu</SelectItem>
              <SelectItem value="today">Hari Ini</SelectItem>
              <SelectItem value="7days">7 Hari Terakhir</SelectItem>
              <SelectItem value="30days">30 Hari Terakhir</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
            <SelectTrigger className="h-10 rounded-none bg-transparent border-0 border-b-2 border-slate-100 shadow-none text-xs font-bold flex-1 focus:ring-0 focus:border-indigo-500 transition-all px-0 gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-emerald-500" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="synced">Tersinkron</SelectItem>
              <SelectItem value="unsynced">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Strip */}
      {filteredTransactions.length > 0 && (
        <div className="flex flex-col gap-1 px-4 py-3 bg-indigo-50/50 border-b">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-indigo-400">
            <span>Ringkasan Filter</span>
            <span className="text-slate-400">{filteredTransactions.length} Transaksi</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-slate-800">
              Rp {stats.total.toLocaleString('id-ID')}
            </div>
            <div className="flex gap-3 text-[10px] font-medium">
              <div className="text-emerald-600 flex flex-col items-end">
                <span className="text-[8px] uppercase tracking-tighter opacity-60">Tunai</span>
                Rp {stats.cash.toLocaleString('id-ID')}
              </div>
              <div className="text-amber-600 flex flex-col items-end">
                <span className="text-[8px] uppercase tracking-tighter opacity-60">Tempo</span>
                Rp {stats.tempo.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
          {stats.unsynced > 0 && (
            <div className="flex items-center gap-1.5 mt-1 animate-pulse">
              <Info className="h-3 w-3 text-amber-500" />
              <span className="text-[9px] font-semibold text-amber-600 uppercase tracking-tighter">
                {stats.unsynced} Data belum ter-sinkron ke awan
              </span>
            </div>
          )}
        </div>
      )}
    </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-auto bg-slate-50 flex flex-col gap-2 pb-10">
        {transactions === null ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground bg-white">
            <RefreshCw className="h-6 w-6 animate-spin opacity-40" />
            <span className="text-sm font-semibold">Memuat riwayat...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3 bg-white mx-4 mt-4 rounded-2xl border border-dashed border-slate-200">
            <ReceiptText className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="text-sm font-semibold">Tidak ada data</p>
              <p className="text-[10px] uppercase tracking-widest opacity-60 mt-1">Coba sesuaikan filter Anda</p>
            </div>
            {(searchQuery || filterStatus !== 'all' || filterDate !== 'all') && (
              <Button 
                variant="link" 
                className="text-xs text-indigo-600 font-semibold"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterDate('all');
                }}
              >
                Reset Filter
              </Button>
            )}
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isExpanded = expandedIds.has(tx.id!);
            return (
              <div 
                key={tx.id} 
                className="bg-white border-y border-slate-100 first:border-t-0 transition-all cursor-pointer overflow-hidden"
                onClick={() => toggleExpand(tx.id!)}
              >
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                        {format(new Date(tx.created_at), 'HH:mm', { locale: localeId })}
                      </span>
                      <span className="text-[10px] font-medium text-slate-300">•</span>
                      <span className="text-[10px] font-medium text-slate-400">
                        #{tx.id?.toString().slice(-6)}
                      </span>
                      {tx.customer_name && (
                        <>
                          <span className="text-[10px] font-medium text-slate-300">•</span>
                          <span className="text-[10px] font-semibold text-indigo-500 uppercase truncate">
                            {tx.customer_name}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-base font-semibold text-slate-800">
                      Rp {tx.total_amount.toLocaleString('id-ID')}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400 font-medium italic">
                        {tx.items.length} item pesanan
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={tx.payment_method === 'cash' ? 'default' : 'outline'}
                        className={cn(
                          "text-[9px] px-1.5 h-4 font-semibold uppercase tracking-tighter border-none",
                          tx.payment_method === 'cash' ? "bg-slate-800" : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {tx.payment_method === 'cash' ? 'Tunai' : 'Tempo'}
                      </Badge>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-300" />}
                    </div>
                    
                    {tx.synced ? (
                      <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-semibold uppercase tracking-tighter">
                        <CloudCheck className="h-3 w-3" />
                        Tersinkron
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[9px] text-amber-500 font-semibold uppercase tracking-tighter">
                        <CloudOff className="h-3 w-3" />
                        Offline
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Detail Section */}
                {isExpanded && (
                  <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="border-t border-slate-50 pt-3 space-y-2">
                      <div className="text-[9px] font-semibold text-slate-300 uppercase tracking-[0.2em] mb-2">Detail Transaksi</div>
                      <div className="space-y-1.5">
                        {tx.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs items-center">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-700">{item.name}</span>
                              <span className="text-[10px] text-slate-400">{item.quantity} x Rp {item.price.toLocaleString('id-ID')}</span>
                            </div>
                            <span className="font-semibold text-slate-600">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>

                      {tx.discount_total > 0 && (
                        <div className="flex justify-between text-xs py-2 border-t border-dashed border-slate-100 mt-2">
                          <span className="text-amber-600 font-semibold">Total Diskon</span>
                          <span className="text-amber-600 font-semibold">-Rp {tx.discount_total.toLocaleString('id-ID')}</span>
                        </div>
                      )}

                      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-50">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 h-9 rounded-lg border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-semibold gap-2 text-[10px] uppercase tracking-wider"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReprintData(tx);
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Cetak Ulang
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 p-0"
                          onClick={(e) => handleDelete(tx.id?.toString(), e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Cetak Ulang */}
      <ReprintModal 
        open={!!reprintData}
        onOpenChange={(open) => !open && setReprintData(null)}
        transaction={reprintData}
      />

      {/* PIN Verification for Delete */}
      <PinDialog 
        isOpen={!!pinTargetId}
        onClose={() => setPinTargetId(null)}
        onSuccess={() => {
          if (pinTargetId) performDelete(pinTargetId);
          setPinTargetId(null);
        }}
        title="Hapus Transaksi"
        description="Menghapus riwayat uang masuk memerlukan verifikasi PIN Pemilik."
      />
    </div>
  );
}
