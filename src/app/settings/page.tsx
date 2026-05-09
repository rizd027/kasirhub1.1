'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Store, Key, LayoutGrid, 
  Database, ArrowUpDown, HelpCircle, ChevronRight,
  Package, UserCircle2, Boxes, Fingerprint, LogOut, QrCode, Scale
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { PinDialog } from '@/components/ui/PinDialog';
import { AlertConfirm } from '@/components/ui/alert-confirm';
import { useStaffStore } from '@/store/useStaffStore';
import { supabase } from '@/services/supabase';
import { Badge } from '@/components/ui/badge';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { SyncIndicator } from '@/components/layout/SyncIndicator';

const settingMenus = [
  { title: 'Toko Saya', desc: 'Atur informasi toko', icon: Store, href: '/toko', protected: true },
  { title: 'Data Produk', desc: 'Tambah, ubah, atau hapus produk', icon: Package, href: '/produk', protected: true },
  { title: 'Bahan Baku', desc: 'Rincian modal dan bahan baku (BOM)', icon: Scale, href: '/ingredients', protected: true },
  { title: 'Stock', desc: 'Kelola stok gudang dan stok toko', icon: Boxes, href: '/stock', protected: true },
  { title: 'Karyawan', desc: 'Manajemen staf dan hak akses', icon: UserCircle2, href: '/karyawan', protected: true },
  { title: 'QR Menu Digital', desc: 'Buat QR untuk pemesanan mandiri pelanggan', icon: QrCode, href: '/qr-menu', protected: true },

  { title: 'PIN', desc: 'PIN Keamanan untuk membatasi ubah/hapus nota', icon: Key, href: '/settings/pin', protected: false },
  { title: 'Preferensi', desc: 'Mengubah format dan label', icon: LayoutGrid, href: '/settings/preferensi', protected: true },
  { title: 'Account', desc: 'Login/Register untuk sinkronisasi database', icon: UserCircle2, href: '/settings/account', protected: false },
  { title: 'Penyimpanan Data', desc: 'Backup otomatis ke Google Drive', icon: Database, href: '/settings/penyimpanan', protected: true },
  { title: 'Export Import Data', desc: 'Transfer data antar perangkat', icon: ArrowUpDown, href: '/settings/export-import', protected: true },
  { title: 'Bantuan', desc: 'Panduan penggunaan', icon: HelpCircle, href: '/settings/bantuan', protected: false },
];

export default function SettingsPage() {
  const router = useRouter();
  const { logout, session, isCheckedIn } = useStaffStore();
  const [pinTargetHref, setPinTargetHref] = useState<string | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // 1. Auth state listener fires immediately from local cache — no async wait needed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      setIsCloudConnected(!!supabaseSession);
    });

    // 2. Also get session once synchronously from cache
    supabase.auth.getSession().then(({ data: { session: supabaseSession } }) => {
      setIsCloudConnected(!!supabaseSession);
    }).catch(() => setIsCloudConnected(false));

    // 3. Network state changes
    const handleOnline = () => supabase.auth.getSession().then(({ data: { session } }) => setIsCloudConnected(!!session)).catch(() => {});
    const handleOffline = () => setIsCloudConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
      const desc = isCloudConnected
        ? 'Terhubung ke Database Cloud ✓'
        : 'Login/Register untuk sinkronisasi cloud';
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
          <SyncIndicator />
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

          {/* Version & Reset Info */}
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Versi Aplikasi</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">KasirHub v1.1.2</span>
            </div>
            
            <button 
              onClick={() => {
                if (confirm('Bersihkan semua data cache dan sinkronisasi? Anda akan diarahkan ke halaman login.')) {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.replace('/login');
                }
              }}
              className="text-[10px] font-black uppercase tracking-widest text-red-400/60 hover:text-red-500 transition-colors"
            >
              Reset Cache & Sinkronisasi
            </button>
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
          if (session?.role === 'staff' && isCheckedIn) {
            router.push('/absensi');
            return;
          }
          await supabase.auth.signOut();
          logout();
          localStorage.removeItem('supabase.auth.token');
          router.replace('/login');
        }}
      />
    </div>

  );
}
