'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, User, Lock, Mail, ArrowRight, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        // Mark this user as pending admin role update.
        // The actual profile update happens either now (if email confirmation is off)
        // or when the user clicks the verification link (SIGNED_IN fires in AuthCheck).
        localStorage.setItem('kasirhub_pending_admin_id', data.user.id);

        // Try immediate update (works if email confirmation is disabled)
        await supabase
          .from('profiles')
          .upsert({ id: data.user.id, role: 'admin', full_name: fullName })
          .eq('id', data.user.id);
      }

      toast.success('Pendaftaran berhasil! Silakan cek kotak masuk email Anda untuk memverifikasi akun.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mendaftar');
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

        {/* Register Card */}
        <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(79,70,229,0.08)] border border-slate-100 overflow-hidden relative">
          <div className="p-6">
            <h2 className="text-lg font-black text-slate-800 mb-1">Buka Usaha Baru</h2>
            <p className="text-xs text-slate-500 mb-5 font-medium">Buat akun admin untuk kelola toko Anda.</p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Nama Lengkap
                </Label>
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                    <User className="size-4.5" />
                  </div>
                  <Input 
                    required
                    type="text"
                    placeholder="Nama Anda"
                    className="h-11 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-sm font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300 placeholder:font-medium"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">
                  Alamat Email
                </Label>
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                    <Mail className="size-4.5" />
                  </div>
                  <Input 
                    required
                    type="email"
                    placeholder="nama@toko.com"
                    className="h-11 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-sm font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300 placeholder:font-medium"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">Sandi</Label>
                  <div className="relative group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                      <Lock className="size-4.5" />
                    </div>
                    <Input 
                      required
                      type="password"
                      placeholder="••••••"
                      className="h-11 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-sm font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300 placeholder:font-medium"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-black uppercase text-slate-400 tracking-widest ml-1">Ulangi</Label>
                  <div className="relative group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                      <Lock className="size-4.5" />
                    </div>
                    <Input 
                      required
                      type="password"
                      placeholder="••••••"
                      className="h-11 pl-8 bg-transparent border-0 border-b-2 border-slate-100 rounded-none text-sm font-bold focus-visible:ring-0 focus-visible:border-indigo-600 transition-all placeholder:text-slate-300 placeholder:font-medium"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
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
                    Daftar Sekarang
                    <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-[11px] font-bold text-slate-500">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2">
                Masuk di sini
              </Link>
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
