'use client';

import { useEffect, useState } from 'react';
import { ReportLayout } from '@/features/reports/ReportLayout';
import { db, Expense } from '@/db/dexie';
import { 
  Plus, Wallet, Calendar, Tag, FileText, 
  Trash2, Search, ArrowDownCircle, History, DollarSign,
  LayoutGrid, Camera, Sparkles, Loader2
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
import { uploadImage } from '@/services/cloudinary';
import { analyzeImage, aiToast } from '@/services/aiService';
import { MediaUploader } from '@/components/ui/MediaUploader';

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
    note: '',
    receipt_url: ''
  });
  const [uploading, setUploading] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  const KEYWORD_MAP: Record<string, string> = {
    'listrik': 'Listrik & Air',
    'pln': 'Listrik & Air',
    'pdam': 'Listrik & Air',
    'internet': 'Internet & Pulsa',
    'wifi': 'Internet & Pulsa',
    'pulsa': 'Internet & Pulsa',
    'gaji': 'Gaji Karyawan',
    'upah': 'Gaji Karyawan',
    'sewa': 'Sewa Tempat',
    'kontrak': 'Sewa Tempat',
    'iklan': 'Pemasaran',
    'ads': 'Pemasaran',
    'sosmed': 'Pemasaran',
    'perbaikan': 'Perbaikan',
    'servis': 'Perbaikan',
    'renovasi': 'Perbaikan',
    'operasional': 'Operasional',
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement> | string) => {
    let file: File | string;
    if (typeof e === 'string') {
      file = e;
    } else {
      const f = e.target.files?.[0];
      if (!f) return;
      file = f;
    }

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm(prev => ({ ...prev, receipt_url: url }));
      setUploading(false);
      setIsIdentifying(true);
      
      const data = await analyzeImage(url, 'expense');
      
      setForm(prev => ({
        ...prev,
        amount: data.total_amount || 0,
        category: EXPENSE_CATEGORIES.includes(data.category) ? data.category : 'Operasional',
        note: data.note || ''
      }));
      
      setAiFields(prev => new Set(['amount', 'category', 'note']));
      aiToast.success('AI berhasil memindai struk!');
    } catch (err: any) {
      aiToast.error(err.message || 'Gagal memindai struk');
    } finally {
      setUploading(false);
      setIsIdentifying(false);
    }
  };

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
        deleted_at: null,
        sync_status: 'pending'
      };

      await db.expenses.add(newExpense);
      await addToSyncQueue('expenses', 'insert', id, newExpense);
      triggerSync(session?.id).catch(console.error);

      toast.success('Pengeluaran berhasil dicatat');
      setForm({ amount: 0, category: 'Operasional', note: '', receipt_url: '' });
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
                  "size-12 rounded-lg flex items-center justify-center transition-all shadow-lg active:scale-90",
                  isAdding ? "bg-slate-900 text-white rotate-45" : "bg-indigo-600 text-white"
                )}
              >
                <Plus className="size-6" />
              </button>
           </div>

           {isAdding && (
             <div className="space-y-6 pt-6 border-t-2 border-slate-50 animate-in fade-in slide-in-from-top-4 duration-300">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Unggah Struk (AI Scan)</Label>
                        <div className="h-40">
                          <MediaUploader 
                            imageUrl={form.receipt_url}
                            onUpload={handleReceiptUpload}
                            onRemove={() => setForm({ ...form, receipt_url: '' })}
                            isIdentifying={isIdentifying}
                            modeLabel="Struk"
                          />
                        </div>
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Jumlah (Rp)</Label>
                      <Input 
                        type="number"
                        placeholder="0"
                        className="h-12 text-lg font-black bg-slate-50 border-2 border-slate-200 rounded-lg focus:border-indigo-600 focus:ring-0"
                        value={form.amount || ''}
                        onChange={e => setForm({...form, amount: Number(e.target.value)})}
                      />
                   </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Kategori</Label>
                       <Select value={form.category} onValueChange={v => {
                         setForm({...form, category: v || 'Operasional'});
                         setAiFields(prev => {
                           const next = new Set(prev);
                           next.delete('category');
                           return next;
                         });
                       }}>
                         <SelectTrigger className="relative h-12 font-black bg-slate-50 border-2 border-slate-200 rounded-lg">
                           <SelectValue />
                           {aiFields.has('category') && (
                             <Sparkles className="absolute right-10 top-1/2 -translate-y-1/2 size-4 text-indigo-500 animate-pulse" />
                           )}
                         </SelectTrigger>
                         <SelectContent>
                           {EXPENSE_CATEGORIES.map(c => (
                             <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Catatan</Label>
                       <Input 
                         placeholder="Misal: Bayar listrik bulan Mei"
                         className="h-12 font-bold bg-slate-50 border-2 border-slate-200 rounded-lg"
                        value={form.note}
                        onChange={e => {
                          const note = e.target.value;
                          const noteLower = note.toLowerCase();
                          let suggestedCategory = form.category;
                          let foundKeyword = false;

                          for (const keyword in KEYWORD_MAP) {
                            if (noteLower.includes(keyword)) {
                              suggestedCategory = KEYWORD_MAP[keyword];
                              foundKeyword = true;
                              break;
                            }
                          }

                          setForm(prev => ({ 
                            ...prev, 
                            note, 
                            category: foundKeyword ? suggestedCategory : prev.category 
                          }));

                          setAiFields(prev => {
                            const next = new Set(prev);
                            next.delete('note');
                            if (foundKeyword) {
                              next.add('category');
                              aiToast.info(`Auto-mapped: ${suggestedCategory}`);
                            } else {
                              next.delete('category');
                            }
                            return next;
                          });
                        }}
                      />
                      {aiFields.has('note') && (
                        <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-indigo-500 animate-pulse" />
                      )}
                    </div>
                 </div>
                <Button 
                  onClick={handleSave}
                  className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-lg shadow-xl shadow-indigo-100"
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
                <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-lg bg-white">
                   <Wallet className="size-10 text-slate-200 mx-auto mb-4" />
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada catatan pengeluaran</p>
                </div>
              ) : (
                expenses.map((e) => (
                  <div key={e.id} className="bg-white p-5 rounded-lg border-2 border-slate-100 shadow-sm flex items-center justify-between group">
                     <div className="flex items-center gap-5">
                        <div className="size-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
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
                       className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
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

