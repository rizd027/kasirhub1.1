'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { db, LocalProduct } from '@/lib/dexie';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ChevronLeft, AlertTriangle, CheckCircle2, SkipForward, RefreshCw, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';

interface ImportRow {
  name: string;
  sku: string;
  category?: string;
  price_sell: number;
  price_cost: number;
  stock_store: number;
  stock_warehouse: number;
  _conflict?: boolean;
}

interface ImportDialogProps {
  onClose: () => void;
  onSuccess: () => void;
  existingProducts: LocalProduct[];
  categories: { id: string; name: string }[];
}

export function ImportDialog({ onClose, onSuccess, existingProducts, categories }: ImportDialogProps) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [conflictMode, setConflictMode] = useState<'skip' | 'overwrite'>('skip');
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const REQUIRED_HEADERS = ['nama', 'sku'];
  const HEADER_MAP: Record<string, keyof ImportRow> = {
    'nama': 'name', 'name': 'name',
    'sku': 'sku',
    'harga jual': 'price_sell', 'price_sell': 'price_sell', 'harga': 'price_sell',
    'harga modal': 'price_cost', 'price_cost': 'price_cost', 'modal': 'price_cost',
    'stok toko': 'stock_store', 'stock_store': 'stock_store', 'stok': 'stock_store',
    'stok gudang': 'stock_warehouse', 'stock_warehouse': 'stock_warehouse', 'gudang': 'stock_warehouse',
    'kategori': 'category', 'category': 'category',
  };

  const handleFile = (file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
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
                if (key === 'name' || key === 'category' || key === 'sku') {
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
        const data: LocalProduct = {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          sku: row.sku,
          name: row.name,
          price_sell: row.price_sell,
          price_cost: row.price_cost,
          image_url: '',
          category_id: catId,
          stock_store: row.stock_store,
          stock_warehouse: row.stock_warehouse,
        };

        if (row._conflict) {
          if (conflictMode === 'overwrite') {
            const existing = existingProducts.find(p => p.sku === row.sku);
            if (existing) {
              await db.products.put({ ...data, id: existing.id });
              imported++;
            }
          } else {
            skipped++;
          }
        } else {
          await db.products.add(data);
          imported++;
        }
      }
      toast.success(`Import selesai: ${imported} produk berhasil, ${skipped} dilewati`);
      onSuccess();
      onClose();
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
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-y-auto pb-20">
      <header className="flex items-center h-14 border-b bg-card sticky top-0 z-40 px-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold ml-1">Import Produk</h1>
        {rows.length > 0 && (
          <Button size="sm" className="ml-auto mr-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleImport} disabled={importing}>
            {importing ? 'Mengimport...' : `Import ${rows.length} Produk`}
          </Button>
        )}
      </header>

      <div className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-6">
        {/* Upload area */}
        <div className="relative">
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              fileName
                ? 'border-indigo-400/40 bg-indigo-500/5 cursor-default'
                : 'border-muted-foreground/20 cursor-pointer hover:border-primary/40 hover:bg-muted/5'
            }`}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !fileName && inputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full ${fileName ? 'bg-indigo-500/15' : 'bg-indigo-500/10'}`}>
                <FileSpreadsheet className={`h-8 w-8 ${fileName ? 'text-indigo-500' : 'text-indigo-400'}`} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${fileName ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {fileName || 'Pilih atau drag file Excel/CSV'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fileName ? 'File siap diimport' : 'Format: .xlsx, .xls, .csv'}
                </p>
              </div>
              {!fileName && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
                  className="text-xs font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-widest mt-1 transition-colors"
                >
                  Pilih File
                </button>
              )}
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {/* X button to clear file */}
          {fileName && (
            <button
              onClick={clearFile}
              className="absolute -top-2.5 -right-2.5 h-7 w-7 rounded-full bg-card border shadow-md flex items-center justify-center text-muted-foreground hover:text-red-500 hover:border-red-300 transition-all"
              title="Hapus file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Format guide */}
        {rows.length === 0 && !error && (
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Format Header yang Didukung</p>
            <div className="grid grid-cols-2 gap-1 text-xs">
              {[['Nama / Name', 'Wajib'], ['SKU', 'Wajib'], ['Harga Jual', 'Opsional'], ['Harga Modal', 'Opsional'], ['Stok Toko', 'Opsional'], ['Stok Gudang', 'Opsional'], ['Kategori', 'Opsional']].map(([h, r]) => (
                <div key={h} className="flex justify-between gap-2">
                  <span className="font-mono font-medium">{h}</span>
                  <span className={r === 'Wajib' ? 'text-red-500' : 'text-muted-foreground'}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex gap-3 items-start rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-card p-3 text-center">
                <p className="text-2xl font-bold">{rows.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Baris</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{valid}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Baru</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{conflicts}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Konflik SKU</p>
              </div>
            </div>

            {/* Conflict mode */}
            {conflicts > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold">{conflicts} SKU sudah ada</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={conflictMode === 'skip' ? 'default' : 'outline'} onClick={() => setConflictMode('skip')} className="gap-1.5">
                    <SkipForward className="h-3.5 w-3.5" /> Lewati
                  </Button>
                  <Button size="sm" variant={conflictMode === 'overwrite' ? 'default' : 'outline'} onClick={() => setConflictMode('overwrite')} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Timpa
                  </Button>
                </div>
              </div>
            )}

            {/* Table preview */}
            <div className="rounded-xl border overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground p-3 bg-muted/30 border-b">
                Preview ({rows.length} baris)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/20">
                    <tr>
                      {['Status', 'Nama', 'SKU', 'Harga Jual', 'Stok'].map(h => (
                        <th key={h} className="text-left p-2 font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className={`border-b last:border-0 ${row._conflict ? 'bg-amber-500/5' : ''}`}>
                        <td className="p-2">
                          {row._conflict
                            ? <span className="text-amber-600 font-medium">Konflik</span>
                            : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        </td>
                        <td className="p-2 font-medium max-w-[120px] truncate">{row.name}</td>
                        <td className="p-2 font-mono">{row.sku}</td>
                        <td className="p-2">{toCurrency(row.price_sell)}</td>
                        <td className="p-2">{row.stock_store + row.stock_warehouse}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <p className="text-xs text-muted-foreground p-3 text-center">...dan {rows.length - 20} baris lainnya</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
