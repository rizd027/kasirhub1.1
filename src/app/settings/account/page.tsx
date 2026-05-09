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
  ChevronRight, CheckCircle2, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/services/cloudinary';

export default function SettingsAccountPage() {
  const router = useRouter();
  const { session, logout, setSession } = useStaffStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string, photo_url: string | null } | null>(null);
  
  const [syncing, setSyncing] = useState(false);
  const [changing, setChanging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [employeeCount, setEmployeeCount] = useState(0);
  const [hasPin, setHasPin] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 1. Define functions first
    const fetchStats = async (userId: string) => {
      const { db } = await import('@/db/dexie');
      const count = await db.transactions.where('sync_status').equals('pending').count();
      setUnsyncedCount(count);
      setLastSync(localStorage.getItem('kasirhub_last_sync'));
      setHasPin(!!localStorage.getItem('kasirhub_app_password'));

      // Fetch employee count
      const { data: empData } = await supabase
        .from('employees')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_active', true);
      setEmployeeCount(empData?.length || 0);
    };

    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, photo_url')
          .eq('id', userId)
          .single();
        
        if (error) {
          const { data: fallbackData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();
          if (fallbackData) {
            setProfile({ full_name: fallbackData.full_name, photo_url: null });
            setNewName(fallbackData.full_name);
          }
          return;
        }

        if (data) {
          setProfile(data);
          setNewName(data.full_name);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };

    // 2. Call them
    if (session?.id) {
      fetchProfile(session.id);
      fetchStats(session.id);
    }

    return () => {};
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
      toast.success('Nama berhasil diperbarui');
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
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: url })
        .eq('id', session.id);
      
      if (error) throw error;
      setProfile(prev => prev ? { ...prev, photo_url: url } : null);
      toast.success('Foto profil diperbarui');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  };

  // ===== STAFF VIEW (Simplified for this task) =====
  if (session?.role === 'staff') {
    return (
      <SettingsLayout title="Profil Saya">
        <div className="flex flex-col bg-white border-b border-slate-100 pb-8">
          <div className="flex flex-col items-center pt-10 pb-6 px-6">
            <div className="w-20 h-20 rounded-[32px] bg-slate-50 flex items-center justify-center text-indigo-600 font-black text-3xl mb-4 border border-slate-100 shadow-sm">
              {session.name.charAt(0)}
            </div>
            <h2 className="text-xl font-black text-slate-800">{session.name}</h2>
            <Badge className="mt-2 bg-slate-100 hover:bg-slate-200 text-slate-600 border-none text-[10px] font-black uppercase tracking-widest px-3 py-1">KARYAWAN KASIR</Badge>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">ID: {session.id.slice(-6)}</span>
          </div>
          <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 py-4 border-t border-slate-100 mx-6">
            Hubungi Pak Bos untuk bantuan lainnya
          </p>
        </div>
      </SettingsLayout>
    );
  }

  // ===== ADMIN VIEW =====
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { triggerSync } = await import('@/hooks/useSync');
      await triggerSync(true);
      
      // Refresh stats after sync
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setLastSync(new Date().toISOString());
        localStorage.setItem('kasirhub_last_sync', new Date().toISOString());
        
        const { db } = await import('@/db/dexie');
        const count = await db.transactions.where('sync_status').equals('pending').count();
        setUnsyncedCount(count);
      }
      
      toast.success('Sinkronisasi berhasil!');
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      toast.error(err.message || 'Sinkronisasi gagal.');
    } finally {
      setSyncing(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Password tidak cocok'); return; }
    if (newPassword.length < 6) { toast.error('Minimal 6 karakter'); return; }
    setChanging(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password berhasil diperbarui');
      setNewPassword(''); setConfirmPassword('');
      setShowChangePassword(false);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui password');
    } finally {
      setChanging(false);
    }
  };

  return (
    <SettingsLayout title="Profil Admin">
      <div className="flex flex-col pb-12">
        
        {/* Identity Section (Pak Bos) */}
        <div className="bg-white border-b border-slate-100">
          <div className="flex flex-col items-center pt-10 pb-8 px-6 text-center">
            {/* Photo Avatar */}
            <div className="relative group mb-4">
              <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-300 font-black text-3xl border border-slate-100 shadow-sm overflow-hidden">
                {uploading ? (
                  <Loader2 className="size-8 animate-spin text-slate-300" />
                ) : profile?.photo_url ? (
                  <img src={profile.photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  session?.name?.charAt(0) ?? <UserCircle className="size-10" />
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute -right-2 -bottom-2 size-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center hover:bg-indigo-100 active:scale-95 transition-all border border-indigo-100"
              >
                <Camera className="size-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleUploadPhoto} 
              />
            </div>

            {/* Name & Role */}
            <div className="flex flex-col items-center gap-1">
              {isEditingName ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    className="h-10 border-0 bg-slate-50 font-bold text-lg text-center rounded-xl focus-visible:ring-0 shadow-none text-slate-800"
                    autoFocus
                  />
                  <Button size="icon" className="h-10 w-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700" onClick={handleUpdateName} disabled={changing}>
                    <CheckCircle2 className="size-5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  <h2 className="text-2xl font-black tracking-tight text-slate-800">{profile?.full_name || session?.name || 'Admin'}</h2>
                  <button onClick={() => setIsEditingName(true)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                    <Settings2 className="size-4 text-slate-400" />
                  </button>
                </div>
              )}
              <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 mt-1">
                Pemilik Toko
              </Badge>
            </div>
          </div>
        </div>

        {/* Shortcuts Section */}
        <div className="bg-white border-b border-slate-100 divide-y divide-slate-100">
          <Link 
            href="/karyawan"
            className="flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors active:bg-slate-100"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Users2 className="size-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Karyawan</p>
              <p className="text-sm font-black text-slate-800">{employeeCount} Aktif</p>
            </div>
            <ChevronRight className="size-5 text-slate-300" />
          </Link>

          <Link 
            href="/settings/pin"
            className="flex items-center gap-4 px-6 py-5 hover:bg-slate-50 transition-colors active:bg-slate-100"
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center border",
              hasPin ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-amber-50 border-amber-100 text-amber-600"
            )}>
              <Lock className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Keamanan PIN</p>
              <p className="text-sm font-black text-slate-800">{hasPin ? 'Aktif' : 'Off'}</p>
            </div>
            <ChevronRight className="size-5 text-slate-300" />
          </Link>
        </div>



        {/* Keamanan */}
        <div className="flex flex-col mt-4 bg-white border-y border-slate-100">
          <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-800">Keamanan Akun</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <button
              className="w-full px-6 py-5 flex items-center gap-4 hover:bg-slate-50 transition-colors active:bg-slate-100"
              onClick={() => setShowChangePassword(!showChangePassword)}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                <KeyRound className="h-5 w-5 text-slate-500" />
              </div>
              <div className="text-left flex-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Password</p>
                <p className="text-sm font-black text-slate-800">Ubah Password Login</p>
              </div>
              <ChevronRight className={cn("size-5 text-slate-300 transition-transform", showChangePassword && "rotate-90")} />
            </button>
            
            {showChangePassword && (
              <div className="px-6 py-5 bg-slate-50/30">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Password Baru</Label>
                    <Input type="password" placeholder="Min. 6 karakter" className="h-10 bg-transparent border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold text-slate-800 shadow-none" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Konfirmasi Password</Label>
                    <Input type="password" placeholder="Ulangi password" className="h-10 bg-transparent border-0 border-b border-slate-200 rounded-none px-0 focus-visible:ring-0 focus-visible:border-indigo-600 text-sm font-bold text-slate-800 shadow-none" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" disabled={changing} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl uppercase tracking-widest text-[11px] mt-2">
                    {changing ? 'Menyimpan...' : 'Perbarui Password'}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Version Info */}
        <div className="py-12 flex flex-col items-center gap-1.5 opacity-60">
          <div className="flex items-center gap-2 mb-2">
            <div className="size-6 bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-black text-[10px]">K</div>
            <span className="font-black text-sm tracking-tighter text-slate-800">KasirHub</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Versi 1.0.0</span>
        </div>
      </div>
    </SettingsLayout>
  );
}
