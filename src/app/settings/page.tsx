'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Store, Key, LayoutGrid, 
  Database, ArrowUpDown, HelpCircle, ChevronRight,
  Package, UserCircle2, Boxes, Fingerprint, LogOut, QrCode
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { PinDialog } from '@/components/ui/PinDialog';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { useStaffStore } from '@/store/useStaffStore';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';

const settingMenus = [
  { title: 'Toko Saya', desc: 'Atur informasi toko', icon: Store, href: '/settings/toko', protected: true },
  { title: 'Data Produk', desc: 'Tambah, ubah, atau hapus produk', icon: Package, href: '/settings/produk', protected: true },
  { title: 'Stock', desc: 'Kelola stok gudang dan stok toko', icon: Boxes, href: '/settings/stock', protected: true },
  { title: 'Karyawan', desc: 'Manajemen staf dan hak akses', icon: UserCircle2, href: '/settings/karyawan', protected: true },
  { title: 'Absensi Karyawan', desc: 'Presensi masuk dan keluar staf', icon: Fingerprint, href: '/settings/absensi', protected: false },
  { title: 'QR Menu Digital', desc: 'Buat QR untuk pemesanan mandiri pelanggan', icon: QrCode, href: '/settings/qr-menu', protected: true },

  { title: 'PIN', desc: 'PIN Keamanan untuk membatasi ubah/hapus nota', icon: Key, href: '/settings/pin', protected: false },
  { title: 'Preferensi', desc: 'Mengubah format dan label', icon: LayoutGrid, href: '/settings/preferensi', protected: true },
  { title: 'Account', desc: 'Login/Register untuk sinkronisasi database', icon: UserCircle2, href: '/settings/account', protected: false },
  { title: 'Penyimpanan Data', desc: 'Backup otomatis ke Google Drive', icon: Database, href: '/settings/penyimpanan', protected: true },
  { title: 'Export Import Data', desc: 'Transfer data antar perangkat', icon: ArrowUpDown, href: '/settings/export-import', protected: true },
  { title: 'Bantuan', desc: 'Panduan penggunaan', icon: HelpCircle, href: '/settings/bantuan', protected: false },
];

export default function SettingsPage() {
  const router = useRouter();
  const { logout, session } = useStaffStore();
  const [pinTargetHref, setPinTargetHref] = useState<string | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: supabaseSession } }) => {
      setIsCloudConnected(!!supabaseSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      setIsCloudConnected(!!supabaseSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const filteredMenus = settingMenus.filter(menu => {
    if (session?.role === 'staff') {
      // Allowed for Kasir
      return ['Absensi Karyawan', 'Account', 'Bantuan'].includes(menu.title);
    }
    // Admin/Owner doesn't need attendance
    if (menu.title === 'Absensi Karyawan') {
      return false;
    }
    return true;
  }).map(menu => {
    if (menu.title === 'Account') {
      const title = session?.role === 'staff' ? 'Profil Saya' : 'Account';
      const desc = isCloudConnected === null ? 'Memeriksa koneksi...' : 
                   isCloudConnected ? 'Terhubung ke Database Cloud' : 
                   'Login/Register untuk sinkronisasi cloud';
      return { ...menu, title, desc };
    }
    if (menu.title === 'Penyimpanan Data') {
      const desc = isCloudConnected ? 'Sinkron otomatis ke Cloud aktif' : 'Backup lokal & Export/Import';
      return { ...menu, desc };
    }
    return menu;
  });

  useEffect(() => {
    for (const menu of settingMenus) {
      router.prefetch(menu.href);
    }
  }, [router]);

  const handleMenuClick = (e: React.MouseEvent, menu: typeof settingMenus[0]) => {
    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (menu.protected && savedPin) {
      e.preventDefault();
      setPinTargetHref(menu.href);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-x-hidden">
      <header className="flex items-center justify-between px-6 h-16 border-b bg-background/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex-1" />
        <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-800">Setting</h1>
        <div className="flex-1 flex justify-end">
          {isCloudConnected === null ? (
            <div className="size-8 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
              <Loader2 className="h-4 w-4 text-slate-300 animate-spin" />
            </div>
          ) : isCloudConnected ? (
            <div className="flex items-center gap-2 bg-emerald-500/5 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-500/10 shadow-sm shadow-emerald-500/5">
              <div className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500"></span>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest">Cloud On</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-100">
              <div className="size-1.5 rounded-full bg-slate-300" />
              <span className="text-[9px] font-black uppercase tracking-widest">Cloud Off</span>
            </div>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="flex flex-col min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2 p-4">
          {filteredMenus.map((menu) => {
            const Icon = menu.icon;
            return (
              <Link
                key={menu.href}
                href={menu.href}
                prefetch
                onMouseEnter={() => router.prefetch(menu.href)}
                onTouchStart={() => router.prefetch(menu.href)}
                onClick={(e) => handleMenuClick(e, menu)}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 active:bg-slate-100/80 transition-all rounded-2xl group border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-indigo-100/50">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-black text-slate-800 tracking-tight">{menu.title}</div>
                  <div className="text-[11px] font-bold text-slate-400 leading-snug mt-0.5">{menu.desc}</div>
                </div>
                <div className="size-8 flex items-center justify-center rounded-full bg-slate-50 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            );
          })}
          </div>
          
          {/* Logout Section */}
          <div className="px-6 py-4 mt-2">
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 transition-all active:scale-[0.98] border border-red-100"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-sm font-black uppercase tracking-widest">Keluar Aplikasi</span>
            </button>
          </div>

          {/* Version Info */}
          <div className="py-6 flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Versi Aplikasi</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">KasirHub v1.0.0</span>
          </div>
        </div>
      </div>

      <PinDialog 
        isOpen={!!pinTargetHref}
        onClose={() => setPinTargetHref(null)}
        onSuccess={() => {
          if (pinTargetHref) router.push(pinTargetHref);
          setPinTargetHref(null);
        }}
        title="Akses Pengaturan"
        description="Mengubah data strategis memerlukan verifikasi PIN Pemilik."
      />

      <AlertConfirm
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Keluar Aplikasi?"
        description="Anda akan keluar dari sesi aktif. Pastikan data telah tersinkronisasi jika ingin pindah perangkat."
        confirmText="Ya, Keluar"
        cancelText="Batal"
        variant="destructive"
        onConfirm={async () => {
          await supabase.auth.signOut();
          logout();
          localStorage.clear();
          sessionStorage.clear();
          router.replace('/login');
        }}
      />
    </div>

  );
}
