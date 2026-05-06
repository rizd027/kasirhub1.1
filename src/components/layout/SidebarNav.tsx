'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  ReceiptText, 
  History, 
  BarChart3, 
  Settings, 
  Fingerprint, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  UserCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayoutStore } from '@/store/useLayoutStore';
import { useStaffStore } from '@/store/useStaffStore';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const navItems = [
  { label: 'Kasir', href: '/kasir', icon: ReceiptText },
  { label: 'Absen', href: '/settings/absensi', icon: Fingerprint },
  { label: 'Riwayat', href: '/riwayat', icon: History },
  { label: 'Laporan', href: '/laporan', icon: BarChart3 },
  { label: 'Setting', href: '/settings', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarCollapsed, toggleSidebar, isFullscreen } = useLayoutStore();
  const { session, isCheckedIn, logout } = useStaffStore();

  const filteredNavItems = navItems.filter(item => {
    if (session?.role === 'staff') {
      if (item.label === 'Laporan') return false;
      if (item.label === 'Absen') return !isCheckedIn;
      return true;
    }
    if (item.label === 'Absen') return false;
    return true;
  });

  const isStaffNotCheckedIn = session?.role === 'staff' && !isCheckedIn;

  if (isFullscreen || pathname === '/login' || pathname === '/register' || pathname.startsWith('/menu') || !session || isStaffNotCheckedIn) return null;

  return (
    <aside 
      className={cn(
        "hidden lg:flex flex-col bg-white border-r border-slate-100 transition-all duration-300 ease-in-out z-50 h-screen sticky top-0 shrink-0",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand / Logo Section */}
      <div className={cn(
        "h-20 flex items-center mb-4 transition-all duration-300",
        isSidebarCollapsed ? "justify-center" : "px-6"
      )}>
        <div className="flex items-center gap-3">
          <div className="size-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
            <span className="text-xl font-black text-white">K</span>
          </div>
          {!isSidebarCollapsed && (
            <span className="text-xl font-black text-slate-800 tracking-tighter animate-in fade-in slide-in-from-left-2 duration-300">
              KasirHub
            </span>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 space-y-2">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/kasir' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 h-12 rounded-2xl transition-all group relative overflow-hidden",
                isActive 
                  ? "bg-indigo-50 text-indigo-600 shadow-sm" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600",
                isSidebarCollapsed ? "justify-center" : "px-4"
              )}
            >
              <Icon className={cn("size-5 shrink-0", isActive ? "stroke-[2.5px]" : "stroke-2")} />
              {!isSidebarCollapsed && (
                <span className="text-sm font-bold tracking-tight">{item.label}</span>
              )}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section: Profile & Collapse */}
      <div className="p-4 border-t border-slate-50 space-y-2">
        {!isSidebarCollapsed && (
          <div className="bg-slate-50/50 rounded-2xl p-3 flex items-center gap-3 mb-4 border border-slate-100/50">
             <div className="size-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
               {session.name.charAt(0)}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-xs font-black text-slate-800 truncate leading-none mb-1">{session.name}</p>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{session.role}</p>
             </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            className={cn(
              "h-11 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all",
              isSidebarCollapsed ? "justify-center w-full" : "justify-start px-4 w-full"
            )}
          >
            {isSidebarCollapsed ? <ChevronRight className="size-5" /> : (
              <div className="flex items-center gap-4">
                <ChevronLeft className="size-5" />
                <span className="text-sm font-bold">Ciutkan Menu</span>
              </div>
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              logout();
              localStorage.clear();
              sessionStorage.clear();
              router.replace('/login');
            }}
            className={cn(
              "h-11 rounded-2xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-all",
              isSidebarCollapsed ? "justify-center w-full" : "justify-start px-4 w-full"
            )}
          >
            {isSidebarCollapsed ? <LogOut className="size-5" /> : (
              <div className="flex items-center gap-4">
                <LogOut className="size-5" />
                <span className="text-sm font-bold">Keluar</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
