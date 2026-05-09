'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, LocalProduct } from '@/db/dexie';
import { useStaffStore } from '@/store/useStaffStore';
import { createId } from '@/utils/uuid';
import { addToSyncQueue } from '@/services/sync/syncManager';
import { triggerSync } from '@/hooks/useSync';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, SkipForward, RefreshCw, FileSpreadsheet, X, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsLayout } from '@/features/settings/SettingsLayout';

interface ImportRow {
  name: string;
  sku: string;
  category?: string;
  price_sell: number;
  price_cost: number;
  stock_store: number;
  stock_warehouse: number;
  image_url?: string;
  _conflict?: boolean;
}

export default function ImportPage() {
  const router = useRouter();
  const { session } = useStaffStore();
  const userId = session?.id;
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [conflictMode, setConflictMode] = useState<'skip' | 'overwrite'>('skip');
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [existingProducts, setExistingProducts] = useState<LocalProduct[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [p, c] = await Promise.all([
        db.products.toArray(),
        db.categories.toArray(),
      ]);
      setExistingProducts(p);
      setCategories(c);
    };
    fetchData();
  }, []);

  const REQUIRED_HEADERS = ['nama', 'sku'];
  const HEADER_MAP: Record<string, keyof ImportRow> = {
    'nama': 'name', 'name': 'name',
    'sku': 'sku',
    'harga jual': 'price_sell', 'price_sell': 'price_sell', 'harga': 'price_sell',
    'harga modal': 'price_cost', 'price_cost': 'price_cost', 'modal': 'price_cost',
    'stok toko': 'stock_store', 'stock_store': 'stock_store', 'stok': 'stock_store',
    'stok gudang': 'stock_warehouse', 'stock_warehouse': 'stock_warehouse', 'gudang': 'stock_warehouse',
    'kategori': 'category', 'category': 'category',
    'foto': 'image_url', 'photo': 'image_url', 'image': 'image_url', 'url': 'image_url', 'image_url': 'image_url',
  };

  const handleFile = (file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (raw.length < 2) {
          setError('File kosong atau tidak valid. Pastikan ada baris header dan minimal 1 baris data.');
          return;
        }

        const headers = (raw[0] as string[]).map(h => String(h).toLowerCase().trim());
        const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.some(fh => HEADER_MAP[fh] === HEADER_MAP[h]));
        if (missingHeaders.length > 0) {
          setError(`Header wajib tidak ditemukan: ${missingHeaders.join(', ')}. Pastikan file memiliki kolom Nama dan SKU.`);
          return;
        }

        const parsed: ImportRow[] = raw.slice(1)
          .filter(row => row.some(cell => cell !== undefined && cell !== ''))
          .map(row => {
            const obj: Partial<ImportRow> = {};
            headers.forEach((h, i) => {
              const key = HEADER_MAP[h];
              if (key) {
                const val = row[i];
                if (key === 'name' || key === 'category' || key === 'sku' || key === 'image_url') {
                  (obj as any)[key] = String(val ?? '').trim();
                } else {
                  (obj as any)[key] = Number(String(val ?? '0').replace(/[^0-9]/g, '')) || 0;
                }
              }
            });
            const conflict = existingProducts.some(p => p.sku === obj.sku && !p.deleted_at);
            return {
              name: obj.name || '',
              sku: obj.sku || '',
              category: obj.category || '',
              price_sell: obj.price_sell ?? 0,
              price_cost: obj.price_cost ?? 0,
              stock_store: obj.stock_store ?? 0,
              stock_warehouse: obj.stock_warehouse ?? 0,
              image_url: obj.image_url || '',
              _conflict: conflict,
            } as ImportRow;
          })
          .filter(row => row.name && row.sku);

        setRows(parsed);
      } catch (err) {
        setError('Gagal membaca file. Pastikan format file adalah .xlsx atau .csv yang valid.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearFile = () => {
    setRows([]);
    setFileName('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        const catId = categories.find(c => c.name.toLowerCase() === row.category?.toLowerCase())?.id || '';
        const id = createId();
        const data: LocalProduct = {
          id: id,
          user_id: userId,
          sku: row.sku,
          name: row.name,
          price_sell: row.price_sell,
          price_cost: row.price_cost,
          image_url: row.image_url || '',
          category_id: catId,
          stock_store: row.stock_store,
          stock_warehouse: row.stock_warehouse,
          sync_status: 'pending' as const,
          updated_at: new Date().toISOString()
        };

        if (row._conflict) {
          if (conflictMode === 'overwrite') {
            const existing = existingProducts.find(p => p.sku === row.sku);
            if (existing) {
              const updatedData = { ...data, id: existing.id };
              await db.products.put(updatedData);
              await addToSyncQueue('products', 'update', existing.id, updatedData);
              imported++;
            }
          } else {
            skipped++;
          }
        } else {
          await db.products.add(data);
          await addToSyncQueue('products', 'insert', id, data);
          imported++;
        }
      }
      toast.success(`Import selesai: ${imported} produk berhasil, ${skipped} dilewati`);
      triggerSync(userId).catch(console.error);
      router.push('/produk');
    } catch (err) {
      toast.error('Gagal mengimport produk');
    } finally {
      setImporting(false);
    }
  };

  const conflicts = rows.filter(r => r._conflict).length;
  const valid = rows.filter(r => !r._conflict).length;
  const toCurrency = (v: number) => `Rp ${v.toLocaleString('id-ID')}`;

  return (
    <SettingsLayout
      title="Impor Produk"
      rightAction={
        rows.length > 0 && (
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest px-6" onClick={handleImport} disabled={importing}>
            {importing ? 'Memproses...' : `Impor ${rows.length} Produk`}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4">
        {/* Upload area */}
        <div className="relative">
          <div
            className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all ${
              fileName
                ? 'border-indigo-400/40 bg-indigo-500/5 cursor-default'
                : 'border-slate-200 cursor-pointer hover:border-indigo-400 hover:bg-slate-50'
            }`}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !fileName && inputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-4">
              <div className={`p-6 rounded-[2rem] ${fileName ? 'bg-indigo-600 shadow-xl shadow-indigo-100' : 'bg-slate-100'}`}>
                <FileSpreadsheet className={`h-10 w-10 ${fileName ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className={`font-black uppercase tracking-widest text-xs ${fileName ? 'text-slate-900' : 'text-slate-400'}`}>
                  {fileName || 'Pilih atau Seret File Excel/CSV'}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-2">
                  {fileName ? 'File siap dianalisa & diimpor' : 'Mendukung format .xlsx, .xls, dan .csv'}
                </p>
              </div>
              {!fileName && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-[0.2em] mt-2 transition-all active:scale-90"
                >
                  Buka Explorer
                </button>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {fileName && (
            <button
              onClick={clearFile}
              className="absolute -top-3 -right-3 h-10 w-10 rounded-full bg-white border border-slate-100 shadow-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-100 transition-all active:scale-90"
              title="Hapus file"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Format guide */}
        {rows.length === 0 && !error && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Aturan Kolom Header</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { h: 'Nama / Name', r: 'Wajib', d: 'Digunakan sebagai label produk' },
                { h: 'SKU', r: 'Wajib', d: 'Kode unik produk (Max 50 karakter)' },
                { h: 'Harga Jual', r: 'Opsional', d: 'Harga retail ke pelanggan' },
                { h: 'Harga Modal', r: 'Opsional', d: 'Harga beli (HPP)' },
                { h: 'Stok Toko', r: 'Opsional', d: 'Jumlah stok tersedia di toko' },
                { h: 'Kategori', r: 'Opsional', d: 'Nama kategori produk' },
                { h: 'Foto', r: 'Opsional', d: 'Link Cloudinary / URL foto' },
              ].map((item) => (
                <div key={item.h} className="flex flex-col gap-1 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-700">{item.h}</span>
                    <span className={item.r === 'Wajib' ? 'text-[9px] font-black text-red-500 uppercase tracking-widest' : 'text-[9px] font-black text-slate-300 uppercase tracking-widest'}>{item.r}</span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex gap-4 items-start rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <p className="text-xs font-black text-red-600 uppercase tracking-widest">Gagal Membaca File</p>
              <p className="text-xs font-bold text-red-500/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                <p className="text-2xl font-black text-slate-800">{rows.length}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Item</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p className="text-2xl font-black text-emerald-600">{valid}</p>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Baris Baru</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                <p className="text-2xl font-black text-amber-600">{conflicts}</p>
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-1">Konflik SKU</p>
              </div>
            </div>

            {/* Conflict mode */}
            {conflicts > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Deteksi Konflik SKU</p>
                    <p className="text-[10px] font-bold text-amber-700/70 mt-0.5">Beberapa SKU sudah terdaftar. Apa yang ingin dilakukan?</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    size="sm" 
                    variant={conflictMode === 'skip' ? 'default' : 'outline'} 
                    onClick={() => setConflictMode('skip')} 
                    className={conflictMode === 'skip' ? "bg-amber-600 hover:bg-amber-700 border-transparent rounded-xl" : "border-amber-200 text-amber-600 hover:bg-amber-100 rounded-xl"}
                  >
                    <SkipForward className="h-3.5 w-3.5 mr-2" />
                    Lewati (Aman)
                  </Button>
                  <Button 
                    size="sm" 
                    variant={conflictMode === 'overwrite' ? 'default' : 'outline'} 
                    onClick={() => setConflictMode('overwrite')} 
                    className={conflictMode === 'overwrite' ? "bg-indigo-600 hover:bg-indigo-700 border-transparent rounded-xl" : "border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl"}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Timpa Data Lama
                  </Button>
                </div>
              </div>
            )}

            {/* Table preview */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview Data</p>
                <span className="text-[10px] font-bold text-slate-300">Hanya menampilkan 20 baris pertama</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50 bg-slate-50/30">
                      {['Status', 'Produk', 'SKU', 'Harga', 'Stok'].map(h => (
                        <th key={h} className="text-[10px] font-black uppercase tracking-widest text-slate-400 p-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className={`hover:bg-slate-50/50 transition-colors ${row._conflict ? 'bg-amber-500/5' : ''}`}>
                        <td className="p-4">
                          {row._conflict
                            ? <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase">Konflik</span>
                            : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-bold text-slate-800 truncate max-w-[150px]">{row.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{row.category || 'Tanpa Kategori'}</p>
                        </td>
                        <td className="p-4 font-mono text-[10px] font-bold text-indigo-600">{row.sku}</td>
                        <td className="p-4 text-xs font-bold text-slate-700">{toCurrency(row.price_sell)}</td>
                        <td className="p-4 text-xs font-black text-slate-800">{row.stock_store + row.stock_warehouse}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsLayout>
  );
}
