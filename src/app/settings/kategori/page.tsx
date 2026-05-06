'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/dexie';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Search, Check } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { triggerSync } from '@/hooks/useSync';

interface Category {
  id: string;
  name: string;
}

export default function KategoriPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchCategories = async () => {
    const data = await db.categories.toArray();
    setCategories(data);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingId) {
        await db.categories.update(editingId, { name });
        toast.success('Kategori diperbarui');
      } else {
        const id = Date.now().toString();
        await db.categories.add({ id, name });
        toast.success('Kategori ditambahkan');
      }
      setName('');
      setEditingId(null);
      fetchCategories();
      triggerSync().catch(console.error); // Trigger sync to cloud
    } catch (err) {
      toast.error('Gagal menyimpan kategori');
    }
  };

  const handleEdit = (cat: Category) => {
    setName(cat.name);
    setEditingId(cat.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus kategori ini?')) return;
    try {
      await db.categories.delete(id);
      toast.success('Kategori dihapus');
      fetchCategories();
      triggerSync().catch(console.error); // Trigger sync to cloud
    } catch (err) {
      toast.error('Gagal menghapus kategori');
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SettingsLayout title="Kategori Produk">
      <div className="flex flex-col">
        {/* Add/Edit Section - Minimalist Underline Style */}
        <section className="px-6 py-4 border-b border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em]">
                {editingId ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </Label>
              <div className="flex gap-4 items-end">
                <div className="relative flex-1 group">
                  <Input
                    id="cat-name"
                    placeholder="Contoh: Makanan, Minuman..."
                    className="h-12 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 transition-all placeholder:text-slate-300 font-medium px-0"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 w-10 rounded-xl shadow-lg shadow-indigo-100 shrink-0 transition-all active:scale-90"
                >
                  {editingId ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            {editingId && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-slate-400 hover:text-red-500"
                onClick={() => { setEditingId(null); setName(''); }}
              >
                Batal Edit
              </Button>
            )}
          </form>
        </section>

        {/* Search Section */}
        <section className="px-6 py-2">
          <div className="relative group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Cari kategori..."
              className="pl-7 h-12 bg-transparent border-0 border-b-2 border-slate-100 rounded-none shadow-none text-sm focus-visible:ring-0 focus-visible:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </section>

        {/* List Section */}
        <section className="flex flex-col">
          <div className="px-6 pt-4 pb-2">
            <div className="flex flex-col items-center">
              <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">Daftar Kategori</h3>
              <div className="w-6 h-0.5 bg-indigo-400/50 rounded-full mt-1.5" />
            </div>
          </div>

          <div className="flex flex-col mt-4">
            {filteredCategories.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-slate-400 italic">
                  {categories.length === 0 ? 'Belum ada kategori.' : 'Kategori tidak ditemukan.'}
                </p>
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div 
                  key={cat.id}
                  className="flex items-center justify-between px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0"
                >
                  <span className="text-sm font-bold text-slate-800">{cat.name}</span>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-full text-slate-300 hover:text-indigo-600 hover:bg-indigo-50" 
                      onClick={() => handleEdit(cat)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-full text-slate-300 hover:text-red-600 hover:bg-red-50" 
                      onClick={() => handleDelete(cat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
}
