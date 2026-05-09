'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, Expense } from '@/db/dexie';
import { 
  Plus, Wallet, Calendar, Tag, FileText, 
  Trash2, Search, ArrowDownCircle, History, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';
import { useStaffStore } from '@/store/useStaffStore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const EXPENSE_CATEGORIES = [
  'Operasional',
  'Sewa Tempat',
  'Gaji Karyawan',
  'Listrik & Air',
  'Internet & Pulsa',
  'Pemasaran',
  'Perbaikan',
  'Lain-lain'
];

export default function PengeluaranPage() {
  const { session } = useStaffStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  const [form, setForm] = useState({
    amount: 0,
    category: 'Operasional',
    note: ''
  });

  const loadExpenses = async () => {
    setLoading(true);
    const data = await db.expenses.orderBy('created_at').reverse().toArray();
    setExpenses(data.filter(e => !e.deleted_at));
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSave = async () => {
    if (form.amount <= 0) {
      toast.error('Jumlah pengeluaran harus lebih dari 0');
      return;
    }

    try {
      const id = createId();
      const newExpense: Expense = {
        id,
        user_id: session?.id || '',
        amount: form.amount,
        category: form.category,
        note: form.note,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      };

      await db.expenses.add(newExpense);
      await addToSyncQueue('expenses', 'insert', id, newExpense);
      triggerSync(session?.id).catch(console.error);

      toast.success('Pengeluaran berhasil dicatat');
      setForm({ amount: 0, category: 'Operasional', note: '' });
      setIsAdding(false);
      loadExpenses();
    } catch (err) {
      toast.error('Gagal menyimpan pengeluaran');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus catatan pengeluaran ini?')) return;
    try {
      await db.expenses.update(id, { deleted_at: new Date().toISOString(), sync_status: 'pending' });
      await addToSyncQueue('expenses', 'update', id, { deleted_at: new Date().toISOString() });
      triggerSync(session?.id).catch(console.error);
      toast.success('Berhasil dihapus');
      loadExpenses();
    } catch (err) {
      toast.error('Gagal menghapus');
    }
  };

  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <ReportLayout title="Pengeluaran Kas">
      <div className="flex flex-col min-h-screen bg-slate-50">
        
        {/* Header Stats */}
        <div className="bg-white px-6 py-8 border-b-2 border-slate-200">
           <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Total Pengeluaran</span>
                 <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                   Rp {totalExpense.toLocaleString('id-ID')}
                 </h2>
              </div>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className={cn(
                  "size-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-90",
                  isAdding ? "bg-slate-900 text-white rotate-45" : "bg-indigo-600 text-white"
                )}
              >
                <Plus className="size-6" />
              </button>
           </div>

           {isAdding && (
             <div className="space-y-6 pt-6 border-t-2 border-slate-50 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Jumlah (Rp)</Label>
                      <Input 
                        type="number"
                        placeholder="0"
                        className="h-12 text-lg font-black bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-0"
                        value={form.amount || ''}
                        onChange={e => setForm({...form, amount: Number(e.target.value)})}
                      />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Kategori</Label>
                      <Select value={form.category} onValueChange={v => setForm({...form, category: v || 'Operasional'})}>
                        <SelectTrigger className="h-12 font-black bg-slate-50 border-2 border-slate-200 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map(c => (
                            <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                   </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Catatan</Label>
                   <Input 
                     placeholder="Misal: Bayar listrik bulan Mei"
                     className="h-12 font-bold bg-slate-50 border-2 border-slate-200 rounded-xl"
                     value={form.note}
                     onChange={e => setForm({...form, note: e.target.value})}
                   />
                </div>
                <Button 
                  onClick={handleSave}
                  className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100"
                >
                  Simpan Pengeluaran
                </Button>
             </div>
           )}
        </div>

        {/* Expense List */}
        <div className="flex-1 px-4 py-8">
           <div className="flex items-center gap-3 mb-6 px-2">
              <History className="h-4 w-4 text-slate-900" />
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Riwayat Pengeluaran</h3>
           </div>

           <div className="space-y-3">
              {loading ? (
                <div className="py-20 text-center animate-pulse text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Memuat Data...</div>
              ) : expenses.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                   <Wallet className="size-10 text-slate-200 mx-auto mb-4" />
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada catatan pengeluaran</p>
                </div>
              ) : (
                expenses.map((e) => (
                  <div key={e.id} className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm flex items-center justify-between group">
                     <div className="flex items-center gap-5">
                        <div className="size-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                           <DollarSign className="size-6 text-rose-500" />
                        </div>
                        <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-3">
                              <span className="text-[13px] font-black text-slate-900 uppercase tracking-tight">Rp {e.amount.toLocaleString('id-ID')}</span>
                              <span className="text-[8px] font-black bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full uppercase tracking-widest">{e.category}</span>
                           </div>
                           <p className="text-[10px] font-bold text-slate-400 leading-tight uppercase tracking-wide">
                             {e.note || 'Tanpa catatan'} • {format(new Date(e.created_at), 'dd MMM yyyy', { locale: localeId })}
                           </p>
                        </div>
                     </div>
                     <button 
                       onClick={() => handleDelete(e.id)}
                       className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                     >
                       <Trash2 className="size-4" />
                     </button>
                  </div>
                ))
              )}
           </div>
        </div>

        <div className="p-8 text-center opacity-30">
           <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.5em]">Manajemen Kas v1.0 • KasirHub</p>
        </div>
      </div>
    </ReportLayout>
  );
}
