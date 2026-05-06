'use client';

import { useState, useEffect } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const PREF_KEY = 'kasirhub_prefs';

interface Prefs {
  language: 'id' | 'en';
  currency: string;
  dateFormat: string;
  defaultMode: string;
  paperSize: string;
  ppnPercent: number;
  taxMode: 'inclusive' | 'exclusive';
  serviceChargePercent: number;
  pesanNota: string;
  kebijakanPengembalian: string;
  printerConnection: 'none' | 'bluetooth' | 'usb' | 'network';
  autoPrint: boolean;
  showLogoOnReceipt: boolean;
  showQrOnReceipt: boolean;
  showCashierName: boolean;
  lowStockThreshold: number;
  backupFrequency: 'manual' | 'hourly' | 'daily' | 'on_close';
}

const defaults: Prefs = {
  language: 'id',
  currency: 'IDR',
  dateFormat: 'dd/MM/yyyy',
  defaultMode: 'minimarket',
  paperSize: '58mm',
  ppnPercent: 11,
  taxMode: 'exclusive',
  serviceChargePercent: 0,
  pesanNota: 'Terima kasih sudah berbelanja!',
  kebijakanPengembalian: 'Barang yang sudah dibeli tidak dapat ditukar.',
  printerConnection: 'none',
  autoPrint: false,
  showLogoOnReceipt: false,
  showQrOnReceipt: false,
  showCashierName: false,
  lowStockThreshold: 10,
  backupFrequency: 'manual',
};

export default function PreferensiPage() {
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const [initialPrefs, setInitialPrefs] = useState<Prefs>(defaults);
  const [customCurrency, setCustomCurrency] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(PREF_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const data = { ...defaults, ...parsed };
        setPrefs(data);
        setInitialPrefs(data);
        if (!['IDR', 'USD', 'MYR'].includes(data.currency)) {
          setCustomCurrency(data.currency);
        }
      } catch (e) {
        console.error("Failed to parse prefs", e);
      }
    }
  }, []);

  const isDirty = JSON.stringify(prefs) !== JSON.stringify(initialPrefs);

  const [isTestingPrint, setIsTestingPrint] = useState(false);

  const handleSave = async () => {
    if (!isDirty) return;
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    setInitialPrefs(prefs);
    toast.success('Preferensi operasional berhasil disimpan!');

    // Sync to cloud
    try {
      const { triggerSync } = await import('@/hooks/useSync');
      await triggerSync();
    } catch (err) {
      console.error('Auto-sync failed:', err);
    }
  };

  const handleTestPrint = async () => {
    setIsTestingPrint(true);
    const toastId = toast.loading(`Mencoba tes print (${prefs.printerConnection.toUpperCase()})...`);

    try {
      if (prefs.printerConnection === 'bluetooth') {
        const { testPrintBluetooth } = await import('@/lib/printer');
        await testPrintBluetooth();
        toast.success('Tes print terkirim ke printer Bluetooth!', { id: toastId });
      } else if (prefs.printerConnection === 'usb') {
        const { testPrintUSB } = await import('@/lib/printer');
        await testPrintUSB();
        toast.success('Tes print terkirim ke printer USB!', { id: toastId });
      } else {
        // Browser Print Fallback for 'none' or 'network' (simulation)
        const printWindow = window.open('', '_blank', 'width=300,height=600');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Test Print - KasirHub</title>
                <style>
                  body { font-family: monospace; padding: 20px; font-size: 12px; }
                  .center { text-align: center; }
                  hr { border: 0; border-top: 1px dashed #ccc; }
                </style>
              </head>
              <body>
                <div class="center">
                  <strong>KASIRHUB TEST PRINT</strong><br>
                  --------------------------------
                </div>
                Waktu: ${new Date().toLocaleString()}<br>
                Koneksi: ${prefs.printerConnection.toUpperCase()}<br>
                Ukuran: ${prefs.paperSize}<br>
                --------------------------------
                <div class="center">
                  <br>Tes Berhasil!<br>
                  Terima kasih sudah mencoba.<br>
                  www.kasirhub.id
                </div>
                <script>
                  window.onload = function() { window.print(); window.close(); }
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
          toast.success('Pratinjau struk tes telah dibuka.', { id: toastId });
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Gagal melakukan tes print.', { id: toastId });
    } finally {
      setIsTestingPrint(false);
    }
  };

  const handleCurrencyChange = (val: string | null) => {
    const value = val || '';
    if (value === 'custom') {
      setPrefs({ ...prefs, currency: customCurrency });
    } else {
      setPrefs({ ...prefs, currency: value });
    }
  };

  const isCustomCurrencySelected = !['IDR', 'USD', 'MYR'].includes(prefs.currency);

  return (
    <SettingsLayout
      title="Preferensi"
      rightAction={
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-full transition-all duration-300",
            isDirty ? "text-indigo-600 opacity-100 scale-110" : "text-gray-300 opacity-20 scale-100 pointer-events-none"
          )}
          onClick={handleSave}
          disabled={!isDirty}
        >
          <Check className="h-5 w-5 stroke-[2.5]" />
        </Button>
      }
    >
      <div className="flex flex-col">

        {/* PENGATURAN UMUM */}
        <div className="flex flex-col mt-4">
          <div className="px-6 py-4 bg-muted/30">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 dark:text-white">Pengaturan Umum</h2>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Bahasa Aplikasi</Label>
            <Select value={prefs.language} onValueChange={v => setPrefs({ ...prefs, language: (v || 'id') as 'id' | 'en' })}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih bahasa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="id">Indonesia</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Format Tanggal</Label>
            <Select value={prefs.dateFormat} onValueChange={v => setPrefs({ ...prefs, dateFormat: v || '' })}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dd/MM/yyyy">dd/MM/yyyy (31/12/2024)</SelectItem>
                <SelectItem value="MM/dd/yyyy">MM/dd/yyyy (12/31/2024)</SelectItem>
                <SelectItem value="yyyy-MM-dd">yyyy-MM-dd (2024-12-31)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Mode Kasir Default</Label>
            <Select value={prefs.defaultMode} onValueChange={v => setPrefs({ ...prefs, defaultMode: v || '' })}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimarket">Minimarket (Mode List)</SelectItem>
                <SelectItem value="resto">Resto (Mode Grid/Meja)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KEUANGAN & PAJAK */}
        <div className="flex flex-col mt-4">
          <div className="px-6 py-4 bg-muted/30">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 dark:text-white">Keuangan & Pajak</h2>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Mata Uang</Label>
            <Select value={isCustomCurrencySelected ? 'custom' : prefs.currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih mata uang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IDR">IDR (Rupiah)</SelectItem>
                <SelectItem value="USD">USD (Dolar AS)</SelectItem>
                <SelectItem value="MYR">MYR (Ringgit Malaysia)</SelectItem>
                <SelectItem value="custom">Custom...</SelectItem>
              </SelectContent>
            </Select>
            {isCustomCurrencySelected && (
              <Input
                className="h-8 mt-2 border-none bg-transparent p-0 font-bold text-sm focus-visible:ring-0 shadow-none rounded-none text-gray-800 placeholder:text-gray-400"
                value={customCurrency}
                onChange={e => {
                  setCustomCurrency(e.target.value.toUpperCase());
                  setPrefs({ ...prefs, currency: e.target.value.toUpperCase() });
                }}
                placeholder="Masukkan kode mata uang (mis. SGD)"
              />
            )}
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">PPN (%)</Label>
            <Input
              type="number"
              className="h-8 border-none bg-transparent p-0 font-bold text-sm focus-visible:ring-0 shadow-none rounded-none text-gray-800"
              value={prefs.ppnPercent}
              onChange={e => setPrefs({ ...prefs, ppnPercent: Number(e.target.value) })}
              placeholder="11"
            />
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Mode Pajak</Label>
            <Select value={prefs.taxMode} onValueChange={v => setPrefs({ ...prefs, taxMode: (v as 'inclusive' | 'exclusive') || 'exclusive' })}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih mode pajak" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusive">Inclusive (Sudah termasuk pajak)</SelectItem>
                <SelectItem value="exclusive">Exclusive (Pajak ditambah di akhir)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Service Charge (%)</Label>
            <Input
              type="number"
              className="h-8 border-none bg-transparent p-0 font-bold text-sm focus-visible:ring-0 shadow-none rounded-none text-gray-800"
              value={prefs.serviceChargePercent}
              onChange={e => setPrefs({ ...prefs, serviceChargePercent: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
        </div>

        {/* PRINTER & HARDWARE */}
        <div className="flex flex-col mt-4">
          <div className="px-6 py-4 bg-muted/30">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 dark:text-white">Printer & Hardware</h2>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Koneksi Printer</Label>
            <Select value={prefs.printerConnection} onValueChange={v => setPrefs({ ...prefs, printerConnection: (v as any) || 'none' })}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih koneksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak Ada</SelectItem>
                <SelectItem value="bluetooth">Bluetooth</SelectItem>
                <SelectItem value="usb">USB</SelectItem>
                <SelectItem value="network">Network / WiFi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Cetak Otomatis</Label>
              <span className="text-[10px] text-gray-400 font-medium">Cetak struk setelah bayar</span>
            </div>
            <Switch
              checked={prefs.autoPrint}
              onCheckedChange={c => setPrefs({ ...prefs, autoPrint: c })}
            />
          </div>
          <div className="px-6 py-5 border-b border-gray-200">
            <button
              className={cn(
                "text-[10px] font-black uppercase tracking-widest transition-colors",
                isTestingPrint ? "text-gray-400 cursor-not-allowed" : "text-indigo-600 hover:text-indigo-700"
              )}
              onClick={handleTestPrint}
              disabled={isTestingPrint}
            >
              {isTestingPrint ? 'Sedang Menghubungkan...' : 'Tes Print Koneksi'}
            </button>
          </div>
        </div>

        {/* KONFIGURASI STRUK */}
        <div className="flex flex-col mt-4">
          <div className="px-6 py-4 bg-muted/30">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 dark:text-white">Konfigurasi Struk</h2>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Ukuran Kertas</Label>
            <Select value={prefs.paperSize} onValueChange={v => setPrefs({ ...prefs, paperSize: v || '' })}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih ukuran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">Thermal 58mm (Standar)</SelectItem>
                <SelectItem value="80mm">Thermal 80mm (Besar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Tampilkan Logo Toko</Label>
            <Switch checked={prefs.showLogoOnReceipt} onCheckedChange={c => setPrefs({ ...prefs, showLogoOnReceipt: c })} />
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Tampilkan QR Code</Label>
            <Switch checked={prefs.showQrOnReceipt} onCheckedChange={c => setPrefs({ ...prefs, showQrOnReceipt: c })} />
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Tampilkan Nama Kasir</Label>
            <Switch checked={prefs.showCashierName} onCheckedChange={c => setPrefs({ ...prefs, showCashierName: c })} />
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Pesan Akhir Nota</Label>
            <Input
              className="h-8 border-none bg-transparent p-0 font-bold text-sm focus-visible:ring-0 shadow-none rounded-none text-gray-800"
              placeholder="Contoh: Terima kasih!"
              value={prefs.pesanNota}
              onChange={e => setPrefs({ ...prefs, pesanNota: e.target.value })}
            />
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Kebijakan Pengembalian</Label>
            <Textarea
              className="border-none bg-transparent p-0 font-bold text-sm resize-none focus-visible:ring-0 shadow-none min-h-[40px] rounded-none text-gray-800 mt-1"
              rows={1}
              placeholder="Contoh: Barang tidak dapat ditukar."
              value={prefs.kebijakanPengembalian}
              onChange={e => setPrefs({ ...prefs, kebijakanPengembalian: e.target.value })}
            />
          </div>
        </div>

        {/* SISTEM & KEAMANAN */}
        <div className="flex flex-col mt-4">
          <div className="px-6 py-4 bg-muted/30">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 dark:text-white">Sistem & Keamanan</h2>
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Batas Stok Menipis</Label>
            <Input
              type="number"
              className="h-8 border-none bg-transparent p-0 font-bold text-sm focus-visible:ring-0 shadow-none rounded-none text-gray-800"
              value={prefs.lowStockThreshold}
              onChange={e => setPrefs({ ...prefs, lowStockThreshold: Number(e.target.value) })}
              placeholder="10"
            />
          </div>
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col">
            <Label className="text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1">Frekuensi Backup</Label>
            <Select value={prefs.backupFrequency} onValueChange={v => setPrefs({ ...prefs, backupFrequency: (v as any) || 'manual' })}>
              <SelectTrigger className="h-8 w-full justify-between border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none rounded-none text-gray-800">
                <SelectValue placeholder="Pilih frekuensi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (Tanya Setiap Sinkron)</SelectItem>
                <SelectItem value="hourly">Setiap 1 Jam</SelectItem>
                <SelectItem value="daily">Harian</SelectItem>
                <SelectItem value="on_close">Setiap Tutup Toko</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
