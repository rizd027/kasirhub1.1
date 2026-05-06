'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, User, Lock, ArrowRight, Loader2, Store, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useStaffStore } from '@/store/useStaffStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [role, setRole] = useState<'admin' | 'staff'>('admin');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        
        // Fetch profile with role from database
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', data.user.id)
          .single();

        setSession({
          id: data.user.id,
          name: profile?.full_name || 'Admin',
          role: 'admin' // Supabase auth users are always owners
        });
        
        toast.success('Selamat datang, Bos!');
        router.push('/kasir');
      } else {
        // Staff Login — fetch by username only, then verify password securely
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('username', username)
          .eq('is_active', true)
          .single();

        if (error || !data) throw new Error('Username tidak ditemukan atau akun nonaktif');

        const { verifyPassword, hashPassword } = await import('@/utils/crypto');
        const { matches, isLegacy } = await verifyPassword(password, data.password);

        if (!matches) throw new Error('Password salah');

        // Auto-migrate: upgrade plain-text password to hashed version
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
        });

        toast.success(`Selamat bertugas, ${data.name}!`);
        router.push('/settings/absensi');
      }
    } catch (err: any) {
      toast.error(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-[360px]">
        {/* Logo Section */}
        <div className="flex items-center justify-center gap-3.5 mb-6">
          <div className="size-11 rounded-[14px] bg-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-200 rotate-3 animate-bounce-subtle shrink-0">
            K
          </div>
          <div className="flex flex-col items-start">
            <h1 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">KasirHub</h1>
            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.3em] mt-1">Smart POS Solution</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(79,70,229,0.08)] border border-slate-100 overflow-hidden relative">
          <div className="p-6">
            <h2 className="text-lg font-black text-slate-800 mb-5">Masuk ke Sistem</h2>
            
            {/* Role Switcher */}
            <div className="flex p-1 bg-slate-50 rounded-lg mb-6">
              <button 
                onClick={() => setRole('admin')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-black uppercase tracking-widest transition-all",
                  role === 'admin' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Shield className="size-4" />
                Admin
              </button>
              <button 
                onClick={() => setRole('staff')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-xs font-black uppercase tracking-widest transition-all",
                  role === 'staff' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <User className="size-4" />
                Kasir
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  {role === 'admin' ? 'Email Address' : 'Username Kasir'}
                </Label>
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                    <User className="size-4.5" />
                  </div>
                  <Input 
                    required
                    type={role === 'admin' ? 'email' : 'text'}
                    placeholder={role === 'admin' ? 'nama@toko.com' : 'username_anda'}
                    className="h-11 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-sm font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300 placeholder:font-medium"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">Kata Sandi</Label>
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                    <Lock className="size-4.5" />
                  </div>
                  <Input 
                    required
                    type="password"
                    placeholder="••••••••"
                    className="h-11 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-sm font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300 placeholder:font-medium"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button 
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 group overflow-hidden relative mt-2"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <>
                    Masuk Sekarang
                    <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-[11px] font-bold text-slate-500">
              Belum punya akun?{' '}
              <Link href="/register" className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
                Buka Usaha Baru
              </Link>
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Store className="size-3.5 text-indigo-400" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Digital POS by Jombang Dev</p>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-5 flex items-start gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100/50">
          <div className="p-1.5 bg-white rounded-lg shadow-sm text-indigo-600 shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-tight mb-0.5">Tips Keamanan</h4>
            <p className="text-[10px] text-indigo-700 font-medium leading-relaxed">
              Kasir wajib <b>Absensi Selfie</b> segera setelah login.
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0) rotate(3deg); }
          50% { transform: translateY(-5px) rotate(3deg); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
