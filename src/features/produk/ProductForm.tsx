'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LocalProduct, Ingredient } from '@/db/dexie';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft, Plus, Minus, Package, Camera, Check,
  AlertCircle, LayoutGrid, DollarSign, Info,
  Save, Sparkles, Target, Trash2, Calculator,
  Loader2, History, ArrowRight, ShieldCheck, Tag, X, TrendingUp
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';
import { useStaffStore } from '@/store/useStaffStore';
import { uploadImage } from '@/services/cloudinary';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { identifyProductFromImage, aiToast } from '@/services/aiService';
import { MediaUploader } from '@/components/ui/MediaUploader';

interface ProductFormProps {
  initialData?: LocalProduct | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const BARCODE_RULES: { [key: string]: { regex: RegExp, message: string, example: string } } = {
  'EAN13': { regex: /^\d{13}$/, message: "EAN-13 harus tepat 13 digit angka.", example: "8991234567890" },
  'EAN8': { regex: /^\d{8}$/, message: "EAN-8 harus tepat 8 digit angka.", example: "12345678" },
  'UPCA': { regex: /^\d{12}$/, message: "UPC-A harus tepat 12 digit angka.", example: "012345678901" },
  'UPCE': { regex: /^\d{6}$/, message: "UPC-E harus tepat 6 digit angka.", example: "123456" },
  'CODE128': { regex: /^[\x20-\x7F]+$/, message: "Code 128: Mendukung alfanumerik & simbol standar.", example: "SKU-128-ABC" },
  'CODE39': { regex: /^[A-Z0-9\-\.\$\/\+\%\s]+$/, message: "Code 39: Hanya huruf besar, angka, dan simbol standar.", example: "PROD-101" }
};

export function ProductForm({ initialData, onSuccess, onCancel }: ProductFormProps) {
  const router = useRouter();
  const { session } = useStaffStore();
  const userId = session?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isManualCategory, setIsManualCategory] = useState(false);
  const [manualCategoryName, setManualCategoryName] = useState("");
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<{ ingredient_id: string, quantity: number, is_packaging?: number }[]>([]);
  const [showHppCalc, setShowHppCalc] = useState(false);
  const [targetMonthlyProfit, setTargetMonthlyProfit] = useState(10000000);
  const [tempIngId, setTempIngId] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isHppAnalyzing, setIsHppAnalyzing] = useState(false);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  const [form, setForm] = useState<Partial<LocalProduct>>({
    name: '',
    sku: '',
    price_sell: 0,
    price_cost: 0,
    image_url: '',
    category_id: '',
    stock_store: 0,
    stock_warehouse: 0,
    barcode_type: 'CODE128',
    prod_monthly_estimate: 1000,
    prod_output_qty: 1,
    prod_target_batch: 1,
    prod_wastage_percent: 0,
    prod_tax_efficiency: 0,
    prod_operational_costs: [],
    note: ''
  });

  // Reactive categories loading
  const categories = useLiveQuery(async () => {
    const cats = await db.categories.toArray();
    return cats.filter(cat => {
      const isDeleted = !!cat.deleted_at;
      if (isDeleted) return false;
      
      const isSelected = cat.id === form.category_id;
      const isProductType = !cat.type || cat.type === 'product';
      
      return isSelected || isProductType;
    });
  }, [form.category_id]) || [];

  const [isValid, setIsValid] = useState(true);
  const [validationMsg, setValidationMsg] = useState("");

  const fillHppWithAI = async () => {
    setIsHppAnalyzing(true);
    const productName = form.name || 'produk';

    try {
      // ── Simulasi delay AI ──────────────────────────────────
      await new Promise(r => setTimeout(r, 1800));

      // Tentukan profil bisnis berdasarkan nama produk
      type ProfileKey = 'food' | 'beverage' | 'default';
      const isFood = /burger|nasi|mie|ayam|bakso|soto|sate|roti|kue|cake|pizza|pasta/i.test(productName);
      const isBeverage = /kopi|teh|juice|jus|susu|milk|latte|cappucino|frappe|matcha|smoothie|minuman/i.test(productName);
      const profile: ProfileKey = isFood ? 'food' : isBeverage ? 'beverage' : 'default';

      const profiles: Record<ProfileKey, {
        monthly: number;
        batch: number;
        output: number;
        wastage: number;
        tax: number;
        ops: { name: string; amount: number; type: string }[];
        ingredientPool: { name: string; unit: string; qty: number; cost: number; isPackaging: boolean }[];
      }> = {
        food: {
          monthly: 800,
          batch: 5,
          output: 40,
          wastage: 8,
          tax: 3,
          ops: [
            { name: 'Sewa Dapur', amount: 3500000, type: 'Operasional' },
            { name: 'Gaji Koki', amount: 4000000, type: 'Tenaga Kerja' },
            { name: 'Listrik & Gas', amount: 800000, type: 'Utility' },
            { name: 'Kemasan & Plastik', amount: 500000, type: 'Logistik' },
          ],
          ingredientPool: [
            { name: 'Tepung Terigu', unit: 'kg', qty: 2, cost: 12000, isPackaging: false },
            { name: 'Daging Segar', unit: 'kg', qty: 1, cost: 85000, isPackaging: false },
            { name: 'Bumbu Dapur', unit: 'set', qty: 1, cost: 15000, isPackaging: false },
            { name: 'Minyak Goreng', unit: 'liter', qty: 0.5, cost: 18000, isPackaging: false },
            { name: 'Box Kemasan', unit: 'pcs', qty: 1, cost: 1500, isPackaging: true },
          ],
        },
        beverage: {
          monthly: 1200,
          batch: 10,
          output: 50,
          wastage: 5,
          tax: 2,
          ops: [
            { name: 'Sewa Tempat', amount: 5000000, type: 'Operasional' },
            { name: 'Gaji Barista', amount: 3500000, type: 'Tenaga Kerja' },
            { name: 'Listrik', amount: 600000, type: 'Utility' },
            { name: 'Air & PDAM', amount: 200000, type: 'Utility' },
          ],
          ingredientPool: [
            { name: 'Biji Kopi Arabica', unit: 'kg', qty: 0.018, cost: 180000, isPackaging: false },
            { name: 'Susu Full Cream', unit: 'liter', qty: 0.2, cost: 22000, isPackaging: false },
            { name: 'Gula Aren Cair', unit: 'ml', qty: 30, cost: 25000, isPackaging: false },
            { name: 'Cup + Lid', unit: 'pcs', qty: 1, cost: 1200, isPackaging: true },
            { name: 'Sedotan', unit: 'pcs', qty: 1, cost: 200, isPackaging: true },
          ],
        },
        default: {
          monthly: 500,
          batch: 3,
          output: 30,
          wastage: 5,
          tax: 5,
          ops: [
            { name: 'Sewa Tempat', amount: 2500000, type: 'Operasional' },
            { name: 'Gaji Karyawan', amount: 3000000, type: 'Tenaga Kerja' },
            { name: 'Listrik & Air', amount: 500000, type: 'Utility' },
            { name: 'Transportasi', amount: 400000, type: 'Logistik' },
          ],
          ingredientPool: [
            { name: 'Bahan Utama', unit: 'kg', qty: 1, cost: 50000, isPackaging: false },
            { name: 'Bahan Pendukung', unit: 'pcs', qty: 2, cost: 10000, isPackaging: false },
            { name: 'Kemasan Produk', unit: 'pcs', qty: 1, cost: 2000, isPackaging: true },
          ],
        },
      };

      const p = profiles[profile];

      // ── Cek apakah ada ingredient di database lokal ────────
      // Kita mapping ingredient pool ke ID yang ada atau buat virtual entries
      const matchedIngredients: { ingredient_id: string; quantity: number; is_packaging: number }[] = [];

      for (const item of p.ingredientPool) {
        // Coba temukan di allIngredients berdasarkan nama (partial match)
        const found = allIngredients.find(i =>
          i.name.toLowerCase().includes(item.name.toLowerCase().split(' ')[0]) ||
          item.name.toLowerCase().includes(i.name.toLowerCase().split(' ')[0])
        );
        if (found) {
          matchedIngredients.push({
            ingredient_id: found.id,
            quantity: item.qty,
            is_packaging: item.isPackaging ? 1 : 0,
          });
        }
        // Jika tidak cocok, skip (tidak bisa membuat bahan baku baru dari sini)
      }

      // Terapkan semua data ke form
      setForm(prev => ({
        ...prev,
        prod_monthly_estimate: p.monthly,
        prod_target_batch: p.batch,
        prod_output_qty: p.output,
        prod_wastage_percent: p.wastage,
        prod_tax_efficiency: p.tax,
        prod_operational_costs: p.ops,
      }));

      if (matchedIngredients.length > 0) {
        setSelectedIngredients(matchedIngredients);
      }

      aiToast.success(
        matchedIngredients.length > 0
          ? `AI mengisi ${matchedIngredients.length} bahan baku + estimasi produksi otomatis!`
          : 'AI mengisi estimasi produksi & biaya operasional. Tambahkan bahan baku secara manual.'
      );

      // Auto-expand breakdown
      setShowBreakdown(false);
    } catch (err) {
      console.error('HPP AI Error:', err);
      aiToast.error('AI gagal menganalisa. Silakan coba lagi.');
    } finally {
      setIsHppAnalyzing(false);
    }
  };

  const fillAIRandom = async (field: 'sku' | 'category' | 'name', providedImageUrl?: string) => {
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;

    if (field === 'sku') {
      const randomSku = 'PROD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setForm(prev => ({ ...prev, sku: randomSku }));
      setAiFields(prev => new Set(prev).add('sku'));
      aiToast.info(`Generated random SKU`);
    } else if (field === 'category') {
      const cats = ['Minuman Dingin', 'Kopi Susu', 'Makanan Berat', 'Camilan', 'Roti & Pastry'];
      const randomCatName = cats[Math.floor(Math.random() * cats.length)];
      const existing = categories.find(c => c.name.toLowerCase() === randomCatName.toLowerCase());
      if (existing) {
        setForm(prev => ({ ...prev, category_id: existing.id }));
        setIsManualCategory(false);
      } else {
        setIsManualCategory(true);
        setManualCategoryName(randomCatName);
      }
      setAiFields(prev => new Set(prev).add('category_id'));
      aiToast.info(`Generated random Category`);
    } else if (field === 'name') {
      const targetUrl = providedImageUrl || form.image_url;
      
      // If online and have image, try AI
      if (isOnline && targetUrl) {
        setIsIdentifying(true);
        try {
          const aiData = await identifyProductFromImage(targetUrl);
          
          if (!aiData?.name) {
            throw new Error('AI kurang yakin dengan gambar ini. Menggunakan nama saran...');
          }

          const skuPrefix = aiData.name.substring(0, 3).toUpperCase();
          const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
          const generatedSku = `${skuPrefix}-${randomPart}`;

          setForm(prev => ({ 
            ...prev, 
            name: aiData.name,
            sku: prev.sku || generatedSku,
            price_sell: prev.price_sell || aiData.suggested_price,
            note: prev.note || aiData.description
          }));

          const existingCat = categories.find(c => 
            c.name.toLowerCase().includes(aiData.category.toLowerCase()) || 
            aiData.category.toLowerCase().includes(c.name.toLowerCase())
          );

          if (existingCat) {
            setForm(prev => ({ ...prev, category_id: existingCat.id }));
            setIsManualCategory(false);
          } else {
            setIsManualCategory(true);
            setManualCategoryName(aiData.category);
          }

          setAiFields(prev => {
            const next = new Set(prev);
            ['name', 'sku', 'price_sell', 'category_id', 'note'].forEach(f => next.add(f));
            return next;
          });
          
          aiToast.success(`AI berhasil mengidentifikasi detail produk!`);
          return;
        } catch (err: any) {
          console.error("AI Identification failed:", err);
          if (!providedImageUrl) {
            aiToast.error("AI sedang sibuk, beralih ke data acak...");
          }
        } finally {
          setIsIdentifying(false);
        }
      }

      // Fallback for offline or AI failure
      const names = ['Kopi Gula Aren Arabica', 'Matcha Latte Premium', 'Beef Burger Special', 'Spaghetti Carbonara', 'Croissant Almond'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      setForm(prev => ({ ...prev, name: randomName }));
      
      if (!isOnline) {
        aiToast.info("Mode Offline: Menggunakan nama acak");
      } else {
        aiToast.info(`Generated random Name`);
      }
      setAiFields(prev => new Set(prev).add('name'));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const [p, ing] = await Promise.all([
        db.products.toArray(),
        db.ingredients.toArray()
      ]);
      setProducts(p.filter(prod => !prod.deleted_at));
      setAllIngredients(ing.filter(i => !i.deleted_at));

      if (initialData) {
        setForm({
          ...initialData,
          category_id: initialData.category_id ?? '',
          prod_monthly_estimate: initialData.prod_monthly_estimate ?? 1000,
        });
        const prodIng = await db.product_ingredients.where('product_id').equals(initialData.id).toArray();
        setSelectedIngredients(prodIng.map(pi => ({
          ingredient_id: pi.ingredient_id,
          quantity: pi.quantity,
          is_packaging: pi.is_packaging || 0
        })));
      }
    };
    fetchData();
  }, [initialData]);

  // Categories loading handled by useLiveQuery above

  // Real-time Validation for SKU based on Barcode Type
  useEffect(() => {
    if (!form.sku) {
      setIsValid(true);
      setValidationMsg("");
      return;
    }

    const possiblePrefixes = ['E13', 'E8', 'UA', 'UE', 'C128', 'C39', 'ITF', 'QR', 'DM', 'PDF', 'ING', 'PROD'];
    const parts = form.sku.split('-');

    let codeToValidate = form.sku;
    if (parts.length > 1 && possiblePrefixes.includes(parts[0])) {
      codeToValidate = parts.slice(1).join('-');
    }

    if (!codeToValidate) {
      setIsValid(true);
      setValidationMsg("");
      return;
    }

    const rule = BARCODE_RULES[form.barcode_type || 'CODE128'];
    if (rule && rule.message) {
      const isOk = rule.regex.test(codeToValidate);
      setIsValid(isOk);
      setValidationMsg(isOk ? "" : rule.message + (rule.example ? ` Contoh: ${rule.example}` : ""));
    } else {
      setIsValid(true);
      setValidationMsg("");
    }
  }, [form.sku, form.barcode_type]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement> | string) => {
    let file: File | string;
    if (typeof e === 'string') {
      file = e;
    } else {
      const f = e.target.files?.[0];
      if (!f) return;
      file = f;
    }
    
    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      setForm(prev => ({ ...prev, image_url: url }));
      setIsUploading(false);
      toast.success('Foto produk berhasil diunggah');
      
      // Auto-identify product name after upload
      await fillAIRandom('name', url);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunggah foto');
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || form.price_sell === 0) {
      toast.error('Nama dan Harga Jual wajib diisi');
      return;
    }

    if (!userId) {
      toast.error('Sesi pengguna tidak ditemukan. Silakan refresh halaman.');
      return;
    }

    setSaving(true);
    try {
      let finalCategoryId = form.category_id;

      if (isManualCategory && manualCategoryName.trim()) {
        const isDuplicate = categories.some(cat => 
          cat.name.toLowerCase() === manualCategoryName.trim().toLowerCase()
        );
        if (isDuplicate) {
          toast.error('Kategori dengan nama ini sudah ada');
          setSaving(false);
          return;
        }
        const catId = createId();
        const newCat = {
          id: catId,
          user_id: userId || '',
          name: manualCategoryName.trim(),
          type: 'product' as const,
          updated_at: new Date().toISOString(),
          sync_status: 'pending' as const
        };
        await db.categories.add(newCat);
        await addToSyncQueue('categories', 'insert', catId, newCat);
        finalCategoryId = catId;
      }

      const id = initialData?.id || createId();
      const data: LocalProduct = {
        ...form,
        id,
        user_id: userId || '',
        name: form.name!,
        sku: form.sku || '',
        price_sell: Number(form.price_sell),
        price_cost: Number(form.price_cost),
        stock_store: Number(form.stock_store),
        stock_warehouse: Number(form.stock_warehouse),
        category_id: finalCategoryId || '',
        barcode_type: form.barcode_type || 'CODE128',
        updated_at: new Date().toISOString(),
        deleted_at: null,
        sync_status: 'pending'
      } as LocalProduct;

      if (initialData) {
        await db.products.put(data);
        await addToSyncQueue('products', 'update', id, data);
        
        // Fix: Delete remotely too
        const oldPIs = await db.product_ingredients.where('product_id').equals(id).toArray();
        await db.product_ingredients.where('product_id').equals(id).delete();
        for (const pi of oldPIs) await addToSyncQueue('product_ingredients', 'delete', pi.id, pi);

        if (selectedIngredients.length > 0) {
          const piData = selectedIngredients.map(si => ({
            id: createId(),
            user_id: userId || '',
            product_id: id,
            ingredient_id: si.ingredient_id,
            quantity: si.quantity,
            is_packaging: si.is_packaging || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
            sync_status: 'pending' as const
          }));
          await db.product_ingredients.bulkAdd(piData);
          for (const pi of piData) await addToSyncQueue('product_ingredients', 'insert', pi.id, pi);
        }
      } else {
        await db.products.add(data);
        await addToSyncQueue('products', 'insert', id, data);
        if (selectedIngredients.length > 0) {
          const piData = selectedIngredients.map(si => ({
            id: createId(),
            user_id: userId || '',
            product_id: id,
            ingredient_id: si.ingredient_id,
            quantity: si.quantity,
            is_packaging: si.is_packaging || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
            sync_status: 'pending' as const
          }));
          await db.product_ingredients.bulkAdd(piData);
          for (const pi of piData) await addToSyncQueue('product_ingredients', 'insert', pi.id, pi);
        }
      }


      toast.success(initialData ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
      if (onSuccess) onSuccess();
      else router.push('/produk');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan produk');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID').format(val);
  const parseCurrency = (val: string) => Number(val.replace(/\D/g, '')) || 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-2 sm:px-4 h-14 border-b border-slate-200 sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={() => onCancel ? onCancel() : router.back()}
            className="group p-1.5 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 shrink-0"
            title="Kembali"
          >
            <ChevronLeft className="size-4 text-slate-500 group-hover:text-slate-900" />
          </button>
          <div className="flex flex-col min-w-0 overflow-hidden">
            <h1 className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-indigo-600 mb-0.5 truncate">Product Studio</h1>
            <p className="text-[11px] sm:text-sm font-black text-slate-900 tracking-tight truncate whitespace-nowrap">
              {initialData ? 'Perbarui Produk' : 'Tambah Produk Baru'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
          <Button
            variant="ghost"
            onClick={() => onCancel ? onCancel() : router.back()}
            className="h-8 sm:h-9 px-2 sm:px-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg"
          >
            Batal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-8 sm:h-9 px-3 sm:px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-widest rounded-lg shadow-sm hover:shadow-md hover:shadow-indigo-100 gap-1.5 sm:gap-2 text-[9px] sm:text-xs"
          >
            {saving ? <Loader2 className="size-3 sm:size-3.5" /> : <Save className="size-3 sm:size-3.5" />}
            <span className="hidden sm:inline">{saving ? 'Simpan...' : 'Simpan'}</span>
            <span className="sm:hidden">{saving ? '...' : 'Simpan'}</span>
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full px-3 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

          {/* Left Column: Visual & Status */}
          <div className="lg:col-span-3 space-y-3">
            {/* Image Section */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm group">
              <MediaUploader 
                imageUrl={form.image_url}
                onUpload={handleImageUpload}
                onRemove={() => setForm({ ...form, image_url: '' })}
                isIdentifying={isIdentifying}
                modeLabel="Produk"
              />

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Status Katalog</span>
                  </div>
                  <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Ready</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="size-3.5 text-indigo-600" />
                    <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Update Terakhir</span>
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Baru</span>
                </div>
              </div>
            </div>

            {/* Profitability Quick View */}
            <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10">
                <TrendingUp className="size-20 -mr-4 -mt-4 rotate-12 text-indigo-500" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3 text-indigo-500" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-600">Analisa Laba Bersih</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Profit per Unit</p>
                  <h3 className="text-xl font-black text-emerald-600 tracking-tight">
                    Rp {Math.max(0, (form.price_sell || 0) - (form.price_cost || 0)).toLocaleString('id-ID')}
                  </h3>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Margin Laba</p>
                    <p className="text-[10px] font-black text-slate-900">
                      {form.price_sell ? Math.round(((form.price_sell - (form.price_cost || 0)) / form.price_sell) * 100) : 0}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Target Unit</p>
                    <p className="text-[10px] font-black text-indigo-600">
                      {form.price_sell && form.price_sell > (form.price_cost || 0) && targetMonthlyProfit > 0
                        ? Math.ceil(targetMonthlyProfit / (form.price_sell - (form.price_cost || 0))).toLocaleString('id-ID')
                        : 0} Pcs
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Form Details */}
          <div className="lg:col-span-9 space-y-3">

            {/* Section: Informasi Utama */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                  <LayoutGrid className="size-3" />
                </div>
                <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Informasi Utama Produk</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Jenis Barcode</Label>
                      <Tooltip>
                        <TooltipTrigger className="outline-none">
                          <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none p-2 shadow-xl">
                          Tentukan standar barcode yang akan digunakan untuk SKU produk ini.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={form.barcode_type} onValueChange={(v: string | null) => setForm({ ...form, barcode_type: (v || 'CODE128') as any })}>
                      <SelectTrigger className="h-9 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg font-bold shadow-none text-[11px]">
                        <SelectValue placeholder="Tipe" />
                      </SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} align="start" className="rounded-lg border-slate-200 p-1">
                        {[
                          { val: "CODE128", label: "Code 128 (Umum)" },
                          { val: "CODE39", label: "Code 39 (Alfanumerik)" },
                          { val: "EAN13", label: "EAN-13 (Ritel)" },
                          { val: "EAN8", label: "EAN-8 (Kemasan Kecil)" },
                          { val: "UPCA", label: "UPC-A (USA Standard)" }
                        ].map(type => (
                          <SelectItem key={type.val} value={type.val} className="rounded-lg font-bold text-slate-700 text-[11px] py-2.5 cursor-pointer">{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sku" className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">SKU / Kode Produk</Label>
                      <Tooltip>
                        <TooltipTrigger className="outline-none">
                          <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none p-2 shadow-xl">
                          Identitas unik produk. Bisa diketik manual atau scan barcode fisik.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="relative group">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
                      <Input
                        id="sku"
                        name="sku"
                        placeholder="Ketik Kode"
                        className={cn(
                          "h-9 pl-8 pr-10 border rounded-lg font-medium text-[11px]",
                          isValid
                            ? "bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700"
                            : "bg-rose-50 border-rose-200 focus:border-rose-600 focus:bg-white text-rose-600"
                        )}
                        value={form.sku}
                        onChange={e => {
                          setForm({ ...form, sku: e.target.value.toUpperCase() });
                          setAiFields(prev => {
                            const next = new Set(prev);
                            next.delete('sku');
                            return next;
                          });
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => fillAIRandom('sku')}
                        disabled={isIdentifying}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all",
                          isIdentifying 
                            ? "text-indigo-600 animate-pulse opacity-100" 
                            : "hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 focus:opacity-100",
                          aiFields.has('sku') || form.image_url ? "opacity-100 text-indigo-600" : "opacity-0 group-hover:opacity-100"
                        )}
                        title="Isi otomatis dengan AI"
                      >
                        {isIdentifying ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className={cn("size-3", aiFields.has('sku') && "animate-pulse")} />}
                      </button>
                      {!isValid && validationMsg && (
                        <Tooltip>
                          <TooltipTrigger className="absolute right-3 top-1/2 -translate-y-1/2 cursor-help outline-none">
                            <AlertCircle className="size-3.5 text-rose-500" />
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-none text-[10px] py-2 px-3 rounded-lg shadow-xl">
                            <div className="flex items-center gap-2">
                              <Info className="size-3 text-indigo-400" />
                              <p className="font-bold">{validationMsg}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="category" className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Kategori Produk</Label>
                    <Tooltip>
                      <TooltipTrigger className="outline-none">
                        <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none p-2 shadow-xl">
                        Kelompokkan produk untuk memudahkan pencarian dan laporan penjualan.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {isManualCategory ? (
                    <div className="flex gap-1.5">
                      <div className="relative flex-1 group">
                        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-indigo-600" />
                        <Input
                          id="category"
                          name="category"
                          placeholder="Nama Kategori Baru"
                          className="h-9 pl-8 pr-10 bg-white border-indigo-200 focus:border-indigo-600 rounded-lg font-bold text-[11px] shadow-sm shadow-indigo-50"
                          value={manualCategoryName}
                          onChange={e => {
                            setManualCategoryName(e.target.value);
                            setAiFields(prev => {
                              const next = new Set(prev);
                              next.delete('category_id');
                              return next;
                            });
                          }}
                          autoFocus
                        />
                        {aiFields.has('category_id') && (
                          <Sparkles className="absolute right-10 top-1/2 -translate-y-1/2 size-3 text-indigo-500 animate-pulse" />
                        )}
                        <button 
                          type="button"
                          onClick={() => fillAIRandom('category')}
                          disabled={isIdentifying}
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all",
                            isIdentifying 
                              ? "text-indigo-600 animate-pulse opacity-100" 
                              : "hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          )}
                          title="Isi otomatis dengan AI"
                        >
                          {isIdentifying ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                        </button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => {
                          setIsManualCategory(false);
                          setManualCategoryName("");
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={form.category_id} onValueChange={(v: string | null) => {
                      if (v === "NEW_CATEGORY") setIsManualCategory(true);
                      else setForm({ ...form, category_id: v || '' });
                    }}>
                      <SelectTrigger className="relative h-9 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg font-bold shadow-none text-[11px] pr-2">
                        <SelectValue placeholder="Pilih Kategori" className="flex-1 text-left">
                          {categories.find(c => c.id === form.category_id)?.name}
                        </SelectValue>
                        <span 
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fillAIRandom('category');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              fillAIRandom('category');
                            }
                          }}
                          className={cn(
                            "p-1 hover:bg-indigo-50 rounded-md transition-all shrink-0 cursor-pointer disabled:opacity-50",
                            aiFields.has('category_id') || form.image_url ? "opacity-100 text-indigo-600" : "opacity-40 hover:opacity-100 text-indigo-400 hover:text-indigo-600"
                          )}
                          title="Isi otomatis dengan AI"
                        >
                          {isIdentifying ? <Loader2 className="size-3 animate-spin text-indigo-600" /> : <Sparkles className={cn("size-3", aiFields.has('category_id') && "text-indigo-600 animate-pulse")} />}
                        </span>
                      </SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} align="start" className="rounded-lg border-slate-200 p-1">
                        <SelectItem value="NEW_CATEGORY" className="rounded-lg font-black text-indigo-600 text-[11px] bg-indigo-50/50 mb-1 focus:bg-indigo-600 focus:text-white py-2.5 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Plus className="size-3.5" />
                            <span>Tambah Kategori Baru</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="" className="rounded-lg font-bold text-slate-400 text-[11px] py-2.5 cursor-pointer italic">Tanpa Kategori</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id} className="rounded-lg font-bold text-slate-700 text-[11px] py-2.5 cursor-pointer">{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="product-name" className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Nama Produk</Label>
                    <Tooltip>
                      <TooltipTrigger className="outline-none">
                        <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none p-2 shadow-xl">
                        Nama lengkap produk yang akan muncul di struk belanja.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                    <div className="relative group">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-slate-400 group-focus-within:text-indigo-600" />
                      <Input
                        id="product-name"
                        name="product-name"
                        placeholder="Misal: Kopi Gula Aren Arabica"
                        className="h-9 pl-9 pr-10 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg text-[11px] font-medium"
                        value={form.name}
                        onChange={e => {
                          setForm({ ...form, name: e.target.value });
                          setAiFields(prev => {
                            const next = new Set(prev);
                            next.delete('name');
                            return next;
                          });
                        }}
                      />
                      <button 
                        type="button"
                        onClick={() => fillAIRandom('name')}
                        disabled={isIdentifying}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all",
                          isIdentifying 
                            ? "text-indigo-600 animate-pulse opacity-100" 
                            : "hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 focus:opacity-100",
                          aiFields.has('name') || form.image_url ? "opacity-100 text-indigo-600" : "opacity-0 group-hover:opacity-100"
                        )}
                        title={isIdentifying ? "Sedang mengidentifikasi..." : "Isi otomatis dengan AI Vision"}
                      >
                        {isIdentifying ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className={cn("size-3", aiFields.has('name') && "animate-pulse")} />}
                      </button>
                    </div>
                </div>
              </div>
            </div>

            {/* Section: Analisa Harga & Laba */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-900 shadow-sm">
                  <DollarSign className="size-3" />
                </div>
                <h2 className="text-[9px] font-black text-indigo-900 uppercase tracking-[0.2em]">Analisa Harga & Laba</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Harga Modal Section */}
                  <div className="space-y-3 p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="price-cost" className="text-[8px] font-black uppercase text-emerald-700 tracking-[0.1em] ml-1">Harga Modal (HPP)</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-emerald-400 hover:text-emerald-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Biaya pembuatan produk. Gunakan kalkulator untuk hitungan presisi.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative group flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-[10px]">Rp</span>
                          <Input
                            id="price-cost"
                            name="price-cost"
                            type="text"
                            placeholder="0"
                            className={cn(
                              "h-9 pl-8 bg-white border border-slate-200 focus:border-emerald-600 rounded-lg font-black text-xs shadow-none",
                              form.price_cost === 0 ? "text-slate-300" : "text-slate-900"
                            )}
                            value={form.price_cost === 0 ? "" : formatCurrency(form.price_cost || 0)}
                            onChange={e => setForm({ ...form, price_cost: parseCurrency(e.target.value) })}
                          />
                        </div>
                        <Button
                          onClick={() => setShowHppCalc(!showHppCalc)}
                          className={cn(
                            "h-9 w-9 p-0 rounded-lg shadow-sm border",
                            showHppCalc
                              ? "bg-emerald-600 text-white border-emerald-700"
                              : "bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                          )}
                        >
                          <Calculator className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Harga Jual Section */}
                  <div className="space-y-3 p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="price-sell" className="text-[8px] font-black uppercase text-indigo-700 tracking-[0.1em] ml-1">Harga Jual per Produk</Label>
                        <Tooltip>
                          <TooltipTrigger className="outline-none">
                            <Info className="size-2.5 text-indigo-400 hover:text-indigo-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none p-2 shadow-xl">
                            Harga yang dibayar oleh pelanggan di kasir.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-indigo-600 text-[10px]">Rp</span>
                        <Input
                          id="price-sell"
                          name="price-sell"
                          type="text"
                          placeholder="0"
                          className={cn(
                            "h-9 pl-8 border focus:border-indigo-600 focus:bg-white rounded-lg font-black text-xs shadow-none",
                            form.price_sell === 0 ? "text-slate-300" : "text-indigo-600"
                          )}
                          value={form.price_sell === 0 ? "" : formatCurrency(form.price_sell || 0)}
                          onChange={e => {
                            setForm({ ...form, price_sell: parseCurrency(e.target.value) });
                            setAiFields(prev => {
                              const next = new Set(prev);
                              next.delete('price_sell');
                              return next;
                            });
                          }}
                        />
                        {aiFields.has('price_sell') && (
                          <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-indigo-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inline HPP Calculator Expansion with Slide-down Animation */}
              <div className={cn(
                showHppCalc ? "block mt-4" : "hidden mt-0"
              )}>
                <div className="overflow-hidden">
                  <div className={cn(
                    "rounded-lg border border-slate-200 shadow-sm"
                  )}>
                    <div className="bg-indigo-600 p-5 sm:p-6 text-white flex items-center justify-between rounded-t-lg">
                      <div className="flex items-center gap-4">
                        <div className="size-8 sm:size-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                          <Calculator className="size-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100 leading-none mb-1">Pro Manufacturing HPP</span>
                          <span className="text-base sm:text-lg font-black tracking-tight">Kalkulator Biaya Produksi</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={fillHppWithAI}
                          disabled={isHppAnalyzing}
                          className="h-8 sm:h-9 px-3 sm:px-4 bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/40 rounded-lg gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-wider disabled:opacity-60"
                          title="Isi semua field kalkulator HPP secara otomatis dengan AI"
                        >
                          {isHppAnalyzing ? (
                            <>
                              <Loader2 className="size-3 sm:size-3.5 animate-spin" />
                              <span className="hidden sm:inline">Menganalisa...</span>
                              <span className="sm:hidden">AI...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="size-3 sm:size-3.5" />
                              <span className="hidden sm:inline">Analisa dengan AI</span>
                              <span className="sm:hidden">AI</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowHppCalc(false)}
                          className="h-8 w-8 sm:h-10 sm:w-10 p-0 text-white/40 hover:text-white hover:bg-white/10 rounded-lg"
                        >
                          <X className="size-4 sm:size-5" />
                        </Button>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-5 sm:p-8 space-y-6 overflow-y-auto">
                      {/* Section: Estimasi Produksi */}
                      <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="monthly-estimate" className="text-[10px] font-black uppercase text-amber-700 tracking-widest">Estimasi Total Produksi per Bulan</Label>
                            <Tooltip>
                              <TooltipTrigger className="inline-flex items-center outline-none">
                                <Info className="size-3 text-amber-400 hover:text-amber-600 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none p-2 shadow-xl">
                                Target jumlah produk yang dihasilkan dalam sebulan. Digunakan untuk membagi biaya operasional tetap.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <TrendingUp className="size-3 text-amber-500" />
                        </div>
                        <div className="relative group">
                          <Input
                            id="monthly-estimate"
                            name="monthly-estimate"
                            type="number"
                            placeholder="1000"
                            className="h-14 sm:h-16 w-full pl-6 pr-24 sm:pr-32 text-xl sm:text-2xl font-black bg-white border-2 border-slate-100 rounded-lg focus:border-indigo-500 focus:ring-0 shadow-sm"
                            value={form.prod_monthly_estimate || 1000}
                            onChange={e => setForm({ ...form, prod_monthly_estimate: Number(e.target.value) })}
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end">
                            <span className="text-[10px] sm:text-xs font-black text-amber-600 uppercase tracking-widest leading-none">Pcs / Bulan</span>
                          </div>
                        </div>
                        <p className="text-[7px] font-medium text-amber-600 italic leading-tight">
                          *Sistem akan membagi Biaya Bulanan di bawah dengan angka ini untuk mendapatkan alokasi biaya per unit secara otomatis.
                        </p>
                      </div>

                      {/* Section 1: Bahan Baku */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">1. Bahan Baku & Kemasan</Label>
                          <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded uppercase">BOM List</span>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-auto pr-1 pt-4">
                          {selectedIngredients.map((si, idx) => {
                            const ing = allIngredients.find(i => i.id === si.ingredient_id);
                            const subtotal = (ing?.cost_per_unit || 0) * si.quantity;
                            const usagePerPortion = si.quantity / (form.prod_output_qty || 1);

                            return (
                              <div key={idx} className="flex items-center gap-3 p-2.5 bg-white border border-slate-100 rounded-lg shadow-sm hover:border-indigo-200 group">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <p className="text-[10px] font-black text-slate-900 uppercase truncate tracking-tight">{ing?.name || 'Bahan'}</p>
                                    <span className={cn(
                                      "text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-tighter",
                                      si.is_packaging ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                    )}>
                                      {si.is_packaging ? 'Kemasan' : 'Bahan'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[8px] font-bold text-slate-400">Rp {formatCurrency(ing?.cost_per_unit || 0)} / {ing?.unit}</p>
                                    {si.quantity > 0 && (
                                      <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                        <TrendingUp className="size-2 text-indigo-500" />
                                        <span className="text-[7px] font-black text-indigo-600 uppercase">
                                          {usagePerPortion >= 1
                                            ? `${usagePerPortion.toFixed(1)} ${ing?.unit} / Porsi`
                                            : `${(usagePerPortion * 1000).toFixed(0)} ${ing?.unit?.toLowerCase() === 'kg' ? 'Gram' : ing?.unit?.toLowerCase() === 'liter' ? 'ML' : ing?.unit} / Porsi`
                                          }
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="relative group/hint flex items-center gap-1">
                                      {(ing?.unit?.toLowerCase() === 'kg' || ing?.unit?.toLowerCase() === 'liter') && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const currentVal = si.quantity;
                                            const newIngs = [...selectedIngredients];
                                            // Toggle logic: if >= 1 convert to decimal, if < 1 convert to whole
                                            newIngs[idx].quantity = currentVal >= 1 ? currentVal / 1000 : currentVal * 1000;
                                            setSelectedIngredients(newIngs);
                                          }}
                                          className="h-10 px-3 bg-indigo-50 border border-indigo-100 rounded-lg text-[9px] font-black text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm"
                                          title={ing?.unit?.toLowerCase() === 'kg' ? "Konversi ke Kg (Bagi 1000)" : "Konversi ke Liter (Bagi 1000)"}
                                        >
                                          {ing?.unit?.toLowerCase() === 'kg' ? 'G → KG' : 'ML → L'}
                                        </button>
                                      )}

                                      <div className="relative">
                                        <Input
                                          type="number"
                                          step="0.001"
                                          style={{ width: `${Math.max(100, (si.quantity?.toString()?.length || 1) * 14 + 40)}px` }}
                                          className="h-10 text-xs font-black bg-slate-50 border-slate-200 rounded-lg text-center focus:bg-white focus:border-indigo-500 shadow-none px-4 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={si.quantity}
                                          onChange={e => {
                                            const newIngs = [...selectedIngredients];
                                            newIngs[idx].quantity = Number(e.target.value);
                                            setSelectedIngredients(newIngs);
                                          }}
                                        />
                                        {/* Auto Conversion Label for Kg/Liter */}
                                        {(ing?.unit?.toLowerCase() === 'kg' || ing?.unit?.toLowerCase() === 'liter') && si.quantity > 0 && si.quantity < 1 && (
                                          <div className="absolute -top-3.5 right-0 bg-indigo-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-sm shadow-sm pointer-events-none whitespace-nowrap">
                                            {si.quantity * 1000} {ing?.unit?.toLowerCase() === 'kg' ? 'Gram' : 'ML'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          const newIngs = [...selectedIngredients];
                                          newIngs[idx].is_packaging = newIngs[idx].is_packaging ? 0 : 1;
                                          setSelectedIngredients([...newIngs]);
                                        }}
                                        className={cn(
                                          "p-2.5 rounded-lg border",
                                          si.is_packaging ? "border-amber-200 text-amber-600 bg-amber-50" : "border-slate-100 text-slate-300 hover:text-slate-400"
                                        )}
                                        title="Tandai sebagai Kemasan"
                                      >
                                        <Package className="size-4" />
                                      </button>
                                      <button
                                        onClick={() => setSelectedIngredients(prev => prev.filter((_, i) => i !== idx))}
                                        className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                                        title="Hapus Bahan"
                                      >
                                        <Trash2 className="size-4.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Biaya:</span>
                                    <p className={cn(
                                      "text-[10px] font-black tracking-tight",
                                      subtotal > (form.price_sell || 0) * 0.5 ? "text-rose-600" : "text-indigo-600"
                                    )}>
                                      Rp {formatCurrency(subtotal)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        </div>
                        <Select
                          value={tempIngId}
                          onValueChange={(v: string | null) => {
                            if (!v) return;
                            if (selectedIngredients.some(si => si.ingredient_id === v)) {
                              setTempIngId("");
                              return;
                            }
                            const ing = allIngredients.find(i => i.id === v);
                            setSelectedIngredients(prev => [...prev, { 
                              ingredient_id: v as string, 
                              quantity: 1, 
                              is_packaging: ing?.type === 'packaging' ? 1 : 0 
                            }]);
                            setTempIngId("");
                          }}
                        >
                          <SelectTrigger className="h-11 w-full font-bold bg-white border-slate-200 rounded-lg shadow-sm text-xs focus:border-indigo-500 focus:ring-0 shadow-none">
                            <SelectValue placeholder="Pilih bahan baku/kemasan..." />
                          </SelectTrigger>
                          <SelectContent side="bottom" sideOffset={4} align="start" className="w-[var(--radix-select-trigger-width)] max-h-[300px]">
                            {allIngredients.map(ing => (
                              <SelectItem key={ing.id} value={ing.id} className="text-xs font-medium">
                                {ing.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Section 2: Detail Produksi */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">2. Kapasitas & Efisiensi</Label>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center outline-none">
                              <Info className="size-3 text-slate-300 hover:text-indigo-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs bg-slate-900 text-white border-none p-2 shadow-xl">
                              Konfigurasi hasil produksi per satu kali proses (batch).
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[7px] font-semibold uppercase text-slate-400 tracking-tighter">Target Batch</Label>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="size-2 text-slate-300 hover:text-indigo-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[9px] bg-slate-900 text-white border-none">
                                  Berapa kali produksi dalam satu siklus perhitungan.
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              type="number"
                              placeholder="1"
                              className="h-10 text-xs font-bold bg-slate-50 border-slate-100 rounded-lg focus:border-indigo-500 focus:ring-0 shadow-none text-center"
                              value={form.prod_target_batch || 1}
                              onChange={e => setForm({ ...form, prod_target_batch: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-[7px] font-semibold uppercase text-slate-400 tracking-tighter">Produk Jadi</Label>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="size-2 text-slate-300 hover:text-indigo-500 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-[9px] bg-slate-900 text-white border-none">
                                  Total kuantitas produk yang dihasilkan (Pcs/Porti).
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              type="number"
                              placeholder="Jumlah"
                              className="h-10 text-xs font-bold bg-slate-50 border-slate-100 rounded-lg focus:border-indigo-500 focus:ring-0 shadow-none text-center"
                              value={form.prod_output_qty || 1}
                              onChange={e => setForm({ ...form, prod_output_qty: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[7px] font-semibold uppercase text-slate-400 tracking-tighter">Bahan Terbuang (%)</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                className="h-10 pr-6 text-xs font-bold bg-slate-50 border-slate-100 rounded-lg focus:border-indigo-500 focus:ring-0 shadow-none text-center"
                                value={form.prod_wastage_percent || 0}
                                onChange={e => setForm({ ...form, prod_wastage_percent: Number(e.target.value) })}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black opacity-30">%</span>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[7px] font-semibold uppercase text-slate-400 tracking-tighter">Efisiensi & Pajak (%)</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                className="h-10 pr-6 text-xs font-bold bg-slate-50 border-slate-100 rounded-lg focus:border-indigo-500 focus:ring-0 shadow-none text-center"
                                value={form.prod_tax_efficiency || 0}
                                onChange={e => setForm({ ...form, prod_tax_efficiency: Number(e.target.value) })}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black opacity-30">%</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between shadow-sm">
                          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Porsi per Batch</span>
                          <span className="text-sm font-black text-indigo-900">{(form.prod_output_qty || 1) / (form.prod_target_batch || 1)} Pcs/Porti</span>
                        </div>
                      </div>

                      {/* Section 3: Biaya Operasional Lainnya */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex flex-col gap-1">
                            <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">3. Biaya Operasional & Overheads (Total Bulanan)</Label>
                            <span className="text-[8px] text-slate-400 font-bold leading-tight">Masukkan total biaya sewa, listrik, gaji, dll dalam sebulan.</span>
                          </div>
                          <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded uppercase">Custom Overheads</span>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
                                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-40">Total / Bulan</th>
                                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-32">Tipe</th>
                                <th className="py-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-12 text-center"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(form.prod_operational_costs || []).map((cost, idx) => (
                                <tr key={idx} className="border-b border-slate-50 last:border-0 group">
                                  <td className="py-1.5 px-3">
                                    <Input
                                      className="h-7 text-[10px] font-medium border-transparent bg-transparent focus:bg-slate-50 focus:border-blue-400 focus:ring-0 shadow-none px-2"
                                      value={cost.name}
                                      placeholder="Misal: Sewa Alat"
                                      onChange={e => {
                                        const newCosts = [...(form.prod_operational_costs || [])];
                                        newCosts[idx].name = e.target.value;
                                        setForm({ ...form, prod_operational_costs: newCosts });
                                      }}
                                    />
                                  </td>
                                  <td className="py-1.5 px-3">
                                    <div className="relative">
                                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-medium opacity-30">Rp</span>
                                      <Input
                                        className="h-7 pl-5 pr-2 text-[10px] font-medium border-transparent bg-transparent focus:bg-slate-50 focus:border-blue-400 focus:ring-0 shadow-none"
                                        value={cost.amount === 0 ? "" : formatCurrency(cost.amount)}
                                        placeholder="0"
                                        onChange={e => {
                                          const newCosts = [...(form.prod_operational_costs || [])];
                                          newCosts[idx].amount = parseCurrency(e.target.value);
                                          setForm({ ...form, prod_operational_costs: newCosts });
                                        }}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-3">
                                    <Select
                                      value={cost.type}
                                      onValueChange={(v: string | null) => {
                                        const newCosts = [...(form.prod_operational_costs || [])];
                                        newCosts[idx].type = v as string;
                                        setForm({ ...form, prod_operational_costs: newCosts });
                                      }}
                                    >
                                      <SelectTrigger className="h-6 text-[9px] font-medium border-transparent bg-transparent hover:bg-slate-50 p-0 shadow-none">
                                        <SelectValue placeholder="Tipe" />
                                      </SelectTrigger>
                                      <SelectContent side="bottom" sideOffset={4} align="end">
                                        <SelectItem value="Tenaga Kerja" className="text-[10px] font-medium">Tenaga Kerja</SelectItem>
                                        <SelectItem value="Logistik" className="text-[10px] font-medium">Logistik</SelectItem>
                                        <SelectItem value="Operasional" className="text-[10px] font-medium">Operasional</SelectItem>
                                        <SelectItem value="Utility" className="text-[10px] font-medium">Utility</SelectItem>
                                        <SelectItem value="Lainnya" className="text-[10px] font-medium">Lainnya</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="py-1.5 px-3 text-center">
                                    <button
                                      onClick={() => {
                                        const newCosts = (form.prod_operational_costs || []).filter((_, i) => i !== idx);
                                        setForm({ ...form, prod_operational_costs: newCosts });
                                      }}
                                      className="p-1 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"
                                      title="Hapus Biaya"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              <tr>
                                <td colSpan={4} className="p-0">
                                  <button
                                    onClick={() => {
                                      const newCosts = [...(form.prod_operational_costs || []), { name: '', amount: 0, type: 'Operasional' }];
                                      setForm({ ...form, prod_operational_costs: newCosts });
                                    }}
                                    className="w-full py-3 flex items-center justify-center gap-2 text-[8px] font-semibold uppercase text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border-t border-slate-100 border-dashed"
                                  >
                                    <Plus className="size-3" />
                                    Tambah Biaya Operasional
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Summary & Apply */}
                      <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="grid grid-cols-2 gap-6 flex-1 w-full">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Biaya Produksi</span>
                            <span className="text-sm font-semibold text-indigo-900">
                              {(() => {
                                const rawCost = selectedIngredients.reduce((sum, si) => sum + (allIngredients.find(i => i.id === si.ingredient_id)?.cost_per_unit || 0) * si.quantity, 0);
                                const adjustedRaw = rawCost / (1 - (form.prod_wastage_percent || 0) / 100);
                                const opCosts = (form.prod_operational_costs || []).reduce((sum, c) => sum + (c.amount || 0), 0);
                                // Allocation of monthly overheads
                                const monthlyEstimate = form.prod_monthly_estimate || 1000;
                                const unitOverhead = opCosts / monthlyEstimate;

                                const totalPerUnit = adjustedRaw + unitOverhead;
                                const finalTotal = totalPerUnit * (1 + (form.prod_tax_efficiency || 0) / 100);
                                return `Rp ${formatCurrency(finalTotal * (form.prod_output_qty || 1))}`;
                              })()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 text-right sm:text-left">
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none">HPP Final per Unit</span>
                            <span className="text-xl font-semibold text-indigo-600">
                              {(() => {
                                const rawCost = selectedIngredients.reduce((sum, si) => sum + (allIngredients.find(i => i.id === si.ingredient_id)?.cost_per_unit || 0) * si.quantity, 0);
                                const adjustedRaw = rawCost / (1 - (form.prod_wastage_percent || 0) / 100);
                                const opCosts = (form.prod_operational_costs || []).reduce((sum, c) => sum + (c.amount || 0), 0);
                                const monthlyEstimate = form.prod_monthly_estimate || 1000;
                                const unitOverhead = opCosts / monthlyEstimate;

                                const totalPerUnit = (adjustedRaw / (form.prod_output_qty || 1)) + unitOverhead;
                                const finalHpp = totalPerUnit * (1 + (form.prod_tax_efficiency || 0) / 100);
                                return `Rp ${formatCurrency(Math.ceil(finalHpp))}`;
                              })()}
                            </span>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            const rawCost = selectedIngredients.reduce((sum, si) => sum + (allIngredients.find(i => i.id === si.ingredient_id)?.cost_per_unit || 0) * si.quantity, 0);
                            const adjustedRaw = rawCost / (1 - (form.prod_wastage_percent || 0) / 100);
                            const opCosts = (form.prod_operational_costs || []).reduce((sum, c) => sum + (c.amount || 0), 0);
                            const monthlyEstimate = form.prod_monthly_estimate || 1000;
                            const unitOverhead = opCosts / monthlyEstimate;

                            const totalPerUnit = (adjustedRaw / (form.prod_output_qty || 1)) + unitOverhead;
                            const finalHpp = totalPerUnit * (1 + (form.prod_tax_efficiency || 0) / 100);

                            setForm({
                              ...form,
                              price_cost: Math.ceil(finalHpp)
                            });
                            setShowBreakdown(true);
                            toast.success("Analisa HPP Manufaktur berhasil diterapkan");
                          }}
                          className="w-full sm:w-auto h-12 px-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs rounded-lg shadow-lg shadow-indigo-100 gap-3"
                        >
                          <Check className="size-4" />
                          {showBreakdown ? 'Update Perhitungan' : 'Terapkan & Lihat Rumus'}
                        </Button>
                      </div>

                      {/* Mathematical Breakdown Section */}
                      {showBreakdown && (
                        <div className="mt-6 p-5 bg-white rounded-lg border border-slate-200 shadow-xl">
                          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <Calculator className="size-4 text-indigo-600" />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-900">Logika Perhitungan HPP (Scientific)</span>
                            </div>
                            <button
                              onClick={() => setShowHppCalc(false)}
                              className="text-[8px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest"
                            >
                              Selesai & Tutup
                            </button>
                          </div>

                          <div className="font-mono text-[10px] space-y-4 leading-relaxed">
                            {/* Formula 1: Raw Cost */}
                            <div className="space-y-1">
                              <p className="text-indigo-600 font-bold uppercase tracking-tighter">Step 1: Total Biaya Bahan Baku (Raw BOM)</p>
                              <div className="pl-3 border-l-2 border-slate-100 py-1">
                                <p className="text-slate-400 italic mb-1">Σ (Qty Bahan × Harga Satuan)</p>
                                <p className="text-slate-700 font-medium">
                                  {selectedIngredients.map((si, i) => {
                                    const ing = allIngredients.find(x => x.id === si.ingredient_id);
                                    return `${ing?.name} (${si.quantity}${ing?.unit})` + (i === selectedIngredients.length - 1 ? "" : " + ");
                                  })}
                                </p>
                                <p className="text-emerald-600 font-bold mt-1">
                                  = Rp {formatCurrency(selectedIngredients.reduce((sum, si) => sum + (allIngredients.find(i => i.id === si.ingredient_id)?.cost_per_unit || 0) * si.quantity, 0))}
                                </p>
                              </div>
                            </div>

                            {/* Formula 2: Wastage */}
                            <div className="space-y-1">
                              <p className="text-indigo-600 font-bold uppercase tracking-tighter">Step 2: Penyesuaian Bahan Terbuang (Wastage)</p>
                              <div className="pl-3 border-l-2 border-slate-100 py-1">
                                <p className="text-slate-400 italic mb-1">Raw Cost / (1 - Wastage %)</p>
                                <p className="text-slate-700 font-medium">
                                  Rp {formatCurrency(selectedIngredients.reduce((sum, si) => sum + (allIngredients.find(i => i.id === si.ingredient_id)?.cost_per_unit || 0) * si.quantity, 0))} / (1 - {form.prod_wastage_percent || 0}%)
                                </p>
                                <p className="text-emerald-600 font-bold mt-1">
                                  = Rp {formatCurrency(Math.ceil(selectedIngredients.reduce((sum, si) => sum + (allIngredients.find(i => i.id === si.ingredient_id)?.cost_per_unit || 0) * si.quantity, 0) / (1 - (form.prod_wastage_percent || 0) / 100)))}
                                </p>
                              </div>
                            </div>

                            {/* Formula 3: Overhead Allocation */}
                            <div className="space-y-1">
                              <p className="text-indigo-600 font-bold uppercase tracking-tighter">Step 3: Alokasi Biaya Operasional (Overhead)</p>
                              <div className="pl-3 border-l-2 border-slate-100 py-1">
                                <p className="text-slate-400 italic mb-1">Total Biaya Bulanan / Estimasi Produksi Bulanan</p>
                                <p className="text-slate-700 font-medium">
                                  Rp {formatCurrency((form.prod_operational_costs || []).reduce((sum, c) => sum + (c.amount || 0), 0))} / {form.prod_monthly_estimate || 1000} Pcs
                                </p>
                                <p className="text-emerald-600 font-bold mt-1">
                                  = Rp {formatCurrency(Math.ceil(((form.prod_operational_costs || []).reduce((sum, c) => sum + (c.amount || 0), 0)) / (form.prod_monthly_estimate || 1000)))} / unit
                                </p>
                              </div>
                            </div>

                            {/* Final Result */}
                            <div className="pt-3 border-t border-slate-100 space-y-2">
                              <p className="text-amber-600 font-black uppercase tracking-widest text-[11px]">Final Calculation</p>
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <p className="text-slate-500 mb-2 font-medium">
                                  ((Wastage Adjusted Cost / Output Qty) + Unit Overhead) × (1 + Efficiency/Tax %)
                                </p>
                                <p className="text-2xl font-black text-indigo-600 tracking-tight">
                                  Rp {formatCurrency(form.price_cost || 0)} <span className="text-[10px] text-slate-400 font-normal uppercase tracking-widest ml-2">Final HPP per Unit</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Pricing Suggestions */}
              {showBreakdown && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-3 text-indigo-600" />
                      <Label className="text-[10px] font-black uppercase text-slate-800 tracking-widest">Saran Harga</Label>
                    </div>
                    <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-tighter">✧ AI Optimized</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { label: 'Kompetitif', margin: 30, color: 'text-slate-400' },
                      { label: 'Standar', margin: 50, color: 'text-slate-400' },
                      { label: 'Premium', margin: 70, color: 'text-slate-400' }
                    ].map((tier, i) => {
                      const suggested = Math.ceil(((form.price_cost || 0) / (1 - tier.margin / 100)) / 100) * 100;
                      const isActive = form.price_sell === suggested;

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, price_sell: suggested });
                            toast.success(`Harga ${tier.label} Rp ${formatCurrency(suggested)} diterapkan`);
                          }}
                          className={cn(
                            "p-2 sm:p-4 rounded-lg border text-left relative group overflow-hidden",
                            isActive
                              ? "bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-100 scale-[1.02] z-10"
                              : "bg-white border-slate-100 hover:border-indigo-400 hover:shadow-md text-slate-600"
                          )}
                        >
                          {isActive && (
                            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-white/20 rounded-full p-0.5 sm:p-1">
                              <Check className="size-2 sm:size-3 text-white" />
                            </div>
                          )}
                          <div className={cn(
                            "text-[7px] sm:text-[8px] font-black uppercase tracking-widest mb-1 sm:mb-1.5",
                            isActive ? "text-indigo-100" : "text-slate-400 group-hover:text-indigo-500"
                          )}>
                            {tier.label}
                          </div>
                          <div className={cn("text-xs sm:text-lg font-black tracking-tight leading-none", isActive ? "text-white" : "text-slate-900")}>
                            Rp {formatCurrency(suggested)}
                          </div>
                          <div className={cn(
                            "mt-2 pt-2 sm:mt-3 sm:pt-3 border-t flex flex-col sm:flex-row justify-between text-[6px] sm:text-[7px] font-bold gap-0.5",
                            isActive ? "border-white/10 text-indigo-100" : "border-slate-50 text-slate-400"
                          )}>
                            <span>Profit: Rp {formatCurrency(Math.max(0, suggested - (form.price_cost || 0)))}</span>
                            <span className="sm:text-right">M: {tier.margin}%</span>
                          </div>

                          {!isActive && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-400 scale-x-0 group-hover:scale-x-100 origin-left" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section: Level Stok & Target */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                    <Target className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Level Stok & Target Penjualan</h2>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stok Toko */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                      <div className="flex items-center justify-between">
                        <Label className="text-[8px] font-black uppercase text-amber-700 tracking-[0.1em] ml-1">Stok Toko</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-amber-400 hover:text-amber-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Jumlah produk yang tersedia di rak atau area penjualan.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setForm({ ...form, stock_store: Math.max(0, (form.stock_store || 0) - 1) })} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Kurangi Stok Toko"><Minus className="size-3" /></button>
                        <Input
                          type="number"
                          className={cn(
                            "h-9 flex-1 border-0 rounded-none font-black text-center text-xs focus-visible:ring-0",
                            form.stock_store === 0 ? "text-slate-300" : "text-slate-900"
                          )}
                          value={form.stock_store === 0 ? "" : form.stock_store}
                          onChange={e => setForm({ ...form, stock_store: Number(e.target.value) })}
                        />
                        <button type="button" onClick={() => setForm({ ...form, stock_store: (form.stock_store || 0) + 1 })} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Tambah Stok Toko"><Plus className="size-3" /></button>
                      </div>
                    </div>

                    {/* Stok Gudang */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-sky-50/50 border border-sky-100">
                      <div className="flex items-center justify-between">
                        <Label className="text-[8px] font-black uppercase text-sky-700 tracking-[0.1em] ml-1">Stok Gudang</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-sky-400 hover:text-sky-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Stok cadangan yang disimpan di gudang belakang.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <button type="button" onClick={() => setForm({ ...form, stock_warehouse: Math.max(0, (form.stock_warehouse || 0) - 1) })} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Kurangi Stok Gudang"><Minus className="size-3" /></button>
                        <Input
                          type="number"
                          className={cn(
                            "h-9 flex-1 border-0 rounded-none font-black text-center text-xs focus-visible:ring-0",
                            form.stock_warehouse === 0 ? "text-slate-300" : "text-slate-900"
                          )}
                          value={form.stock_warehouse === 0 ? "" : form.stock_warehouse}
                          onChange={e => setForm({ ...form, stock_warehouse: Number(e.target.value) })}
                        />
                        <button type="button" onClick={() => setForm({ ...form, stock_warehouse: (form.stock_warehouse || 0) + 1 })} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="Tambah Stok Gudang"><Plus className="size-3" /></button>
                      </div>
                    </div>

                    {/* Target Laba */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-slate-50/50 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Target Laba Bersih / Bulan</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-slate-300 hover:text-slate-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Keuntungan bersih yang ingin Anda capai untuk produk ini dalam satu bulan.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-[10px]">Rp</span>
                        <Input
                          placeholder="Contoh: 10.000.000"
                          className="h-9 pl-8 bg-white border border-slate-200 focus:border-indigo-600 rounded-lg font-black text-xs shadow-none"
                          value={targetMonthlyProfit === 0 ? "" : formatCurrency(targetMonthlyProfit)}
                          onChange={e => setTargetMonthlyProfit(parseCurrency(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Catatan */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                    <Info className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Catatan Tambahan</h2>
                </div>
                <div className="p-4">
                  <Textarea
                    placeholder="Tuliskan deskripsi produk, varian rasa, atau instruksi khusus di sini..."
                    className="min-h-[60px] bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg p-2.5 font-medium text-slate-700 resize-none shadow-none text-[10px]"
                    value={form.note}
                    onChange={e => {
                      setForm({ ...form, note: e.target.value });
                      setAiFields(prev => {
                        const next = new Set(prev);
                        next.delete('note');
                        return next;
                      });
                    }}
                  />
                  {aiFields.has('note') && (
                    <Sparkles className="absolute right-3 top-3 size-3 text-indigo-500 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

