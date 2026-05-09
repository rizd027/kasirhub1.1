'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Mail, ArrowRight, Loader2, Sparkles, CheckCircle2, Rocket, Zap, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Kata sandi tidak cocok!');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Kata sandi minimal 6 karakter');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'admin'
          }
        }
      });

      if (error) throw error;

      if (data?.user) {
        localStorage.setItem('kasirhub_pending_admin_id', data.user.id);
        await supabase
          .from('profiles')
          .upsert({ id: data.user.id, role: 'admin', full_name: fullName })
          .eq('id', data.user.id);
      }

      toast.success('Pendaftaran berhasil! Silakan cek kotak masuk email Anda.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mendaftar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col lg:flex-row landscape:flex-row font-sans overflow-hidden">
      
      {/* LEFT PANEL: BRANDING (Visible on Desktop & Landscape) */}
      <div className="hidden lg:flex landscape:flex lg:w-[55%] landscape:w-[45%] bg-[#0F172A] relative overflow-hidden flex-col p-12 landscape:p-10 justify-between">
        {/* Background Patterns */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] -mr-96 -mt-96" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[100px] -ml-48 -mb-48" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10 landscape:mb-6">
            <div className="size-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-2xl shadow-indigo-500/20">
              K
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter leading-none">KasirHub</h1>
              <p className="text-emerald-400/60 text-[10px] font-black uppercase tracking-[0.4em] mt-1.5">Empowering Small Business</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-5xl landscape:text-4xl font-black text-white leading-[1.1] tracking-tight mb-8 landscape:mb-4">
              Mulai Langkah <span className="text-emerald-500">Besar</span> Bisnis Anda.
            </h2>
            <div className="space-y-6 landscape:space-y-4">
              {[
                { title: 'Quick Setup', desc: 'Daftar dalam 1 menit dan langsung jualan.', icon: Rocket },
                { title: 'Zero Hardware Cost', desc: 'Gunakan smartphone atau tablet yang sudah ada.', icon: Zap },
                { title: 'Secure & Reliable', desc: 'Data Anda aman dengan enkripsi tingkat tinggi.', icon: ShieldCheck }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="size-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                    <item.icon className="size-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wide">{item.title}</h3>
                    <p className="text-slate-400 text-xs mt-1 leading-relaxed opacity-80">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 opacity-40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Enterprise-grade security included</span>
          </div>
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">Free Forever Plan</span>
        </div>
      </div>

      {/* RIGHT PANEL: REGISTER FORM */}
      <div className="flex-1 flex flex-col p-6 lg:p-6 landscape:p-6 xl:p-8 relative bg-white overflow-y-auto lg:overflow-hidden landscape:overflow-hidden">
        {/* Subtle Mobile Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-50/20 blur-3xl lg:hidden -z-10" />

        {/* Mobile Logo */}
        <div className="lg:hidden flex flex-col items-center gap-3 mb-6 pt-4">
          <div className="size-16 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-2xl shadow-indigo-200 active:scale-95 transition-transform">
            K
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">KasirHub</h1>
            <p className="text-emerald-500/50 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Empowering Small Business</p>
          </div>
        </div>

        <div className="w-full max-w-[400px] mx-auto flex flex-col py-1">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Buka Akun Usaha</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Mulai kelola toko Anda hari ini</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-0.5">Nama Lengkap Pemilik</Label>
              <div className="relative group">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <User className="size-5" />
                </div>
                <Input 
                  required
                  placeholder="Nama Lengkap"
                  className="h-14 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-base font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-0.5">Alamat Email Toko</Label>
              <div className="relative group">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Mail className="size-5" />
                </div>
                <Input 
                  required
                  type="email"
                  placeholder="email@bisnis.com"
                  className="h-14 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-base font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-0.5">Kata Sandi</Label>
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <Lock className="size-4" />
                  </div>
                  <Input 
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••"
                    className="h-14 pl-6 pr-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-base font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-0.5">Konfirmasi</Label>
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                    <Lock className="size-4" />
                  </div>
                  <Input 
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••"
                    className="h-14 pl-6 pr-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-base font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-200 group mt-4 overflow-hidden active:scale-[0.98] transition-all"
            >
              {loading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <div className="flex items-center justify-center gap-3">
                  Buat Akun Sekarang
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </Button>
          </form>

          {/* Quick Tips - More integrated */}
          <div className="mt-8 flex items-center gap-3 px-0 py-2 border-l-2 border-emerald-500/20 pl-4">
            <Sparkles className="size-3.5 text-emerald-500 shrink-0" />
            <p className="text-[9px] text-emerald-600/70 font-black uppercase tracking-widest leading-relaxed">
              Gunakan email <b className="text-emerald-500">Aktif</b> untuk verifikasi akun.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
            <p className="text-[11px] font-bold text-slate-500">
              Sudah memiliki akun?{' '}
              <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-black uppercase tracking-[0.2em] ml-2">
                MASUK
              </Link>
            </p>

            {/* Footer Text Integrated */}
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] mt-2">
              KasirHub by Jombang Dev &copy; 2024
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
