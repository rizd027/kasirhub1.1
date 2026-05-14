'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabase';
import { SettingsLayout } from '@/features/settings/SettingsLayout';
import { useStaffStore } from '@/store/useStaffStore';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  ShieldCheck, Mail, Settings2, KeyRound, LogOut, 
  Cloud, Loader2, UserCircle, Camera, Users2, 
  ChevronRight, CheckCircle2, Lock, Trash2, AlertTriangle,
  User, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/services/cloudinary';

export default function SettingsAccountPage() {
  const router = useRouter();
  const { session, logout, setSession } = useStaffStore();
  const [profile, setProfile] = useState<{ full_name: string, photo_url: string | null } | null>(null);
  
  const [changing, setChanging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [employeeCount, setEmployeeCount] = useState(0);
  const [hasPin, setHasPin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStats = async (userId: string) => {
      const { data: empData } = await supabase
        .from('employees')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_active', true);
      setEmployeeCount(empData?.length || 0);
      setHasPin(!!localStorage.getItem('kasirhub_app_password'));
    };

    const fetchProfile = async (userId: string) => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, photo_url')
          .eq('id', userId)
          .single();
        
        if (data) {
          setProfile(data);
          setNewName(data.full_name);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };

    if (session?.id) {
      fetchProfile(session.id);
      fetchStats(session.id);
    }
  }, [session?.id]);

  const handleUpdateName = async () => {
    if (!profile || !newName.trim()) return;
    setChanging(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: newName.trim() })
        .eq('id', session?.id);
      if (error) throw error;
      
      setProfile({ ...profile, full_name: newName.trim() });
      if (session) setSession({ ...session, name: newName.trim() });
      setIsEditingName(false);
      toast.success('Nama diperbarui');
    } catch {
      toast.error('Gagal memperbarui nama');
    } finally {
      setChanging(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      await supabase.from('profiles').update({ photo_url: url }).eq('id', session.id);
      setProfile(prev => prev ? { ...prev, photo_url: url } : null);
      toast.success('Foto profil diperbarui');
    } catch (err: any) {
      toast.error('Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Password tidak cocok'); return; }
    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password diperbarui');
      setNewPassword(''); setConfirmPassword('');
      setShowChangePassword(false);
    } catch (err: any) {
      toast.error('Gagal memperbarui password');
    } finally {
      setChanging(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Peringatan: Akun akan dinonaktifkan permanen. Lanjutkan?")) return;
    setChanging(true);
    try {
      await supabase.from('profiles').update({ status: 'removed' }).eq('id', session?.id);
      await supabase.auth.signOut({ scope: 'global' });
      logout();
      router.replace('/login');
    } catch {
      toast.error('Gagal menghapus akun');
    } finally {
      setChanging(false);
    }
  };

  return (
    <SettingsLayout title="Profil Akun" backUrl="/pengaturan">
      <div className="flex-1 bg-slate-50/50 overflow-y-auto lg:overflow-hidden lg:h-[calc(100vh-64px)] pb-10 lg:pb-0">
        <div className="max-w-[1400px] mx-auto px-6 py-6 h-full flex flex-col">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1">
            
            {/* Left Column: Identity Section */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-white rounded-lg p-8 shadow-sm border border-slate-100 flex flex-col items-center text-center relative overflow-hidden flex-1 justify-center">
                <div className="absolute -top-32 -left-32 size-64 bg-indigo-50 rounded-full blur-3xl opacity-50" />
                
                <div className="relative z-10 mb-8">
                  <div className="size-36 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 font-black text-5xl border-4 border-white shadow-2xl overflow-hidden relative group">
                    {uploading ? (
                      <Loader2 className="size-10 animate-spin text-indigo-600" />
                    ) : profile?.photo_url ? (
                      <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      session?.name?.charAt(0) ?? <User className="size-16" />
                    )}
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Camera className="size-8 text-white" />
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUploadPhoto} />
                </div>

                <div className="relative z-10 flex flex-col items-center gap-2 w-full max-w-sm">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 w-full">
                      <Input 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)}
                        className="h-12 bg-slate-50 border-none font-black text-2xl text-center rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500/20 shadow-none"
                        autoFocus
                      />
                      <Button size="icon" className="h-12 w-12 shrink-0 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-100" onClick={handleUpdateName} disabled={changing}>
                        <CheckCircle2 className="size-6" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{profile?.full_name || session?.name || 'User'}</h2>
                      <button onClick={() => setIsEditingName(true)} className="size-10 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                        <Settings2 className="size-5" />
                      </button>
                    </div>
                  )}
                  <Badge className="bg-indigo-600 text-white hover:bg-indigo-600 border-none text-[11px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-lg shadow-indigo-100">
                    {session?.role === 'admin' ? 'Pemilik Toko' : 'Karyawan Kasir'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right Column: Settings & Safety */}
            <div className="lg:col-span-7 flex flex-col gap-4 lg:gap-6">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/karyawan" className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group flex items-center gap-4">
                  <div className="size-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Users2 className="size-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Manajemen Tim</p>
                    <p className="text-sm font-black text-slate-800">{employeeCount} Karyawan Aktif</p>
                  </div>
                  <ChevronRight className="size-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link href="/pengaturan/pin" className="bg-white p-5 rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group flex items-center gap-4">
                  <div className={cn(
                    "size-12 rounded-lg flex items-center justify-center border transition-colors",
                    hasPin ? "bg-emerald-50 border-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white" : "bg-amber-50 border-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white"
                  )}>
                    <Lock className="size-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Proteksi PIN</p>
                    <p className="text-sm font-black text-slate-800">{hasPin ? 'PIN Aktif' : 'PIN Off'}</p>
                  </div>
                  <ChevronRight className="size-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Security Card */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-100 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Keamanan & Akses</h3>
                  <Shield className="size-4 text-slate-300" />
                </div>
                <div className="p-6 flex-1 overflow-auto">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4 group">
                      <div className="size-12 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <KeyRound className="size-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Ganti Password</p>
                        <button 
                          onClick={() => setShowChangePassword(!showChangePassword)}
                          className="text-sm font-black text-slate-800 hover:text-indigo-600 transition-colors"
                        >
                          Ubah Kata Sandi Login
                        </button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowChangePassword(!showChangePassword)} className="rounded-lg h-8 px-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50">
                        {showChangePassword ? 'Batal' : 'Atur'}
                      </Button>
                    </div>

                    {showChangePassword && (
                      <form onSubmit={handleChangePassword} className="bg-slate-50/50 p-5 rounded-lg border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Baru</Label>
                            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-10 bg-white border-slate-200 font-bold rounded-lg" required />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Konfirmasi</Label>
                            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-10 bg-white border-slate-200 font-bold rounded-lg" required />
                          </div>
                        </div>
                        <Button type="submit" disabled={changing} className="w-full h-11 bg-indigo-600 text-white font-black rounded-lg uppercase tracking-widest text-[10px]">
                          Update Password Sekarang
                        </Button>
                      </form>
                    )}

                    <div className="flex items-center gap-4 opacity-50">
                      <div className="size-12 rounded-lg bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100">
                        <ShieldCheck className="size-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Email Terdaftar</p>
                        <p className="text-sm font-bold text-slate-800">{session?.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4 bg-rose-50/30 border-t border-rose-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="size-4 text-rose-500 shrink-0" />
                    <div>
                      <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-tight leading-none">Hapus Akun</h4>
                      <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest leading-none mt-1">Hapus akses permanen</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleDeleteAccount} className="h-9 border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-black px-4 rounded-lg uppercase tracking-widest text-[10px]">
                    Hapus
                  </Button>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
