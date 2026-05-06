'use client';

import { useEffect, useRef, useState } from 'react';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { uploadImage } from '@/services/cloudinary';
import { cn } from '@/lib/utils';
import { UploadCloud, Camera, Mail, MapPin, Check } from 'lucide-react';
import { Separator } from '@/components/ui/separator';



const defaultForm = {
  nama: '',
  alamat: '',
  telepon: '',
  logo_url: '',
  signature_url: '',
  npwp: '',
  bidang_usaha: '',
  instagram: '',
  tiktok: '',
  email_bisnis: '',
  google_maps_link: '',
  slug: '',
};

export default function TokoSayaPage() {
  const [form, setForm] = useState(defaultForm);
  const [initialForm, setInitialForm] = useState(defaultForm);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [isCanvasLocked, setIsCanvasLocked] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('toko_info');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const loadedForm = { ...defaultForm, ...parsed };
      setForm(loadedForm);
      setInitialForm(loadedForm);
    } catch {
      // ignore invalid old data
    }
  }, []);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const normalized = digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
    const chunks = normalized.match(/.{1,4}/g) ?? [];
    return chunks.slice(0, 4).join('-');
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    key: 'logo_url' | 'signature_url'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Show immediate local preview
    const localUrl = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, [key]: localUrl }));

    const isLogo = key === 'logo_url';
    isLogo ? setUploadingLogo(true) : setUploadingSignature(true);

    try {
      const url = await uploadImage(file);
      if (url) {
        // 2. Update with final Cloudinary URL
        setForm((prev) => ({ ...prev, [key]: url }));
        toast.success(isLogo ? 'Logo toko berhasil diunggah' : 'Signature berhasil diunggah');
      } else {
        throw new Error('Upload failed: No URL returned');
      }
    } catch (err) {
      console.error('Upload Error:', err);
      toast.error('Gagal mengunggah gambar. Pastikan koneksi internet stabil.');
      // Revert to empty if failed (optional, but safer)
      setForm((prev) => ({ ...prev, [key]: '' }));
    } finally {
      isLogo ? setUploadingLogo(false) : setUploadingSignature(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleSave = async () => {
    localStorage.setItem('toko_info', JSON.stringify(form));
    setInitialForm(form);
    toast.success('Informasi toko disimpan!');
    
    // Trigger sync to cloud
    try {
      const { triggerSync } = await import('@/hooks/useSync');
      await triggerSync();

      // Explicitly update slug and store_name in profiles table
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ 
          slug: form.slug.toLowerCase().trim(),
          store_name: form.nama 
        }).eq('id', user.id);
      }
    } catch (err) {
      console.error('Auto-sync failed:', err);
    }
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(event);
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const useDrawnSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setForm((prev) => ({ ...prev, signature_url: dataUrl }));
    setIsCanvasLocked(true);
    toast.success('Signature dari gambar tangan dipakai');
  };

  return (
    <SettingsLayout
      title="Toko Saya"
      rightAction={
        <Button
          onClick={handleSave}
          size="icon"
          variant="ghost"
          className={cn(
            "h-9 w-9 rounded-full transition-all duration-300",
            isDirty 
              ? "text-indigo-600 opacity-100 scale-110" 
              : "text-gray-300 opacity-20 scale-100 pointer-events-none"
          )}
          disabled={!isDirty}
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
        </Button>
      }
    >
      <div className="max-w-2xl mx-auto p-4 md:p-12 flex flex-col gap-16">
        {/* SECTION 1: IDENTITAS */}
        <section className="space-y-8">
          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Nama Bisnis</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                placeholder="Contoh: Warung Maju Jaya"
                value={form.nama}
                onChange={e => setForm({ ...form, nama: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">URL Menu Digital (Username)</Label>
              <div className="relative">
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground opacity-50">kasirhub.com/menu/</span>
                <Input
                  className="h-10 pl-[95px] pr-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium lowercase"
                  placeholder="nama-toko-anda"
                  value={form.slug}
                  onChange={e => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9-]/g, '-') })}
                />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1 italic">Gunakan huruf kecil, angka, dan tanda hubung saja.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Alamat Lengkap</Label>
              <Textarea
                className="min-h-[40px] px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium resize-none overflow-hidden"
                placeholder="Jl. Contoh No. 1, Kota"
                value={form.alamat}
                onChange={e => setForm({ ...form, alamat: e.target.value })}
                rows={1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Nomor Telepon</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                type="tel"
                placeholder="0812-3456-7890"
                value={form.telepon}
                onChange={e => setForm({ ...form, telepon: formatPhone(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Bidang Usaha</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                placeholder="Contoh: Minimarket, Cafe, dll"
                value={form.bidang_usaha}
                onChange={e => setForm({ ...form, bidang_usaha: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">NPWP (Opsional)</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                placeholder="00.000.000.0-000.000"
                value={form.npwp}
                onChange={e => setForm({ ...form, npwp: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Instagram</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                placeholder="@username_toko"
                value={form.instagram}
                onChange={e => setForm({ ...form, instagram: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">TikTok</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                placeholder="@username_toko"
                value={form.tiktok}
                onChange={e => setForm({ ...form, tiktok: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Email Bisnis</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                type="email"
                placeholder="bisnis@toko.com"
                value={form.email_bisnis}
                onChange={e => setForm({ ...form, email_bisnis: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">Google Maps</Label>
              <Input
                className="h-10 px-0 bg-transparent border-0 border-b border-muted-foreground/20 rounded-none focus-visible:ring-0 focus-visible:border-primary transition-all text-sm font-medium"
                placeholder="https://maps.app.goo.gl/..."
                value={form.google_maps_link}
                onChange={e => setForm({ ...form, google_maps_link: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4 pt-8">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-[0.15em]">Logo Toko</Label>
              {form.logo_url && (
                <button
                  onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                  className="text-[10px] text-destructive hover:text-destructive/80 transition-colors font-bold uppercase tracking-wider"
                >
                  Hapus
                </button>
              )}
            </div>
            <div className="relative group">
              <label className="flex flex-col items-center justify-center h-48 w-full cursor-pointer rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/5 transition-all hover:bg-muted/10 hover:border-primary/30 overflow-hidden shadow-sm">
                {form.logo_url ? (
                  <div className="relative h-full w-full flex items-center justify-center p-6">
                    <img src={form.logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain drop-shadow-md" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 backdrop-blur-[2px]">
                      <span className="text-white text-[10px] font-bold px-4 py-1.5 bg-black/50 rounded-full border border-white/20">GANTI LOGO</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground p-6">
                    <div className="p-3 rounded-full bg-muted/50 text-primary/40">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">{uploadingLogo ? 'MENGUNGGAH...' : 'PILIH LOGO'}</p>
                  </div>
                )}
                <Input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'logo_url')} />
              </label>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[10px] font-bold text-black dark:text-white uppercase tracking-[0.15em]">Tanda Tangan</Label>
              <div className="flex p-1 bg-muted/40 rounded-xl border border-muted-foreground/10">
                <button
                  type="button"
                  onClick={() => setSignatureMode('draw')}
                  className={cn(
                    "px-4 py-1 text-[9px] font-black rounded-lg transition-all tracking-widest",
                    signatureMode === 'draw' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  GAMBAR
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('upload')}
                  className={cn(
                    "px-4 py-1 text-[9px] font-black rounded-lg transition-all tracking-widest",
                    signatureMode === 'upload' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  UPLOAD
                </button>
              </div>
            </div>

            <div className="h-48 flex flex-col">
              {signatureMode === 'upload' ? (
                <label className="flex flex-col items-center justify-center flex-1 cursor-pointer rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/5 transition-all hover:bg-muted/10 hover:border-primary/30 overflow-hidden shadow-sm">
                  {form.signature_url && signatureMode === 'upload' ? (
                    <div className="relative h-full w-full flex items-center justify-center p-6">
                      <img src={form.signature_url} alt="Signature preview" className="max-h-full max-w-full object-contain grayscale brightness-90" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-all duration-300 backdrop-blur-[2px]">
                        <span className="text-white text-[10px] font-bold px-4 py-1.5 bg-black/50 rounded-full border border-white/20">GANTI FILE</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="p-3 rounded-full bg-muted/50 text-primary/40">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest">{uploadingSignature ? 'MENGUNGGAH...' : 'UPLOAD TTD'}</span>
                    </div>
                  )}
                  <Input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'signature_url')} />
                </label>
              ) : (
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex-1 relative rounded-2xl border border-muted-foreground/10 bg-white overflow-hidden shadow-inner ring-1 ring-black/5">
                    <canvas
                      ref={signatureCanvasRef}
                      width={600}
                      height={300}
                      className={cn(
                        "h-full w-full",
                        isCanvasLocked ? "cursor-default" : "cursor-crosshair touch-none"
                      )}
                      onPointerDown={isCanvasLocked ? undefined : startDrawing}
                      onPointerMove={isCanvasLocked ? undefined : draw}
                      onPointerUp={isCanvasLocked ? undefined : endDrawing}
                      onPointerLeave={isCanvasLocked ? undefined : endDrawing}
                    />

                    {isCanvasLocked && form.signature_url && (
                      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                        <img src={form.signature_url} alt="Saved signature" className="max-h-full max-w-full object-contain grayscale" />
                      </div>
                    )}

                    {isCanvasLocked && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] transition-all">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-4 bg-white/80 border-primary/20 text-[10px] font-black tracking-widest shadow-xl shadow-black/5 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all uppercase"
                          onClick={() => setIsCanvasLocked(false)}
                        >
                          Edit Tanda Tangan
                        </Button>
                        <p className="mt-2 text-[9px] font-bold text-muted-foreground/60 tracking-wider uppercase">Tekan edit untuk menggambar tanda tangan</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <button type="button" className="text-[10px] font-bold text-muted-foreground hover:text-destructive transition-colors uppercase tracking-wider" onClick={clearSignatureCanvas}>
                      Hapus
                    </button>
                    <button type="button" className="flex-1 text-[10px] font-bold text-primary hover:underline transition-all uppercase tracking-wider text-left" onClick={useDrawnSignature}>
                      Gunakan Tanda Tangan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
}
