'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, LocalProduct, Ingredient } from '@/db/dexie';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Plus, Minus, Package, Camera, Check, AlertTriangle, Store, Warehouse, Calculator, Trash2, Info, TrendingUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';
import { useStaffStore } from '@/store/useStaffStore';
import { uploadImage } from '@/services/cloudinary';

interface ProductFormProps {
  initialData?: LocalProduct | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProductForm({ initialData, onSuccess, onCancel }: ProductFormProps) {
  const EMPTY_CATEGORY_VALUE = '__no_category__';
  const router = useRouter();
  const { session } = useStaffStore();
  const userId = session?.id;
  const [categories, setCategories] = useState<{ id: string, name: string }[]>([]);
  const [skuTouched, setSkuTouched] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [form, setForm] = useState<Partial<LocalProduct>>({
    name: '', sku: '', price_sell: 0, price_cost: 0, image_url: '', category_id: '', stock_store: 0, stock_warehouse: 0, barcode_type: 'CODE128'
  });

  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient_id: string, quantity: number }[]>([]);
  const [targetMargin, setTargetMargin] = useState(30);
  const [showHppCalc, setShowHppCalc] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [c, p, ing] = await Promise.all([
        db.categories.toArray(),
        db.products.toArray(),
        db.ingredients.toArray()
      ]);
      setCategories(c);
      setProducts(p);
      setAllIngredients(ing.filter(i => !i.deleted_at));

      if (initialData) {
        const prodIng = await db.product_ingredients.where('product_id').equals(initialData.id).toArray();
        setSelectedIngredients(prodIng.map(pi => ({ ingredient_id: pi.ingredient_id, quantity: pi.quantity })));
      }
    };
    fetchData();
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      setForm({
        ...initialData,
        category_id: initialData.category_id ?? '',
      });
    }
  }, [initialData]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    const maxSizeInBytes = 5 * 1024 * 1024; // Cloudinary allows larger files
    if (file.size > maxSizeInBytes) {
      toast.error('Ukuran gambar maksimal 5MB');
      return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading('Mengunggah gambar...');
    try {
      const url = await uploadImage(file);
      setForm((prev) => ({
        ...prev,
        image_url: url,
      }));
      toast.success('Gambar berhasil diunggah', { id: loadingToast });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(`Gagal unggah: ${err.message || 'Error tidak diketahui'}`, { id: loadingToast });
      
      // Fallback to base64 if Cloudinary fails (optional, but maybe better to fix the config)
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          image_url: typeof reader.result === 'string' ? reader.result : '',
        }));
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.sku) {
      toast.error('Nama dan SKU wajib diisi!');
      return;
    }
    if (existingSkuConflict) {
      toast.error('SKU sudah terpakai produk lain');
      return;
    }
    if (isCreatingCategory && !newCategoryName.trim()) {
      toast.error('Nama kategori baru wajib diisi!');
      return;
    }

    try {
      let finalCategoryId = form.category_id;

      if (isCreatingCategory && newCategoryName.trim()) {
        const newCat = {
          id: createId(),
          user_id: userId,
          name: newCategoryName.trim(),
          sync_status: 'pending' as const
        };
        await db.categories.add(newCat);
        await addToSyncQueue('categories', 'insert', newCat.id, newCat);
        finalCategoryId = newCat.id;
      }

      const id = initialData?.id || createId();
      const data = {
        ...form,
        user_id: userId,
        category_id: finalCategoryId,
        id: id,
        price_sell: Number(form.price_sell),
        price_cost: Number(form.price_cost),
        stock_store: Number(form.stock_store),
        stock_warehouse: Number(form.stock_warehouse),
        sync_status: 'pending' as const,
        updated_at: new Date().toISOString()
      } as LocalProduct;

      if (initialData) {
        await db.products.put(data);
        await addToSyncQueue('products', 'update', id, data);
        
        // Handle product ingredients sync
        const existingPI = await db.product_ingredients.where('product_id').equals(id).toArray();
        
        // Delete existing from local and add to sync queue
        await db.product_ingredients.where('product_id').equals(id).delete();
        for (const pi of existingPI) {
          await addToSyncQueue('product_ingredients', 'delete', pi.id, {});
        }

        if (selectedIngredients.length > 0) {
          const piData = selectedIngredients.map(si => ({
            id: createId(),
            product_id: id,
            ingredient_id: si.ingredient_id,
            quantity: si.quantity,
            sync_status: 'pending' as const
          }));
          await db.product_ingredients.bulkAdd(piData);
          for (const pi of piData) {
            await addToSyncQueue('product_ingredients', 'insert', pi.id, pi);
          }
        }

        toast.success('Produk diperbarui');
      } else {
        await db.products.add(data);
        await addToSyncQueue('products', 'insert', id, data);

        if (selectedIngredients.length > 0) {
          const piData = selectedIngredients.map(si => ({
            id: createId(),
            product_id: id,
            ingredient_id: si.ingredient_id,
            quantity: si.quantity,
            sync_status: 'pending' as const
          }));
          await db.product_ingredients.bulkAdd(piData);
          for (const pi of piData) {
            await addToSyncQueue('product_ingredients', 'insert', pi.id, pi);
          }
        }

        toast.success('Produk ditambahkan');
      }
      
      triggerSync(userId).catch(console.error);
      if (onSuccess) onSuccess();
      else router.push('/produk');
    } catch (err) {
      toast.error('Gagal menyimpan produk');
    }
  };

  const normalizeNumber = (value: string) => Number(value.replace(/\D/g, '') || 0);
  const toCurrency = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
  const existingSkuConflict = products.some((p) => p.sku === form.sku && p.id !== initialData?.id && !p.deleted_at);
  const isLossWarning = Number(form.price_sell || 0) < Number(form.price_cost || 0);

  return (
    <div className="flex flex-col bg-slate-50/30 min-h-screen">
      {/* Header - More responsive height and spacing */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3 md:h-20 border-b border-slate-100 shrink-0 bg-white sticky top-0 z-50 shadow-sm shadow-slate-900/5">
        <div className="flex items-center gap-3 md:gap-5">
          <button
            onClick={() => onCancel ? onCancel() : router.back()}
            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-xl active:scale-90"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex flex-col">
            <h2 className="hidden xs:block text-[9px] md:text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-0.5 opacity-70">Manajemen Katalog</h2>
            <p className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest leading-tight">
              {initialData ? 'Perbarui Data' : 'Tambah Produk'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            onClick={() => onCancel ? onCancel() : router.back()}
            className="h-9 md:h-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 px-3"
          >
            Batal
          </Button>
          <button
            onClick={handleSave}
            disabled={existingSkuConflict}
            className="flex items-center gap-2 px-4 md:px-8 py-2 md:py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl md:rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all disabled:opacity-30 shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Check className="size-4 hidden sm:block" />
            <span className="sm:hidden">Simpan</span>
            <span className="hidden sm:block">Simpan Produk</span>
          </button>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex-1">
        <div className="h-full lg:grid lg:grid-cols-12">

          {/* LEFT SIDEBAR: Visual Identity */}
          <div className="lg:col-span-3 border-r border-slate-100 bg-slate-50/20 p-6 md:p-8 flex flex-col items-center">
            <div className="relative group mb-8 md:mb-10 mt-2 md:mt-4">
              <div className="w-40 h-40 md:w-44 md:h-44 lg:w-48 lg:h-48 rounded-3xl bg-slate-50 border-[6px] border-white shadow-2xl flex items-center justify-center overflow-hidden ring-1 ring-slate-100 group-hover:ring-indigo-100 transition-all duration-500">
                {form.image_url ? (
                  <img src={form.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Produk" />
                ) : (
                  <Package className="h-16 w-16 text-slate-200" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Uploading...</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px] rounded-3xl">
                  <Camera className="size-8 text-white/90" />
                </div>
              </div>
              <label className={`absolute -bottom-2 -right-2 size-12 ${isUploading ? 'bg-slate-200 cursor-not-allowed' : 'bg-indigo-600 cursor-pointer hover:bg-indigo-700'} rounded-full flex items-center justify-center text-white shadow-xl transition-all active:scale-90 border-[4px] border-white z-20`}>
                <Camera className="size-5" />
                {!isUploading && <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />}
              </label>
            </div>

            <div className="w-full space-y-7 px-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Nama Produk</Label>
                <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center">
                  <Input
                    autoFocus
                    placeholder="Contoh: Kopi Gula Aren"
                    className="w-full h-full bg-transparent border-0 rounded-none px-1 focus-visible:ring-0 text-sm font-bold transition-all placeholder:text-slate-200"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Kategori</Label>
                <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center">
                  <Select
                    value={isCreatingCategory ? '__new_category__' : (form.category_id || EMPTY_CATEGORY_VALUE)}
                    onValueChange={(v: string | null) => {
                      if (!v) return;
                      if (v === '__new_category__') setIsCreatingCategory(true);
                      else {
                        setIsCreatingCategory(false);
                        setForm({ ...form, category_id: (v === EMPTY_CATEGORY_VALUE ? '' : v) || '' });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-full bg-transparent border-0 rounded-none px-1 focus:ring-0 text-sm font-bold shadow-none">
                      <SelectValue placeholder="Pilih Kategori">
                        {isCreatingCategory 
                          ? '+ Kategori Baru' 
                          : (categories.find(c => c.id === form.category_id)?.name || (form.category_id === '' ? 'Tanpa Kategori' : form.category_id))
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4} className="rounded-lg border-slate-100 shadow-xl">
                      <SelectItem value={EMPTY_CATEGORY_VALUE} className="text-xs font-bold py-2.5">Tanpa Kategori</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs font-bold py-2.5">{c.name}</SelectItem>
                      ))}
                      <Separator className="my-1" />
                      <SelectItem value="__new_category__" className="text-xs font-black text-indigo-600 py-2.5">+ Kategori Baru</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isCreatingCategory && (
                  <div className="h-10 border-b-2 border-indigo-200 bg-indigo-50/30 transition-all flex items-center mt-2 animate-in slide-in-from-top-2 duration-300">
                    <Input
                      placeholder="Ketik nama kategori..."
                      className="w-full h-full bg-transparent border-0 rounded-none px-2 focus-visible:ring-0 text-xs font-bold"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT: Operational Data */}
          <div className="lg:col-span-9 bg-white p-2 md:p-4">
            <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6 space-y-10 md:space-y-14">

              {/* SECTION: IDENTITAS TEKNIS */}
              <div className="space-y-8">
                <div className="relative flex items-center">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] pr-6 bg-white z-10">Identitas Teknis</h3>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 md:gap-y-10">
                  <div className="flex flex-col gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Jenis Barcode</Label>
                    <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center">
                      <Select value={form.barcode_type || 'CODE128'} onValueChange={(v: string | null) => setForm({ ...form, barcode_type: (v as any) || undefined })}>
                        <SelectTrigger className="w-full h-full bg-transparent border-0 rounded-none px-1 focus:ring-0 text-sm font-bold shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="bottom" alignItemWithTrigger={false} sideOffset={4} className="rounded-lg border-slate-100 shadow-xl w-[var(--anchor-width)]">
                          <SelectGroup>
                            <SelectLabel className="text-[10px] font-black uppercase tracking-widest p-2 bg-slate-50/50 text-slate-400">Ritel & Minimarket</SelectLabel>
                            <SelectItem value="EAN13" className="text-xs font-bold py-2.5">EAN-13 (Standar)</SelectItem>
                            <SelectItem value="EAN8" className="text-xs font-bold py-2.5">EAN-8 (Kemasan Kecil)</SelectItem>
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel className="text-[10px] font-black uppercase tracking-widest p-2 bg-slate-50/50 text-slate-400 mt-2">Custom & Gudang</SelectLabel>
                            <SelectItem value="CODE128" className="text-xs font-bold py-2.5">CODE-128 (Mix)</SelectItem>
                            <SelectItem value="CODE39" className="text-xs font-bold py-2.5">CODE-39 (Alfanumerik)</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">SKU / Kode Produk</Label>
                    <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center">
                      <Input
                        placeholder="Misal: KPS-001"
                        className="w-full h-full bg-transparent border-0 rounded-none px-1 focus-visible:ring-0 text-sm font-bold font-mono tracking-wider placeholder:text-slate-300/50"
                        value={form.sku}
                        onChange={e => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                      />
                    </div>
                    {existingSkuConflict && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-1">Gunakan SKU lain, yang ini sudah ada!</p>}
                  </div>
                </div>
              </div>

              {/* SECTION: HARGA & PROFIT */}
              <div className="space-y-8">
                <div className="relative flex items-center">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] pr-6 bg-white z-10">Harga & Profit</h3>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 md:gap-y-10">
                  <div className="flex flex-col gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Harga Jual (Customer)</Label>
                    <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center">
                      <Input
                        inputMode="numeric"
                        placeholder="Rp 0"
                        className="w-full h-full bg-transparent border-0 rounded-none px-1 focus-visible:ring-0 text-sm font-black text-indigo-600 transition-all placeholder:text-slate-300/50"
                        value={form.price_sell ? toCurrency(Number(form.price_sell)) : ''}
                        onFocus={(e) => e.target.select()}
                        onChange={e => setForm({ ...form, price_sell: normalizeNumber(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Harga Modal (HPP)</Label>
                    <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center gap-2 group">
                      <Input
                        inputMode="numeric"
                        placeholder="Rp 0"
                        className="w-full h-full bg-transparent border-0 rounded-none px-1 focus-visible:ring-0 text-sm font-bold text-slate-400 transition-all placeholder:text-slate-300/50"
                        value={form.price_cost ? toCurrency(Number(form.price_cost)) : ''}
                        onFocus={(e) => e.target.select()}
                        onChange={e => setForm({ ...form, price_cost: normalizeNumber(e.target.value) })}
                      />
                      <Dialog open={showHppCalc} onOpenChange={setShowHppCalc}>
                        <DialogTrigger 
                          render={
                            <button className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90">
                              <Calculator className="size-4" />
                            </button>
                          }
                        />
                        <DialogContent className="sm:max-w-[500px] rounded-3xl border-2 border-slate-100 shadow-2xl p-0 overflow-hidden">
                          <div className="bg-slate-900 p-8 text-white">
                             <div className="flex items-center gap-3 mb-2 opacity-50">
                               <Calculator className="size-4" />
                               <span className="text-[10px] font-black uppercase tracking-[0.3em]">HPP Calculator</span>
                             </div>
                             <h3 className="text-3xl font-black tracking-tighter">Hitung Modal Otomatis</h3>
                             <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-wide">Rincian Bahan Baku (BOM)</p>
                          </div>
                          
                          <div className="p-8 space-y-6 max-h-[60vh] overflow-auto">
                             <div className="space-y-4">
                                {selectedIngredients.length === 0 ? (
                                  <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                    <Package className="size-8 text-slate-200 mx-auto mb-3" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Belum ada bahan ditambahkan</p>
                                  </div>
                                ) : (
                                  selectedIngredients.map((si, idx) => {
                                    const ing = allIngredients.find(i => i.id === si.ingredient_id);
                                    return (
                                      <div key={idx} className="flex items-center gap-4 p-4 bg-white border-2 border-slate-100 rounded-2xl">
                                         <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-slate-900 uppercase truncate">{ing?.name || 'Bahan'}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rp {ing?.cost_per_unit.toLocaleString('id-ID')} / {ing?.unit}</p>
                                         </div>
                                         <div className="flex items-center gap-2">
                                            <Input 
                                              type="number"
                                              className="w-20 h-9 text-xs font-black bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-600 text-center"
                                              value={si.quantity}
                                              onChange={e => {
                                                const newIngs = [...selectedIngredients];
                                                newIngs[idx].quantity = Number(e.target.value);
                                                setSelectedIngredients(newIngs);
                                              }}
                                            />
                                            <button 
                                              onClick={() => setSelectedIngredients(selectedIngredients.filter((_, i) => i !== idx))}
                                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                            >
                                              <Trash2 className="size-3.5" />
                                            </button>
                                         </div>
                                      </div>
                                    );
                                  })
                                )}
                             </div>

                             <div className="pt-4 border-t-2 border-slate-50">
                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-1 mb-2 block">Tambah Bahan</Label>
                                <Select onValueChange={(v: string | null) => {
                                  if (!v) return;
                                  if (selectedIngredients.some(si => si.ingredient_id === v)) return;
                                  setSelectedIngredients([...selectedIngredients, { ingredient_id: v, quantity: 1 }]);
                                }}>
                                  <SelectTrigger className="h-11 font-bold bg-slate-50 border-2 border-slate-200 rounded-xl">
                                    <SelectValue placeholder="Pilih bahan baku..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allIngredients.map(ing => (
                                      <SelectItem key={ing.id} value={ing.id} className="font-bold">{ing.name} ({ing.unit})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                             </div>
                          </div>

                          <div className="p-8 bg-slate-50 border-t-2 border-slate-200 flex items-center justify-between">
                             <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total HPP Terhitung</span>
                                <span className="text-2xl font-black text-slate-900">
                                  Rp {selectedIngredients.reduce((sum, si) => {
                                    const ing = allIngredients.find(i => i.id === si.ingredient_id);
                                    return sum + (ing?.cost_per_unit || 0) * si.quantity;
                                  }, 0).toLocaleString('id-ID')}
                                </span>
                             </div>
                             <Button 
                               onClick={() => {
                                 const total = selectedIngredients.reduce((sum, si) => {
                                   const ing = allIngredients.find(i => i.id === si.ingredient_id);
                                   return sum + (ing?.cost_per_unit || 0) * si.quantity;
                                 }, 0);
                                 setForm({...form, price_cost: total});
                                 setShowHppCalc(false);
                               }}
                               className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest rounded-xl"
                             >
                               Gunakan HPP
                             </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 md:gap-y-10">
                  <div className="flex flex-col gap-4 p-6 bg-emerald-50/50 rounded-3xl border-2 border-emerald-100">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <TrendingUp className="size-4 text-emerald-600" />
                          <Label className="text-[10px] font-black uppercase text-emerald-800 tracking-widest">Smart Pricing Suggester</Label>
                       </div>
                       <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-emerald-200">
                          <span className="text-[9px] font-black text-emerald-600">Target Margin:</span>
                          <input 
                            type="number"
                            className="w-10 bg-transparent border-0 p-0 text-[10px] font-black text-emerald-600 text-center focus:ring-0"
                            value={targetMargin}
                            onChange={e => setTargetMargin(Number(e.target.value))}
                          />
                          <span className="text-[9px] font-black text-emerald-600">%</span>
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex flex-col">
                          <p className="text-[9px] font-black text-emerald-600/70 uppercase tracking-widest mb-1">Saran Harga Jual</p>
                          <p className="text-xl font-black text-emerald-700">
                            Rp {Math.ceil((Number(form.price_cost || 0) / (1 - (targetMargin / 100))) / 100) * 100 || 0}
                          </p>
                       </div>
                       <Button 
                         size="sm"
                         onClick={() => {
                           const suggested = Math.ceil((Number(form.price_cost || 0) / (1 - (targetMargin / 100))) / 100) * 100;
                           setForm({...form, price_sell: suggested});
                         }}
                         className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-xl"
                       >
                         Gunakan Saran
                       </Button>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50/50 rounded-3xl border-2 border-slate-100 flex flex-col justify-center">
                     <div className="flex items-center gap-2 mb-2">
                        <Info className="size-3.5 text-slate-400" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Analisa Laba Kotor</span>
                     </div>
                     <p className="text-[10px] font-black text-slate-700 leading-relaxed uppercase tracking-tight">
                        Dengan harga jual <span className="text-indigo-600">Rp {Number(form.price_sell || 0).toLocaleString('id-ID')}</span>, 
                        Anda mendapatkan laba <span className="text-emerald-600">Rp {Math.max(0, Number(form.price_sell || 0) - Number(form.price_cost || 0)).toLocaleString('id-ID')}</span> per produk.
                     </p>
                  </div>
                </div>
                {isLossWarning && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50/50 border border-red-100 text-red-600 animate-pulse">
                    <AlertTriangle className="size-4 shrink-0" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Peringatan: Harga jual di bawah modal! Rugi dong.</p>
                  </div>
                )}
              </div>

              {/* SECTION: LEVEL STOK */}
              <div className="space-y-8 pb-12">
                <div className="relative flex items-center">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] pr-6 bg-white z-10">Level Stok</h3>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 md:gap-y-10">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Stok Toko</Label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Siap Jual</span>
                    </div>
                    <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center group/input">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, stock_store: Math.max(0, (form.stock_store || 0) - 1) })}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <Input
                        type="number"
                        className="w-full h-full bg-transparent border-0 rounded-none px-2 focus-visible:ring-0 text-sm font-black text-slate-800 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={form.stock_store}
                        onFocus={(e) => e.target.select()}
                        onChange={e => setForm({ ...form, stock_store: e.target.value === '' ? 0 : Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, stock_store: (form.stock_store || 0) + 1 })}
                        className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                      <Label className="text-[10px] font-black uppercase text-slate-700 tracking-widest ml-1">Stok Gudang</Label>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Cadangan</span>
                    </div>
                    <div className="h-10 border-b-2 border-slate-100 focus-within:border-indigo-500 transition-all flex items-center group/input">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, stock_warehouse: Math.max(0, (form.stock_warehouse || 0) - 1) })}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <Input
                        type="number"
                        className="w-full h-full bg-transparent border-0 rounded-none px-2 focus-visible:ring-0 text-sm font-black text-slate-800 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={form.stock_warehouse}
                        onFocus={(e) => e.target.select()}
                        onChange={e => setForm({ ...form, stock_warehouse: e.target.value === '' ? 0 : Number(e.target.value) })}
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, stock_warehouse: (form.stock_warehouse || 0) + 1 })}
                        className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
