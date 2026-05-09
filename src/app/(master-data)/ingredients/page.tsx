'use client';

import { useEffect, useState } from 'react';
import { db, Ingredient } from '@/db/dexie';
import { 
  Plus, Search, Trash2, Edit2, Package, 
  ChevronLeft, ArrowUpRight, Scale, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';
import { useStaffStore } from '@/store/useStaffStore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function IngredientsPage() {
  const router = useRouter();
  const { session } = useStaffStore();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    unit: 'Gram',
    cost_per_unit: 0
  });

  const loadIngredients = async () => {
    setLoading(true);
    const data = await db.ingredients.toArray();
    setIngredients(data.filter(i => !i.deleted_at));
    setLoading(false);
  };

  useEffect(() => {
    loadIngredients();
  }, []);

  const handleSave = async () => {
    if (!form.name || form.cost_per_unit <= 0) {
      toast.error('Nama dan Harga per Satuan wajib diisi');
      return;
    }

    try {
      const id = editingId || createId();
      const data: Ingredient = {
        id,
        user_id: session?.id || '',
        name: form.name,
        unit: form.unit,
        cost_per_unit: form.cost_per_unit,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      };

      if (editingId) {
        await db.ingredients.put(data);
        await addToSyncQueue('ingredients', 'update', id, data);
      } else {
        await db.ingredients.add(data);
        await addToSyncQueue('ingredients', 'insert', id, data);
      }
      
      triggerSync(session?.id).catch(console.error);
      toast.success(editingId ? 'Bahan diperbarui' : 'Bahan ditambahkan');
      setForm({ name: '', unit: 'Gram', cost_per_unit: 0 });
      setIsAdding(false);
      setEditingId(null);
      loadIngredients();
    } catch (err) {
      toast.error('Gagal menyimpan bahan');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus bahan baku ini?')) return;
    try {
      await db.ingredients.update(id, { deleted_at: new Date().toISOString(), sync_status: 'pending' });
      await addToSyncQueue('ingredients', 'update', id, { deleted_at: new Date().toISOString() });
      triggerSync(session?.id).catch(console.error);
      toast.success('Berhasil dihapus');
      loadIngredients();
    } catch (err) {
      toast.error('Gagal menghapus');
    }
  };

  const handleEdit = (ing: Ingredient) => {
    setForm({
      name: ing.name,
      unit: ing.unit,
      cost_per_unit: ing.cost_per_unit
    });
    setEditingId(ing.id);
    setIsAdding(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-16 border-b-2 border-slate-100 sticky top-0 bg-white z-40">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-50 rounded-xl transition-all">
            <ChevronLeft className="size-5 text-slate-400" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 opacity-70 mb-0.5">Bahan Baku</h1>
            <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Manajemen Modal</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setIsAdding(!isAdding);
            if (!isAdding) {
              setForm({ name: '', unit: 'Gram', cost_per_unit: 0 });
              setEditingId(null);
            }
          }}
          className={cn(
            "size-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90",
            isAdding ? "bg-slate-100 text-slate-400" : "bg-indigo-600 text-white"
          )}
        >
          <Plus className={cn("size-5 transition-transform", isAdding && "rotate-45")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Form Add/Edit */}
        {isAdding && (
          <div className="px-6 py-8 bg-slate-50 border-b-2 border-slate-100 space-y-6 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nama Bahan</Label>
                <Input 
                  placeholder="Misal: Bubuk Kopi"
                  className="h-11 font-bold bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-0"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Satuan</Label>
                <Input 
                  placeholder="Gram / ML / Pcs"
                  className="h-11 font-bold bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-0"
                  value={form.unit}
                  onChange={e => setForm({...form, unit: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Harga per Satuan (Rp)</Label>
                <Input 
                  type="number"
                  placeholder="0"
                  className="h-11 font-black bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:ring-0"
                  value={form.cost_per_unit || ''}
                  onChange={e => setForm({...form, cost_per_unit: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
               <Button 
                 variant="ghost" 
                 onClick={() => { setIsAdding(false); setEditingId(null); }}
                 className="h-11 text-[10px] font-black uppercase tracking-widest text-slate-400"
               >
                 Batal
               </Button>
               <Button 
                 onClick={handleSave}
                 className="h-11 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100"
               >
                 {editingId ? 'Simpan Perubahan' : 'Tambah Bahan'}
               </Button>
            </div>
          </div>
        )}

        {/* List Section */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-2 px-1">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Daftar Bahan Baku</h3>
             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">{ingredients.length} Total</span>
          </div>

          {loading ? (
            <div className="py-20 text-center animate-pulse text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Memuat Data...</div>
          ) : ingredients.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
               <Scale className="size-10 text-slate-200 mx-auto mb-4" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada bahan baku terdaftar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ingredients.map((ing) => (
                <div key={ing.id} className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm hover:border-indigo-200 transition-all group">
                   <div className="flex justify-between items-start mb-4">
                      <div className="size-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                         <Package className="size-6 text-indigo-600" />
                      </div>
                      <div className="flex gap-1">
                         <button onClick={() => handleEdit(ing)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <Edit2 className="size-4" />
                         </button>
                         <button onClick={() => handleDelete(ing.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                            <Trash2 className="size-4" />
                         </button>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <h4 className="text-[15px] font-black text-slate-900 uppercase tracking-tight leading-none truncate">{ing.name}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Per {ing.unit}</p>
                   </div>
                   <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex flex-col">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Biaya Satuan</span>
                         <span className="text-sm font-black text-emerald-600">Rp {ing.cost_per_unit.toLocaleString('id-ID')}</span>
                      </div>
                      <ArrowUpRight className="size-4 text-slate-200" />
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
