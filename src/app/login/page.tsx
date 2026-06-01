'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, User, Lock, ArrowRight, Loader2, Store, Sparkles, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useStaffStore } from '@/store/useStaffStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/ui/AppLogo';

export default function LoginPage() {
  const [role, setRole] = useState<'admin' | 'staff'>('admin');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { session, setSession } = useStaffStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (role === 'admin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username,
          password: password,
        });
        if (error) throw error;
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', data.user.id)
          .maybeSingle();

        setSession({
          id: data.user.id,
          email: data.user.email,
          name: profile?.full_name || 'Admin',
          role: 'admin',
          owner_id: data.user.id
        });
        
        toast.success('Selamat datang, Bos!');
        router.push('/kasir');
      } else {
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, username, password, role, can_view_reports, user_id')
          .ilike('username', username.trim())
          .maybeSingle();

        if (error) throw new Error('Gangguan koneksi ke database.');
        if (!data) throw new Error('Username tidak ditemukan.');

        const { verifyPassword, hashPassword } = await import('@/utils/crypto');
        const { matches, isLegacy } = await verifyPassword(password, data.password);

        if (!matches) throw new Error('Password salah');

        if (isLegacy) {
          const hashed = await hashPassword(password);
          await supabase.from('employees').update({ password: hashed }).eq('id', data.id);
        }

        setSession({
          id: data.id,
          name: data.name,
          role: 'staff',
          username: data.username,
          can_view_reports: data.can_view_reports,
          owner_id: data.user_id,
        });

        toast.success(`Selamat bertugas, ${data.name}!`);
        router.push('/absensi');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login gagal');
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
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] -ml-48 -mb-48" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10 landscape:mb-6">
            <AppLogo variant="desktop-brand" />
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter leading-none">KasirHub</h1>
              <p className="text-indigo-400/60 text-[10px] font-black uppercase tracking-[0.4em] mt-1.5">Premium POS Solution</p>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-5xl landscape:text-4xl font-black text-white leading-[1.1] tracking-tight mb-8 landscape:mb-4">
              Kelola Bisnis Lebih <span className="text-indigo-500">Cerdas</span> & Cepat.
            </h2>
            <div className="space-y-6 landscape:space-y-4">
              {[
                { title: 'Offline-First Architecture', desc: 'Tetap bisa jualan meski internet terputus.' },
                { title: 'Real-time Sync', desc: 'Data otomatis tersinkron ke semua perangkat.' },
                { title: 'Attendance with Selfie', desc: 'Monitor kehadiran tim dengan verifikasi foto.' }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="size-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                    <CheckCircle2 className="size-3.5 text-indigo-400" />
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
            <Store className="size-4 text-white" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Trusted by 500+ Merchants</span>
          </div>
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest">v1.2.0</span>
        </div>
      </div>

      {/* RIGHT PANEL: LOGIN FORM */}
      <div className="flex-1 flex flex-col p-6 lg:p-8 landscape:p-6 xl:p-10 relative bg-white overflow-y-auto lg:overflow-hidden landscape:overflow-hidden">
        {/* Subtle Mobile Background Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-indigo-50/30 blur-3xl lg:hidden -z-10" />

        {/* Mobile Logo */}
        <div className="lg:hidden flex flex-col items-center gap-3 mb-10 pt-4">
          <AppLogo variant="mobile-brand" />
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">KasirHub</h1>
            <p className="text-indigo-600/40 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Premium POS</p>
          </div>
        </div>

        <div className="w-full max-w-[400px] mx-auto flex flex-col py-2">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Selamat Datang</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Silakan masuk ke akun Anda</p>
          </div>

          {/* Role Switcher */}
          <div className="flex p-1.5 bg-slate-50/80 rounded-lg mb-8 border border-slate-100 shadow-sm">
            <button 
              onClick={() => setRole('admin')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                role === 'admin' ? "bg-white text-indigo-600 shadow-md border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Shield className="size-4" />
              Owner
            </button>
            <button 
              onClick={() => setRole('staff')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                role === 'staff' ? "bg-white text-indigo-600 shadow-md border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <User className="size-4" />
              Karyawan
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-10">
            <div className="space-y-2">
              <Label 
                htmlFor="username"
                className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-0.5"
              >
                {role === 'admin' ? 'Email Address' : 'Username Karyawan'}
              </Label>
              <div className="relative group">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <User className="size-5" />
                </div>
                <Input 
                  required
                  id="username"
                  name="username"
                  type={role === 'admin' ? 'email' : 'text'}
                  placeholder={role === 'admin' ? 'nama@bisnis.com' : 'username'}
                  className="h-14 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-base font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-0">
                <Label htmlFor="password" className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Kata Sandi</Label>
                {role === 'admin' && (
                  <Link href="#" className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">Lupa?</Link>
                )}
              </div>
              <div className="relative group">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                  <Lock className="size-5" />
                </div>
                <Input 
                  required
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-14 pl-8 pr-10 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-base font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-200 group mt-4 overflow-hidden active:scale-[0.98] transition-all"
            >
              {loading ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <div className="flex items-center justify-center gap-3">
                  Masuk Sekarang
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col items-center gap-4">
            <p className="text-[11px] font-bold text-slate-500">
              Belum punya akun usaha?{' '}
              <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-black uppercase tracking-[0.2em] ml-2">
                Daftar Gratis
              </Link>
            </p>

            <button 
              onClick={async () => {
                if (confirm('Bersihkan seluruh data aplikasi? Tindakan ini akan menghapus semua cache dan memaksa login ulang.')) {
                  localStorage.clear();
                  sessionStorage.clear();
                  const { db } = await import('@/db/dexie');
                  await db.delete();
                  window.location.reload();
                }
              }}
              className="text-[9px] font-black text-rose-300 hover:text-rose-500 uppercase tracking-[0.2em] transition-colors mt-2"
            >
              Reset Data Aplikasi (Emergency)
            </button>

            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] mt-2">
              KasirHub by Jombang Dev &copy; 2024
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}

