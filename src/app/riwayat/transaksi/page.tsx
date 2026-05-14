'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { db, LocalTransaction } from '@/db/dexie';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ReceiptText, CloudOff, CloudCheck, RefreshCw, Trash2, 
  MoreVertical, Download, Printer, ChevronDown, ChevronUp,
  Search, Filter, Calendar, Info, Loader2, Sparkles
} from 'lucide-react';
import { format, isToday, subDays, startOfDay, isAfter } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/services/cloudinary';
import { analyzeImage } from '@/services/aiService';
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
import { supabase } from '@/services/supabase';
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
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Lazy Load (Progressive Rendering) State
  const [visibleCount, setVisibleCount] = useState(20);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, filterStatus, filterDate]);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [transactions, searchQuery, filterStatus, filterDate]);

  const handleVerifyPayment = async (tx: LocalTransaction, file: File) => {
    setVerifyingId(tx.id!);
    try {
      const url = await uploadImage(file);
      const result = await analyzeImage(url, 'verification');
      
      const isMatch = Math.abs(result.amount_detected - tx.total_amount) < 100; // Allow small rounding diff
      
      if (isMatch) {
        toast.success(`VERIFIKASI BERHASIL: Nominal Rp ${result.amount_detected.toLocaleString('id-ID')} sesuai! (Bank: ${result.bank_name})`, {
          duration: 5000
        });
      } else {
        toast.error(`VERIFIKASI GAGAL: Nominal di struk (Rp ${result.amount_detected.toLocaleString('id-ID')}) TIDAK SESUAI dengan tagihan (Rp ${tx.total_amount.toLocaleString('id-ID')}).`, {
          duration: 8000
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memverifikasi bukti bayar');
    } finally {
      setVerifyingId(null);
    }
  };

  const fetchTransactions = useCallback(async () => {
    let query = db.transactions.where('deleted_at').equals('').or('deleted_at').notEqual('').toArray();
    // Dexie doesn't have a simple is-null filter that is indexed easily if not specified.
    // We'll just fetch all and filter in JS if needed, or use the indexed 'deleted_at'.
    // Actually, we'll just use the standard toArray and filter.
    const data = await db.transactions.orderBy('created_at').reverse().toArray();
    setTransactions(data.filter(tx => !tx.deleted_at));
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
    await db.transactions.update(txId, { 
      deleted_at: new Date().toISOString(),
      sync_status: 'pending' 
    });
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
    
    const unsynced = transactions?.filter(t => t.sync_status !== 'synced') || [];
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
      if (filterStatus === 'synced' && tx.sync_status !== 'synced') return false;
      if (filterStatus === 'unsynced' && tx.sync_status === 'synced') return false;

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
        const matchesItems = tx.items?.some(i => i.name_at_time.toLowerCase().includes(q)) || false;
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
      unsynced: acc.unsynced + (tx.sync_status === 'synced' ? 0 : 1)
    }), { total: 0, cash: 0, tempo: 0, unsynced: 0 });
  }, [filteredTransactions]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="sticky top-0 z-50 bg-white shadow-sm">
        <header className="flex items-center justify-between px-6 h-16 bg-background/80 backdrop-blur-md border-b shrink-0">
        <div className="flex-1" />
        <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-800">Riwayat</h1>
        <div className="flex-1 flex justify-end gap-1">
          {session?.role === 'admin' && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="size-9 rounded-lg hover:bg-emerald-50 text-emerald-600" 
                onClick={handleExport}
                title="Ekspor Excel"
              >
                <Download className="h-4 w-4" />
              </Button>

              <Button 
                variant="ghost" 
                size="icon" 
                className="size-9 rounded-lg hover:bg-red-50 text-red-500" 
                onClick={handleClearOld}
                title="Bersihkan Data Lama"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white border-b px-4 pt-1 pb-4 space-y-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <label htmlFor="tx-search" className="sr-only">Cari Transaksi</label>
          <Input 
            id="tx-search"
            name="tx-search"
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
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3 bg-white mx-4 mt-4 rounded-lg border border-dashed border-slate-200">
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
          filteredTransactions.slice(0, visibleCount).map((tx) => {
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
                        {(tx.items?.length || 0)} item pesanan
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
                    
                    {tx.sync_status === 'synced' ? (
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
                        {tx.items && tx.items.length > 0 ? (
                          tx.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs items-center">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-700">{item.name_at_time}</span>
                                <span className="text-[10px] text-slate-400">{item.quantity || 0} x Rp {(item.price_at_time || 0).toLocaleString('id-ID')}</span>
                              </div>
                              <span className="font-semibold text-slate-600">Rp {((item.price_at_time || 0) * (item.quantity || 0)).toLocaleString('id-ID')}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">Rincian item tidak tersedia di lokal</div>
                        )}
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
                        <div className="flex-1 relative">
                          <label htmlFor={`verify-ai-${tx.id}`} className="sr-only">Upload bukti bayar untuk verifikasi AI</label>
                          <input 
                            type="file" 
                            id={`verify-ai-${tx.id}`}
                            name={`verify-ai-${tx.id}`}
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVerifyPayment(tx, file);
                            }}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn(
                              "w-full h-9 rounded-lg font-bold gap-2 text-[10px] uppercase tracking-wider",
                              verifyingId === tx.id
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600 animate-pulse"
                                : "border-emerald-100 text-emerald-600 hover:bg-emerald-50"
                            )}
                            disabled={verifyingId === tx.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById(`verify-ai-${tx.id}`)?.click();
                            }}
                          >
                            {verifyingId === tx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {verifyingId === tx.id ? 'Memverifikasi...' : 'Verifikasi AI'}
                          </Button>
                        </div>
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

        {filteredTransactions && visibleCount < filteredTransactions.length && (
          <div ref={observerTarget} className="py-6 flex justify-center items-center opacity-50">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="ml-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">Memuat...</span>
          </div>
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

