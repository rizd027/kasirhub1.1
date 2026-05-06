'use client';

import { useState, useEffect, useRef } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { supabase } from '@/lib/supabase';
import { QrCode, Copy, Download, ExternalLink, CheckCircle2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function QrMenuPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('Toko Saya');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const menuUrl = userId
    ? slug 
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/menu/${slug}`
      : `${typeof window !== 'undefined' ? window.location.origin : ''}/menu?uid=${userId}`
    : null;

  const qrCodeUrl = menuUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=20&data=${encodeURIComponent(menuUrl)}`
    : null;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, slug')
        .eq('id', uid)
        .single();

      if (profile?.full_name) setShopName(profile.full_name);
      if (profile?.slug) setSlug(profile.slug);

      setLoading(false);
    });
  }, []);

  const handleCopy = async () => {
    if (!menuUrl) return;
    try {
      // Primary: Clipboard API (requires HTTPS or localhost with permissions)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(menuUrl);
      } else {
        // Fallback: legacy execCommand approach
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
      // Last resort: show URL in prompt so user can manually copy
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
    <SettingsLayout title="QR Menu Digital">
      <div className="flex flex-col pb-20">

        {/* Hero Section */}
        <div className="bg-white border-b border-slate-100">
          <div className="flex flex-col items-center pt-10 pb-8 px-6 text-center">
            {loading ? (
              <div className="w-64 h-64 bg-slate-50 border border-slate-100 rounded-3xl animate-pulse flex items-center justify-center">
                <QrCode className="size-16 text-slate-200" />
              </div>
            ) : userId && qrCodeUrl ? (
              <div className="relative">
                <div className="w-64 h-64 rounded-3xl border-2 border-indigo-100 overflow-hidden shadow-xl shadow-indigo-100/50 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={qrCodeUrl}
                    alt="QR Code Menu"
                    className="w-full h-full object-contain rounded-2xl"
                  />
                </div>
                {/* Animated ring */}
                <div className="absolute -inset-2 rounded-[36px] border-2 border-indigo-200/50 animate-pulse pointer-events-none" />
              </div>
            ) : (
              <div className="w-64 h-64 bg-red-50 border border-red-100 rounded-3xl flex flex-col items-center justify-center gap-3">
                <QrCode className="size-16 text-red-300" />
                <p className="text-xs font-black text-red-400 uppercase tracking-widest">Login diperlukan</p>
              </div>
            )}

            <div className="mt-6 space-y-1">
              <h2 className="text-lg font-black text-slate-800">{shopName}</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Menu Digital Pelanggan</p>
            </div>

            {/* Instruction */}
            <div className="flex items-center gap-2 mt-4 px-4 py-2.5 bg-indigo-50 rounded-2xl border border-indigo-100">
              <Smartphone className="size-4 text-indigo-500 shrink-0" />
              <p className="text-[11px] font-bold text-indigo-700">
                Pelanggan scan QR → Pilih menu → Pesanan masuk ke Kasir
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white border-b border-slate-100 divide-y divide-slate-100 mt-4">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-800">Tindakan</h2>
          </div>

          {/* Copy URL */}
          <button
            onClick={handleCopy}
            disabled={!userId}
            className="w-full flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors active:bg-slate-100 disabled:opacity-40 text-left"
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-colors",
              copied ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-indigo-50 border-indigo-100 text-indigo-600"
            )}>
              {copied ? <CheckCircle2 className="size-5" /> : <Copy className="size-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Salin Link</p>
              <p className="text-sm font-black text-slate-800 truncate">
                {copied ? 'URL Tersalin!' : 'Salin URL Menu Digital'}
              </p>
              {menuUrl && (
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{menuUrl}</p>
              )}
            </div>
          </button>

          {/* Download QR */}
          <button
            onClick={handleDownloadQR}
            disabled={!userId}
            className="w-full flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors active:bg-slate-100 disabled:opacity-40 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Download className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Unduh QR Code</p>
              <p className="text-sm font-black text-slate-800">Simpan sebagai gambar PNG</p>
            </div>
          </button>

          {/* Preview */}
          <button
            onClick={handleOpenPreview}
            disabled={!userId}
            className="w-full flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors active:bg-slate-100 disabled:opacity-40 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <ExternalLink className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Pratinjau</p>
              <p className="text-sm font-black text-slate-800">Buka halaman menu pelanggan</p>
            </div>
          </button>
        </div>

        {/* Info / Setup Guide */}
        <div className="flex flex-col mt-4 bg-white border-y border-slate-100">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-800">Cara Penggunaan</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { step: '1', title: 'Cetak QR Code', desc: 'Unduh dan cetak QR Code ini, lalu tempel di meja atau kasir Anda.' },
              { step: '2', title: 'Pelanggan Scan', desc: 'Pelanggan scan QR dengan kamera HP untuk membuka katalog digital.' },
              { step: '3', title: 'Pilih & Pesan', desc: 'Pelanggan memilih menu dan mengirim pesanan dengan nomor meja.' },
              { step: '4', title: 'Terima di Kasir', desc: 'Klik ikon Inbox (📥) di halaman Kasir, lalu "Tarik ke Keranjang".' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-4 px-6 py-5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                  {step}
                </div>
                <div className="flex-1 mt-0.5">
                  <p className="text-sm font-black text-slate-800">{title}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </SettingsLayout>
  );
}
