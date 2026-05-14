'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Ingredient } from '@/db/dexie';
import { 
  ChevronLeft, Save, Package, Scale, 
  DollarSign, AlertCircle, Info, Tag, 
  Camera, Loader2, Trash2, LayoutGrid,
  ShieldCheck, History, ArrowRight,
  Plus, X, Barcode, Utensils, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from 'sonner';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';
import { useStaffStore } from '@/store/useStaffStore';
import { uploadImage } from '@/services/cloudinary';
import { cn } from '@/lib/utils';
import { analyzeImage, aiToast } from '@/services/aiService';
import { MediaUploader } from '@/components/ui/MediaUploader';

const BARCODE_RULES: {[key: string]: { regex: RegExp, message: string, example: string }} = {
  'EAN-13': { regex: /^\d{13}$/, message: "EAN-13 harus tepat 13 digit angka.", example: "8991234567890" },
  'EAN-8': { regex: /^\d{8}$/, message: "EAN-8 harus tepat 8 digit angka.", example: "12345678" },
  'UPC-A': { regex: /^\d{12}$/, message: "UPC-A harus tepat 12 digit angka.", example: "012345678901" },
  'UPC-E': { regex: /^\d{6}$/, message: "UPC-E harus tepat 6 digit angka.", example: "123456" },
  'ITF-14': { regex: /^\d{14}$/, message: "ITF-14 harus tepat 14 digit angka.", example: "12345678901234" },
  'Code 39': { regex: /^[A-Z0-9\-\.\$\/\+\%\s]+$/, message: "Code 39: Hanya huruf besar, angka, dan simbol standar.", example: "PROD-101" },
  'Code 128': { regex: /^[\x20-\x7F]+$/, message: "Code 128: Mendukung alfanumerik & simbol standar.", example: "SKU-128-ABC" },
  'QR Code': { regex: /.+/, message: "", example: "" },
  'Data Matrix': { regex: /.+/, message: "", example: "" },
  'PDF417': { regex: /.+/, message: "", example: "" }
};

export default function AddIngredientDetailedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');
  const { session } = useStaffStore();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    sku: '',
    barcode: '',
    barcode_type: 'Code 128',
    name: '',
    unit: 'Gram',
    cost_per_unit: 0,
    stock_min: 0,
    stock_current: 0,
    category_id: '',
    image_url: '',
    note: '',
    type: 'ingredient' as 'ingredient' | 'packaging'
  });

  const categories = useLiveQuery(async () => {
    const cats = await db.categories.toArray();
    return cats.filter(c => {
      const isDeleted = !!c.deleted_at;
      if (isDeleted) return false;
      
      const isSelected = c.id === form.category_id;
      const typeMatch = !c.type || c.type === form.type; // Allow legacy (no type) or matching type
      
      return isSelected || typeMatch;
    });
  }, [form.type, form.category_id]) || [];

  const [isManualCategory, setIsManualCategory] = useState(false);
  const [manualCategoryName, setManualCategoryName] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [validationMsg, setValidationMsg] = useState("");
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());

  const fillAIRandom = async (field: 'sku' | 'category' | 'name', providedImageUrl?: string) => {
    const isOnline = typeof window !== 'undefined' ? navigator.onLine : true;

    if (field === 'sku') {
      const randomSku = 'SKU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      setForm(prev => ({ ...prev, sku: randomSku }));
      setAiFields(prev => new Set(prev).add('sku'));
      aiToast.info(`Generated random SKU`);
    } else if (field === 'category') {
      const cats = ['Bahan Pokok', 'Bumbu Dapur', 'Kemasan Plastik', 'Toping Minuman', 'Susu & Diary'];
      const randomCat = cats[Math.floor(Math.random() * cats.length)];
      const existing = categories.find(c => c.name.toLowerCase() === randomCat.toLowerCase());
      if (existing) {
        setForm(prev => ({ ...prev, category_id: existing.id }));
        setIsManualCategory(false);
      } else {
        setIsManualCategory(true);
        setManualCategoryName(randomCat);
      }
      setAiFields(prev => new Set(prev).add('category_id'));
      aiToast.info(`Generated random Category`);
    } else if (field === 'name') {
      const targetUrl = providedImageUrl || form.image_url;

      // If online and have image, try AI
      if (isOnline && targetUrl) {
        setIsIdentifying(true);
        try {
          const aiData = await analyzeImage(targetUrl, 'ingredient');
          
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
            unit: aiData.unit || prev.unit,
            type: aiData.type || prev.type,
            cost_per_unit: aiData.cost_per_unit || prev.cost_per_unit,
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
            ['name', 'sku', 'unit', 'type', 'cost_per_unit', 'category_id', 'note'].forEach(f => next.add(f));
            return next;
          });

          aiToast.success(`AI berhasil mengidentifikasi bahan baku!`);
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
      const names = ['Kopi Arabica Gayo', 'Gula Pasir Kristal', 'Susu UHT Full Cream', 'Cup Plastic 16oz', 'Sedotan Bambu Eco'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      setForm(prev => ({ ...prev, name: randomName }));
      
      if (!isOnline) {
        toast.info("Mode Offline: Menggunakan nama acak");
      } else {
        toast.success(`Generated random ${field.toUpperCase()}`);
      }
    }
  };


  // Categories handled by useLiveQuery above

  useEffect(() => {
    const loadData = async () => {
      if (editId) {
        const existing = await db.ingredients.get(editId);
        if (existing) {
          setForm({
            sku: existing.sku || '',
            barcode: existing.barcode || '',
            barcode_type: existing.barcode_type || 'Code 128',
            name: existing.name || '',
            unit: existing.unit || 'Gram',
            cost_per_unit: existing.cost_per_unit || 0,
            stock_min: existing.stock_min || 0,
            stock_current: existing.stock_current || 0,
            category_id: existing.category_id || '',
            image_url: existing.image_url || '',
            note: existing.note || '',
            type: existing.type || 'ingredient'
          });
        }
      }
    };
    loadData();
  }, [editId]);

  // Real-time Validation for SKU based on Barcode Type
  useEffect(() => {
    if (!form.sku) {
      setIsValid(true);
      setValidationMsg("");
      return;
    }

    // Try to detect if there's a prefix (e.g., E13-, C39-, etc.)
    const possiblePrefixes = ['E13', 'E8', 'UA', 'UE', 'C128', 'C39', 'ITF', 'QR', 'DM', 'PDF', 'ING'];
    const parts = form.sku.split('-');
    
    let codeToValidate = form.sku;
    if (parts.length > 1 && possiblePrefixes.includes(parts[0])) {
      // If a known prefix is used, validate only what comes after the first dash
      codeToValidate = parts.slice(1).join('-');
    }

    // Don't validate if they just typed the prefix (e.g., "E13-")
    if (!codeToValidate) {
      setIsValid(true);
      setValidationMsg("");
      return;
    }

    const rule = BARCODE_RULES[form.barcode_type];
    if (rule && rule.message) {
      const isOk = rule.regex.test(codeToValidate);
      setIsValid(isOk);
      setValidationMsg(isOk ? "" : rule.message + (rule.example ? ` Contoh: ${rule.example}` : ""));
    } else {
      setIsValid(true);
      setValidationMsg("");
    }
  }, [form.sku, form.barcode_type]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID').format(val);
  };

  const parseCurrency = (val: string) => {
    return Number(val.replace(/\D/g, '')) || 0;
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement> | string) => {
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
      setForm(prev => ({ ...prev, image_url: url }));
      setUploading(false); // Reset uploading status immediately
      toast.success('Foto bahan berhasil diunggah');
      
      // Auto-identify with AI
      await fillAIRandom('name', url);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunggah foto');
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || form.cost_per_unit <= 0) {
      toast.error('Nama dan Harga per Satuan wajib diisi');
      return;
    }

    setSaving(true);
    try {
      let finalCategoryId = form.category_id;

      // Handle manual category creation
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
          user_id: session?.id || '',
          name: manualCategoryName.trim(),
          type: form.type as any,
          updated_at: new Date().toISOString(),
          deleted_at: null,
          sync_status: 'pending' as const
        };
        await db.categories.add(newCat);
        await addToSyncQueue('categories', 'insert', catId, newCat);
        finalCategoryId = catId;
      }

      if (editId) {
        const data: Partial<Ingredient> = {
          sku: form.sku,
          name: form.name,
          unit: form.unit,
          cost_per_unit: form.cost_per_unit,
          stock_min: form.stock_min,
          stock_current: form.stock_current,
          category_id: finalCategoryId,
          barcode: form.barcode,
          barcode_type: form.barcode_type,
          image_url: form.image_url,
          note: form.note,
          type: form.type,
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        };
        await db.ingredients.update(editId, data);
        await addToSyncQueue('ingredients', 'update', editId, data);
        toast.success('Bahan baku berhasil diperbarui');
      } else {
        const id = createId();
        const data: Ingredient = {
          id,
          user_id: session?.id || '',
          sku: form.sku,
          name: form.name,
          unit: form.unit,
          cost_per_unit: form.cost_per_unit,
          stock_min: form.stock_min,
          stock_current: form.stock_current,
          category_id: finalCategoryId,
          barcode: form.barcode,
          barcode_type: form.barcode_type,
          image_url: form.image_url,
          note: form.note,
          type: form.type,
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        };

        await db.ingredients.add(data);
        await addToSyncQueue('ingredients', 'insert', id, data);
        toast.success('Bahan baku baru berhasil disimpan');
      }
      triggerSync(session?.id).catch(console.error);
      router.push('/bahan-baku');
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan bahan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50">
      {/* Top Navigation */}
      <div className="flex items-center justify-between px-2 md:px-4 h-14 border-b border-slate-200 sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 pr-2">
          <button 
            onClick={() => router.back()} 
            className="group shrink-0 p-1.5 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200"
            title="Kembali"
          >
            <ChevronLeft className="size-4 text-slate-500 group-hover:text-slate-900" />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-[8px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-indigo-600 mb-0.5 truncate">Ingredient Studio</h1>
            <p className="text-xs md:text-sm font-black text-slate-900 tracking-tight truncate">{editId ? 'Perbarui Bahan & Kemasan' : 'Tambah Bahan & Kemasan'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="ghost"
            onClick={() => router.back()}
            className="hidden sm:flex h-9 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg"
          >
            Batal
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="h-8 md:h-9 px-3 md:px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] md:text-[10px] uppercase tracking-widest rounded-lg shadow-sm hover:shadow-md hover:shadow-indigo-100 gap-1.5 md:gap-2"
          >
            {saving ? <Loader2 className="size-3 md:size-3.5 animate-spin" /> : <Save className="size-3 md:size-3.5" />}
            <span className="hidden md:inline">{saving ? 'Simpan...' : 'Simpan Bahan'}</span>
            <span className="md:hidden">{saving ? 'Simpan' : 'Simpan'}</span>
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
                onUpload={handleUploadPhoto}
                onRemove={() => setForm({ ...form, image_url: '' })}
                isIdentifying={isIdentifying}
                modeLabel="Bahan Baku"
              />
              
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md border border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-emerald-600" />
                    <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">Status Data</span>
                  </div>
                  <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Ready</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md border border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="size-3.5 text-indigo-600" />
                    <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">History</span>
                  </div>
                  <ArrowRight className="size-3.5 text-slate-300" />
                </div>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-indigo-600 rounded-lg p-3 text-white shadow-sm">
               <div className="flex items-center gap-2 mb-2 opacity-80">
                  <Info className="size-3" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]">Estimasi Modal</span>
               </div>
               <div className="space-y-0.5">
                  <p className="text-[8px] font-bold opacity-60 uppercase tracking-widest">Total Nilai Stok</p>
                  <h3 className="text-lg font-black tracking-tight">Rp {(form.stock_current * form.cost_per_unit).toLocaleString('id-ID')}</h3>
               </div>
               <div className="mt-3 pt-2 border-t border-white/10 flex justify-between items-end">
                  <div>
                    <p className="text-[8px] font-bold opacity-60 uppercase tracking-widest mb-0.5">Satuan</p>
                    <p className="text-[9px] font-black uppercase tracking-widest">{form.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold opacity-60 uppercase tracking-widest mb-0.5">Limit Alert</p>
                    <p className="text-[9px] font-black uppercase tracking-widest">{form.stock_min}</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Right Column: Form Details */}
          <div className="lg:col-span-9 space-y-3">
            
            {/* Section: Informasi Utama */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <div className="size-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                   <LayoutGrid className="size-3" />
                </div>
                <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Informasi Utama</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Tipe Bahan</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'ingredient' })}
                      className={cn(
                        "h-10 rounded-lg flex items-center justify-center gap-2 border-2 font-black text-[10px] uppercase tracking-widest transition-all",
                        form.type === 'ingredient'
                          ? "bg-indigo-50 border-indigo-600 text-indigo-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Utensils className="size-4" />
                      Bahan Baku
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'packaging' })}
                      className={cn(
                        "h-10 rounded-lg flex items-center justify-center gap-2 border-2 font-black text-[10px] uppercase tracking-widest transition-all",
                        form.type === 'packaging'
                          ? "bg-amber-50 border-amber-600 text-amber-600 shadow-sm"
                          : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <Package className="size-4" />
                      Kemasan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Tipe Barcode</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                          Format barcode untuk label bahan baku ini.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select value={form.barcode_type} onValueChange={(v) => setForm({...form, barcode_type: v || ''})}>
                      <SelectTrigger className="h-9 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg font-bold shadow-none text-[11px]">
                        <SelectValue placeholder="Tipe" />
                      </SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} alignItemWithTrigger={false} className="rounded-md border-slate-200 p-1">
                        {["EAN-13", "EAN-8", "UPC-A", "UPC-E", "Code 128", "Code 39", "ITF-14", "QR Code", "Data Matrix", "PDF417"].map(type => (
                          <SelectItem key={type} value={type} className="rounded-md font-bold text-slate-700 text-[11px] py-2.5 cursor-pointer">{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">SKU / Kode Bahan</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                          Kode unik untuk identifikasi bahan di gudang.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="relative group">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
                      <Input 
                        placeholder="Ketik Kode"
                        className={cn(
                          "h-9 pl-8 pr-10 border rounded-lg font-medium text-[11px]",
                          isValid 
                            ? "bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700" 
                            : "bg-rose-50 border-rose-200 focus:border-rose-600 focus:bg-white text-rose-600"
                        )}
                        value={form.sku}
                        onChange={e => {
                          setForm({...form, sku: e.target.value});
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
                          <TooltipTrigger>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 cursor-help">
                              <AlertCircle className="size-3.5 text-rose-500" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-none text-[10px] py-2 px-3 rounded-md shadow-xl">
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
                    <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Kategori</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                        Kelompokkan bahan (misal: Bubuk, Cairan, Kemasan).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {isManualCategory ? (
                    <div className="flex gap-1.5">
                      <div className="relative flex-1 group">
                        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-indigo-600" />
                        <Input 
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
                    <Select value={form.category_id} onValueChange={(v) => {
                      if (v === "NEW_CATEGORY") {
                        setIsManualCategory(true);
                      } else {
                        setForm({...form, category_id: v || ''});
                      }
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
                      <SelectContent side="bottom" sideOffset={4} alignItemWithTrigger={false} className="rounded-md border-slate-200 p-1">
                        <SelectItem value="NEW_CATEGORY" className="rounded-md font-black text-indigo-600 text-[11px] bg-indigo-50/50 mb-1 focus:bg-indigo-600 focus:text-white py-2.5 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Plus className="size-3.5" />
                            <span>Tambah Kategori Baru</span>
                          </div>
                        </SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id} className="rounded-md font-bold text-slate-700 text-[11px] py-2.5 cursor-pointer">{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[8px] font-black uppercase text-slate-500 tracking-[0.1em] ml-1">Nama Lengkap Bahan Baku</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="size-2.5 text-slate-300 hover:text-indigo-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                          Gunakan nama yang jelas dan spesifik.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="relative group">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-slate-400 group-focus-within:text-indigo-600" />
                      <Input 
                        placeholder="Misal: Bubuk Matcha Premium Kyoto"
                        className="h-9 pl-9 pr-10 bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg text-[11px] font-medium"
                        value={form.name}
                        onChange={e => {
                          setForm({...form, name: e.target.value});
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
                        title="Isi otomatis dengan AI"
                      >
                        {isIdentifying ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className={cn("size-3", aiFields.has('name') && "animate-pulse")} />}
                      </button>
                    </div>
                </div>
              </div>
            </div>

            {/* Section: Harga & Stok */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <div className="size-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                   <DollarSign className="size-3" />
                </div>
                <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Harga & Inventory</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Harga Section */}
                  <div className="space-y-3 p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[8px] font-black uppercase text-emerald-700 tracking-[0.1em] ml-1">Harga Beli per Satuan</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-emerald-400 hover:text-emerald-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Harga beli terakhir dari supplier.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-[10px]">Rp</span>
                        <Input 
                          type="text"
                          placeholder="0"
                          className={cn(
                            "h-9 pl-8 bg-white border border-slate-200 focus:border-emerald-600 rounded-lg font-black text-xs shadow-none",
                            form.cost_per_unit === 0 ? "text-slate-300" : "text-slate-900"
                          )}
                          value={form.cost_per_unit === 0 ? "" : formatCurrency(form.cost_per_unit)}
                          onChange={e => {
                            setForm({...form, cost_per_unit: parseCurrency(e.target.value)});
                            setAiFields(prev => {
                              const next = new Set(prev);
                              next.delete('cost_per_unit');
                              return next;
                            });
                          }}
                        />
                        {aiFields.has('cost_per_unit') && (
                          <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-indigo-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[8px] font-black uppercase text-emerald-700 tracking-[0.1em] ml-1">Satuan Pakai</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-emerald-400 hover:text-emerald-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Unit pengukuran (misal: Gram, ML, Pcs).
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <Scale className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-emerald-600" />
                        <Input 
                          placeholder="Gram / ML / Pcs"
                          className="h-9 pl-8 bg-white border border-slate-200 focus:border-emerald-600 rounded-lg font-bold shadow-none uppercase text-[9px]"
                          value={form.unit}
                          onChange={e => {
                            setForm({...form, unit: e.target.value});
                            setAiFields(prev => {
                              const next = new Set(prev);
                              next.delete('unit');
                              return next;
                            });
                          }}
                        />
                        {aiFields.has('unit') && (
                          <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 size-3 text-emerald-500 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stok Section */}
                  <div className="space-y-3 p-3.5 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[8px] font-black uppercase text-amber-700 tracking-[0.1em] ml-1">Stok Saat Ini</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-amber-400 hover:text-amber-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Jumlah stok fisik yang ada saat ini.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <Input 
                          type="number"
                          placeholder="0"
                          className={cn(
                            "h-9 bg-white border border-slate-200 focus:border-amber-600 rounded-lg font-black text-xs shadow-none pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                            form.stock_current === 0 ? "text-slate-300" : "text-slate-900"
                          )}
                          value={form.stock_current === 0 ? "" : form.stock_current}
                          onChange={e => setForm({...form, stock_current: Number(e.target.value)})}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-amber-600 uppercase tracking-widest">{form.unit}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[8px] font-black uppercase text-amber-700 tracking-[0.1em] ml-1">Stok Minimum (Alert)</Label>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="size-2.5 text-amber-400 hover:text-amber-600 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px] bg-slate-900 text-white border-none">
                            Batas stok untuk memicu peringatan "Menipis".
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="relative">
                        <Input 
                          type="number"
                          placeholder="0"
                          className={cn(
                            "h-9 bg-white border border-slate-200 focus:border-amber-600 rounded-lg font-bold shadow-none text-[10px] pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                            form.stock_min === 0 ? "text-slate-300" : "text-slate-900"
                          )}
                          value={form.stock_min === 0 ? "" : form.stock_min}
                          onChange={e => setForm({...form, stock_min: Number(e.target.value)})}
                        />
                        <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-amber-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Catatan */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
               <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                  <div className="size-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                    <Info className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">Catatan Tambahan</h2>
               </div>
               <div className="p-4">
                  <Textarea 
                    placeholder="Tuliskan spesifikasi bahan, supplier, atau instruksi penyimpanan di sini..."
                    className="min-h-[60px] bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg p-2.5 font-medium text-slate-700 resize-none shadow-none text-[10px]"
                    value={form.note}
                    onChange={e => {
                      setForm({...form, note: e.target.value});
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
  );
}
