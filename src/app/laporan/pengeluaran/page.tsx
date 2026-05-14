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
      <div className="flex flex-col bg-white">

        <div className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-5 py-5 lg:py-8 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-rose-500" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Laporan Pengeluaran</span>
              </div>
              <h2 className="text-xl lg:text-3xl font-semibold text-slate-800 tracking-tight">
                Rp {totalExpense.toLocaleString('id-ID')}
              </h2>
            </div>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className={cn(
                "h-11 px-5 lg:h-14 lg:px-8 rounded-xl flex items-center gap-2 shadow-md active:scale-95 font-black text-[11px] uppercase tracking-widest",
                isAdding ? "bg-slate-100 text-slate-500 shadow-none" : "bg-indigo-600 text-white hover:bg-indigo-700"
              )}
            >
              <Plus className={cn("size-4", isAdding && "rotate-45")} />
              <span>{isAdding ? 'Batal' : 'Tambah'}</span>
            </button>
          </div>
        </div>

        {isAdding && (
          <div className="max-w-6xl mx-auto w-full mt-4 px-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-5 lg:p-8">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Sparkles className="size-4" />
                </div>
                <h3 className="text-sm font-black text-slate-800">Catat Pengeluaran Baru</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-3">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Media Bukti / Struk</Label>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <MediaUploader
                      imageUrl={form.receipt_url}
                      onUpload={handleReceiptUpload}
                      onRemove={() => setForm({ ...form, receipt_url: '' })}
                      isIdentifying={isIdentifying}
                      modeLabel="Struk"
                    />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight leading-relaxed">
                      ✨Fitur AI akan memindai struk secara otomatis.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nominal (Rp)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      className="!h-12 w-full text-[13px] font-semibold bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-0 box-border"
                      value={form.amount || ''}
                      onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Kategori</Label>
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v || 'Operasional' })}>
                        <SelectTrigger className="!h-12 w-full text-[13px] font-semibold bg-white border-2 border-slate-200 rounded-xl px-4 focus:border-indigo-600 focus:ring-0 box-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-200">
                          {EXPENSE_CATEGORIES.map(c => (
                            <SelectItem key={c} value={c} className="font-bold py-3">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Catatan</Label>
                      <Input
                        placeholder="Keterangan..."
                        className="!h-12 w-full text-[13px] font-semibold bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-600 box-border"
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
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] mt-4"
                  >
                    Simpan Transaksi
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expense List - Structured */}
        <div className="max-w-6xl mx-auto w-full py-8 lg:py-16">
          <div className="flex items-center justify-between mb-6 px-5 lg:px-0">
            <div className="flex items-center gap-3">
              <History className="size-4 text-slate-400" />
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Riwayat Transaksi</h3>
            </div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-2.5 py-1 rounded-md">
              {expenses.length} Total
            </div>
          </div>

          <div className="flex flex-col bg-white border-y border-slate-100 divide-y divide-slate-100 lg:bg-transparent lg:border-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6 lg:divide-y-0">
            {loading ? (
              <div className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Memuat Data...</div>
            ) : expenses.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-lg bg-white">
                <Wallet className="size-10 text-slate-200 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada catatan pengeluaran</p>
              </div>
            ) : (
              expenses.map((e) => (
                <div key={e.id} className="bg-white p-5 lg:rounded-xl lg:border lg:border-slate-100 lg:shadow-sm flex items-center justify-between group hover:bg-slate-50/50">
                  <div className="flex items-center gap-3 lg:gap-5 min-w-0">
                    <div className="size-10 lg:size-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <DollarSign className="size-5 lg:size-6 text-rose-500" />
                    </div>
                    <div className="flex flex-col gap-0.5 lg:gap-1 min-w-0">
                      <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                        <span className="text-[12px] lg:text-[13px] font-black text-slate-900 uppercase tracking-tight">Rp {e.amount.toLocaleString('id-ID')}</span>
                        <span className="text-[7px] lg:text-[8px] font-black bg-rose-50 text-rose-600 px-1.5 lg:px-2 py-0.5 rounded-full uppercase tracking-widest truncate">{e.category}</span>
                      </div>
                      <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 leading-tight uppercase tracking-wide truncate">
                        {e.note || 'Tanpa catatan'} • {format(new Date(e.created_at), 'dd MMM yyyy', { locale: localeId })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="p-2 lg:p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg lg:opacity-0 lg:group-hover:opacity-100 shrink-0"
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

