'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ReceiptText, History, BarChart3, Settings, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Kasir', href: '/kasir', icon: ReceiptText },
  { label: 'Absen', href: '/absensi', icon: Fingerprint },
  { label: 'Riwayat', href: '/riwayat', icon: History },
  { label: 'Laporan', href: '/laporan', icon: BarChart3 },
  { label: 'Pengaturan', href: '/pengaturan', icon: Settings },
];

import { useLayoutStore } from '@/store/useLayoutStore';
import { useStaffStore } from '@/store/useStaffStore';

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isFullscreen } = useLayoutStore();
  const { session, isCheckedIn } = useStaffStore();

  const filteredNavItems = navItems.filter(item => {
    // Role based filtering
    if (session?.role === 'staff') {
      if (item.label === 'Laporan') return false;
      if (item.label === 'Absen') return !isCheckedIn;
      return true;
    }

    // Owner / Admin filtering
    if (item.label === 'Absen') return false; // Owner uses specific menu
    return true;
  });

  useEffect(() => {
    for (const item of filteredNavItems) {
      if (item.href !== pathname) {
        router.prefetch(item.href);
      }
    }
  }, [pathname, router, filteredNavItems]);

  const isStaffNotCheckedIn = session?.role === 'staff' && !isCheckedIn;

  if (isFullscreen || pathname === '/login' || pathname === '/register' || pathname.startsWith('/menu') || !session || isStaffNotCheckedIn) return null;

  return (
    <nav data-bottom-nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background pb-safe-area-inset-bottom">
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/kasir' && pathname.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onMouseEnter={() => router.prefetch(item.href)}
            onTouchStart={() => router.prefetch(item.href)}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative px-4",
              isActive ? "text-indigo-600 scale-105" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Icon className={cn("size-5 transition-all", isActive ? "stroke-[2.5px]" : "stroke-2")} />
            <span className={cn(
              "text-[9px] tracking-tight transition-all",
              isActive ? "font-black" : "font-bold"
            )}>{item.label}</span>
            {isActive && (
              <div className="absolute -bottom-1 size-1 bg-indigo-600 rounded-full animate-in fade-in zoom-in duration-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
