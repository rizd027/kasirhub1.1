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
import { Check, Globe, Coins, Printer, FileText, Shield, Calendar, Store, Percent, Receipt, BellRing, Database, MessageSquare, Bot, HelpCircle, Sparkles, Maximize2, MousePointer2 } from 'lucide-react';

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
  // Chatbot settings
  showChatbotFab: boolean;
  chatbotIcon: 'robot' | 'message' | 'help' | 'sparkles';
  chatbotPrompt: string;
  chatbotFabSize: 'sm' | 'md' | 'lg';
  chatbotFabOpacity: number;
  chatbotFabAutoHide: boolean;
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
  showChatbotFab: true,
  chatbotIcon: 'robot',
  chatbotPrompt: 'Halo! Saya asisten AI KasirHub. Ada yang bisa saya bantu terkait operasional toko Anda?',
  chatbotFabSize: 'md',
  chatbotFabOpacity: 100,
  chatbotFabAutoHide: false,
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

  // Auto-save effect
  useEffect(() => {
    const performSave = async () => {
      if (isDirty) {
        localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
        setInitialPrefs(prefs);

        // Dispatch custom event for real-time update in other components
        window.dispatchEvent(new Event('kasirhub_prefs_updated'));

        try {
          const { triggerSync } = await import('@/hooks/useSync');
          await triggerSync();
        } catch (err) {
          console.error('Auto-sync failed:', err);
        }
      }
    };

    const timeoutId = setTimeout(performSave, 1000); // Debounce save
    return () => clearTimeout(timeoutId);
  }, [prefs, isDirty]);

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

  const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle?: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className="size-10 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
        <Icon className="size-5" />
      </div>
      <div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title="Preferensi Aplikasi"
      backUrl="/pengaturan"
      rightAction={
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-500",
            isDirty ? "bg-amber-50 text-amber-600 scale-95 opacity-50" : "bg-emerald-50 text-emerald-600"
          )}>
            {!isDirty && <Check className="size-3.5 animate-in zoom-in duration-300" />}
          </div>
        </div>
      }
    >
      <div className="min-h-full bg-slate-50/50 pb-20">
        <div className="max-w-[1400px] mx-auto px-6 py-8">

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Column 1: General & Finance */}
            <div className="space-y-8">

              {/* PENGATURAN UMUM */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                <SectionHeader icon={Store} title="Umum" subtitle="Regional & Tampilan" />

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Bahasa Aplikasi</Label>
                    <Select value={prefs.language || 'id'} onValueChange={v => setPrefs({ ...prefs, language: (v || 'id') as 'id' | 'en' })}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4 focus:ring-2 focus:ring-indigo-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="id">Indonesia</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Format Tanggal</Label>
                    <Select value={prefs.dateFormat || 'dd/MM/yyyy'} onValueChange={v => setPrefs({ ...prefs, dateFormat: v || '' })}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/MM/yyyy">dd/MM/yyyy (31/12/2024)</SelectItem>
                        <SelectItem value="MM/dd/yyyy">MM/dd/yyyy (12/31/2024)</SelectItem>
                        <SelectItem value="yyyy-MM-dd">yyyy-MM-dd (2024-12-31)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mode Kasir Default</Label>
                    <Select value={prefs.defaultMode || 'minimarket'} onValueChange={v => setPrefs({ ...prefs, defaultMode: v || '' })}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimarket">Minimarket (List)</SelectItem>
                        <SelectItem value="resto">Resto (Grid/Table)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* KEUANGAN & PAJAK */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                <SectionHeader icon={Coins} title="Keuangan" subtitle="Mata Uang & Pajak" />

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mata Uang</Label>
                    <Select value={isCustomCurrencySelected ? 'custom' : prefs.currency} onValueChange={handleCurrencyChange}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IDR">IDR (Rupiah)</SelectItem>
                        <SelectItem value="USD">USD (Dolar AS)</SelectItem>
                        <SelectItem value="MYR">MYR (Ringgit Malaysia)</SelectItem>
                        <SelectItem value="custom">Lainnya (Custom)...</SelectItem>
                      </SelectContent>
                    </Select>
                    {isCustomCurrencySelected && (
                      <Input
                        className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 mt-2 px-4 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
                        value={customCurrency}
                        onChange={e => {
                          setCustomCurrency(e.target.value.toUpperCase());
                          setPrefs({ ...prefs, currency: e.target.value.toUpperCase() });
                        }}
                        placeholder="Mis: SGD"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">PPN (%)</Label>
                      <Input
                        type="number"
                        className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4"
                        value={prefs.ppnPercent}
                        onChange={e => setPrefs({ ...prefs, ppnPercent: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Service (%)</Label>
                      <Input
                        type="number"
                        className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4"
                        value={prefs.serviceChargePercent}
                        onChange={e => setPrefs({ ...prefs, serviceChargePercent: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Kalkulasi Pajak</Label>
                    <Select value={prefs.taxMode || 'exclusive'} onValueChange={v => setPrefs({ ...prefs, taxMode: (v as any) || 'exclusive' })}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inclusive">Termasuk Pajak (Nett)</SelectItem>
                        <SelectItem value="exclusive">Pajak Tambahan (Extra)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Hardware & Receipt */}
            <div className="space-y-8">

              {/* PRINTER & HARDWARE */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                <SectionHeader icon={Printer} title="Hardware" subtitle="Printer & Alat Bantu" />

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Koneksi Printer</Label>
                    <Select value={prefs.printerConnection || 'none'} onValueChange={v => setPrefs({ ...prefs, printerConnection: (v as any) || 'none' })}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa Printer</SelectItem>
                        <SelectItem value="bluetooth">Bluetooth (Paling Umum)</SelectItem>
                        <SelectItem value="usb">Kabel USB (Desktop)</SelectItem>
                        <SelectItem value="network">Network / Wi-Fi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Cetak Otomatis</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Struk Keluar Langsung</span>
                    </div>
                    <Switch
                      checked={prefs.autoPrint}
                      onCheckedChange={c => setPrefs({ ...prefs, autoPrint: c })}
                    />
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-lg border-indigo-100 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50"
                    onClick={handleTestPrint}
                    disabled={isTestingPrint}
                  >
                    {isTestingPrint ? 'Proses Koneksi...' : 'Tes Koneksi Printer'}
                  </Button>
                </div>
              </div>

              {/* KONFIGURASI STRUK */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                <SectionHeader icon={Receipt} title="Struk" subtitle="Layout Nota Belanja" />

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ukuran Kertas</Label>
                    <Select value={prefs.paperSize || '58mm'} onValueChange={v => setPrefs({ ...prefs, paperSize: v || '' })}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58mm">Thermal 58mm (Handheld)</SelectItem>
                        <SelectItem value="80mm">Thermal 80mm (Desktop)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { key: 'showLogoOnReceipt', label: 'Logo Toko' },
                      { key: 'showQrOnReceipt', label: 'QR Menu / Sosmed' },
                      { key: 'showCashierName', label: 'Nama Kasir' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between px-3 py-2 bg-slate-50/50 rounded-lg border border-slate-100/50">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{item.label}</span>
                        <Switch
                          checked={(prefs as any)[item.key]}
                          onCheckedChange={c => setPrefs({ ...prefs, [item.key]: c })}
                          className="scale-75 origin-right"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Messaging & Security */}
            <div className="space-y-8">

              {/* PESAN NOTA */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                <SectionHeader icon={FileText} title="Personalisasi" subtitle="Teks Footer Nota" />

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ucapan Terima Kasih</Label>
                    <Input
                      className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4"
                      placeholder="Contoh: Terima kasih!"
                      value={prefs.pesanNota}
                      onChange={e => setPrefs({ ...prefs, pesanNota: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Kebijakan Toko</Label>
                    <Textarea
                      className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm min-h-[100px] p-4 resize-none"
                      placeholder="Contoh: Barang tidak dapat ditukar."
                      value={prefs.kebijakanPengembalian}
                      onChange={e => setPrefs({ ...prefs, kebijakanPengembalian: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* CHATBOT & AI ASSISTANCE */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                <SectionHeader icon={Bot} title="Bantuan AI" subtitle="Chatbot & Asisten" />

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Tampilkan Tombol</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Floating Action Button</span>
                    </div>
                    <Switch
                      checked={prefs.showChatbotFab}
                      onCheckedChange={c => setPrefs({ ...prefs, showChatbotFab: c })}
                    />
                  </div>

                  {prefs.showChatbotFab && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Icon Tombol</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { id: 'robot', icon: Bot },
                            { id: 'message', icon: MessageSquare },
                            { id: 'help', icon: HelpCircle },
                            { id: 'sparkles', icon: Sparkles },
                          ].map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setPrefs({ ...prefs, chatbotIcon: item.id as any })}
                              className={cn(
                                "h-10 rounded-lg border flex items-center justify-center transition-all",
                                prefs.chatbotIcon === item.id
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                  : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                              )}
                            >
                              <item.icon className="size-5" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Pesan Pembuka / Identitas</Label>
                        <Textarea
                          className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm min-h-[80px] p-4 resize-none"
                          placeholder="Tulis instruksi atau pesan pembuka chatbot..."
                          value={prefs.chatbotPrompt}
                          onChange={e => setPrefs({ ...prefs, chatbotPrompt: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Ukuran Tombol</Label>
                          <Select value={prefs.chatbotFabSize || 'md'} onValueChange={v => setPrefs({ ...prefs, chatbotFabSize: v as any })}>
                            <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-xs h-9 px-3">
                              <SelectValue>
                                {{ sm: 'Kecil', md: 'Sedang', lg: 'Besar' }[prefs.chatbotFabSize || 'md']}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sm">Kecil</SelectItem>
                              <SelectItem value="md">Sedang</SelectItem>
                              <SelectItem value="lg">Besar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Transparansi ({prefs.chatbotFabOpacity ?? 100}%)</Label>
                          <div className="flex items-center gap-3 h-9 px-1">
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              className="flex-1 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
                              value={prefs.chatbotFabOpacity ?? 100}
                              onChange={e => setPrefs({ ...prefs, chatbotFabOpacity: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 mt-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Auto-Hide (Docking)</span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Menyatu saat tidak aktif</span>
                        </div>
                        <Switch
                          checked={prefs.chatbotFabAutoHide}
                          onCheckedChange={c => setPrefs({ ...prefs, chatbotFabAutoHide: c })}
                          className="scale-75 origin-right"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SISTEM & KEAMANAN */}
              <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-100">
                <SectionHeader icon={Shield} title="Sistem" subtitle="Peringatan & Keamanan" />

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Batas Stok Menipis</Label>
                      <BellRing className="size-3 text-amber-500" />
                    </div>
                    <Input
                      type="number"
                      className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4"
                      value={prefs.lowStockThreshold ?? 10}
                      onChange={e => setPrefs({ ...prefs, lowStockThreshold: Number(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pencadangan Data</Label>
                      <Database className="size-3 text-indigo-500" />
                    </div>
                    <Select value={prefs.backupFrequency || 'manual'} onValueChange={v => setPrefs({ ...prefs, backupFrequency: (v as any) || 'manual' })}>
                      <SelectTrigger className="bg-slate-50 border-slate-100 rounded-lg font-bold text-sm h-10 px-4">
                        <SelectValue>
                          {{
                            manual: 'Manual (Saat Sinkron)',
                            hourly: 'Otomatis Tiap Jam',
                            daily: 'Harian (Tiap Pagi)',
                            on_close: 'Saat Tutup Shift'
                          }[prefs.backupFrequency || 'manual']}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual (Saat Sinkron)</SelectItem>
                        <SelectItem value="hourly">Otomatis Tiap Jam</SelectItem>
                        <SelectItem value="daily">Harian (Tiap Pagi)</SelectItem>
                        <SelectItem value="on_close">Saat Tutup Shift</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
