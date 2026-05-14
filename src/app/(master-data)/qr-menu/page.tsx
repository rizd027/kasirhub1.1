'use client';

import { useState, useEffect, useRef } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { supabase } from '@/services/supabase';
import { QrCode, Copy, Download, ExternalLink, CheckCircle2, Smartphone, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function QrMenuPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('Toko Saya');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const getBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    if (origin.includes('localhost')) return origin;
    if (origin.startsWith('capacitor://')) return process.env.NEXT_PUBLIC_APP_URL || '';
    return origin;
  };

  const menuUrl = userId
    ? slug
      ? `${getBaseUrl()}/menu/${slug}`
      : `${getBaseUrl()}/menu?uid=${userId}`
    : null;

  const qrCodeUrl = menuUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=20&data=${encodeURIComponent(menuUrl)}`
    : null;

  useEffect(() => {
    const savedInfo = localStorage.getItem('toko_info');
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        if (parsed.slug) setSlug(parsed.slug);
        if (parsed.nama) setShopName(parsed.nama);
      } catch (e) {
        console.error('Error parsing local toko_info:', e);
      }
    }

    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, store_name, slug')
        .eq('id', uid)
        .single();

      if (profile) {
        if (profile.store_name || profile.full_name) {
          setShopName(profile.store_name || profile.full_name || 'Toko Saya');
        }
        if (profile.slug) setSlug(profile.slug);
      }

      setLoading(false);
    });
  }, []);

  const handleCopy = async () => {
    if (!menuUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(menuUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = menuUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast.success('URL berhasil disalin!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Salin URL berikut:', menuUrl);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl || !menuUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeUrl;
    a.download = `qr-menu-${shopName.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.target = '_blank';
    a.click();
    toast.success('QR Code diunduh!');
  };

  const handleOpenPreview = () => {
    if (!menuUrl) return;
    window.open(menuUrl, '_blank');
  };

  return (
    <SettingsLayout title="QR Menu Digital" backUrl="/pengaturan">
      <div className="flex-1 bg-slate-50/50 overflow-y-auto lg:overflow-hidden lg:h-[calc(100vh-64px)] pb-10 lg:pb-0">
        <div className="max-w-[1400px] mx-auto px-6 py-4 lg:py-6 h-full flex flex-col justify-center">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-stretch">
            
            {/* Left Column: QR Display Card */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-white rounded-lg p-6 lg:p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden flex-1 justify-center">
                <div className="absolute -top-24 -right-24 size-48 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                
                <div className="relative z-10">
                  {loading ? (
                    <div className="w-48 h-48 lg:w-56 lg:h-56 bg-slate-50 rounded-lg animate-pulse flex items-center justify-center border border-slate-100">
                      <QrCode className="size-12 text-slate-200" />
                    </div>
                  ) : userId && qrCodeUrl ? (
                    <div className="relative p-2 bg-white rounded-lg border-2 border-slate-50 shadow-sm">
                      <div className="w-44 h-44 lg:w-52 lg:h-52 relative">
                        <img
                          ref={imgRef}
                          src={qrCodeUrl}
                          alt="QR Code Menu"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-200">
                        Scan Me
                      </div>
                    </div>
                  ) : (
                    <div className="w-48 h-48 lg:w-56 lg:h-56 bg-rose-50 rounded-lg flex flex-col items-center justify-center gap-2 border border-rose-100">
                      <QrCode className="size-12 text-rose-300" />
                      <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Login Required</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-1 relative z-10">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{shopName}</h2>
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-px w-3 bg-indigo-200" />
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em]">Menu Digital</p>
                    <span className="h-px w-3 bg-indigo-200" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2 w-full relative z-10 max-w-xs">
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Terverifikasi</span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 flex flex-col items-center gap-1 border border-slate-100">
                    <Zap className="size-4 text-amber-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Realtime</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleOpenPreview}
                className="bg-indigo-600 rounded-lg p-4 text-white shadow-md hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-[0.98]"
              >
                <div className="size-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <ExternalLink className="size-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-black text-xs uppercase tracking-wider">Pratinjau</h3>
                  <p className="text-[10px] text-indigo-100 font-medium">Lihat menu pelanggan</p>
                </div>
              </button>
            </div>

            {/* Right Column: Actions & Guide */}
            <div className="lg:col-span-7 flex flex-col gap-4 lg:gap-6">
              
              {/* Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleCopy}
                  disabled={!userId}
                  className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all text-left group active:scale-95 flex items-center gap-4"
                >
                  <div className={cn(
                    "size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    copied ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                  )}>
                    {copied ? <CheckCircle2 className="size-5" /> : <Copy className="size-5" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Link Menu</h4>
                    <p className="font-black text-slate-800 uppercase tracking-tight text-xs">{copied ? 'URL Tersalin' : 'Salin URL'}</p>
                  </div>
                </button>

                <button
                  onClick={handleDownloadQR}
                  disabled={!userId}
                  className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all text-left group active:scale-95 flex items-center gap-4"
                >
                  <div className="size-10 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Download className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">File Gambar</h4>
                    <p className="font-black text-slate-800 uppercase tracking-tight text-xs">Unduh QR Code</p>
                  </div>
                </button>
              </div>

              {/* Guide Card */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0">
                <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-800">Panduan Aktivasi</h3>
                  <div className="px-2 py-0.5 bg-white rounded-full border border-slate-200 text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                    Ready to use
                  </div>
                </div>
                <div className="p-6 flex-1 overflow-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {[
                      { step: '01', title: 'Cetak QR', desc: 'Download dan cetak QR Code untuk di meja.' },
                      { step: '02', title: 'Scan HP', desc: 'Pelanggan scan QR dengan HP untuk akses katalog.' },
                      { step: '03', title: 'Pilih Menu', desc: 'Pelanggan memilih menu dan checkout tanpa aplikasi.' },
                      { step: '04', title: 'Terima Order', desc: 'Pesanan masuk otomatis ke Inbox Kasir.' },
                    ].map((item) => (
                      <div key={item.step} className="flex gap-3 group">
                        <span className="text-lg font-black text-indigo-100 group-hover:text-indigo-600 transition-colors leading-none">{item.step}</span>
                        <div>
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight mb-0.5">{item.title}</p>
                          <p className="text-[9px] text-slate-500 font-medium leading-normal">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="px-6 py-3 bg-indigo-50/50 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <Smartphone className="size-3.5 text-indigo-600 shrink-0" />
                    <p className="text-[9px] font-bold text-indigo-700 leading-tight">
                      Meningkatkan efisiensi pemesanan hingga 40% & mengoptimalkan alur kerja staf.
                    </p>
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
