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
      data-sidebar-nav
      className={cn(
        "hidden lg:flex flex-col bg-slate-50/50 border-r border-slate-200/60 transition-all duration-300 ease-in-out z-50 h-screen sticky top-0 shrink-0",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand / Logo Section */}
      <div className={cn(
        "h-24 flex items-center transition-all duration-300",
        isSidebarCollapsed ? "justify-center" : "px-8"
      )}>
        <div className="flex items-center gap-3">
          <div className="size-11 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-indigo-100 shrink-0">
            <span className="text-2xl font-black text-white">K</span>
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-black text-slate-800 tracking-tighter leading-none">
                KasirHub
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/60 mt-0.5">
                POS System
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 space-y-1.5">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/kasir' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 h-12 rounded-2xl transition-all duration-300 group relative",
                isActive 
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-white/50",
                isSidebarCollapsed ? "justify-center" : "px-4"
              )}
            >
              <Icon className={cn("size-5 shrink-0 transition-all duration-300", isActive ? "stroke-[2.5px] scale-110 drop-shadow-[0_0_8px_rgba(79,70,229,0.3)]" : "stroke-2 group-hover:scale-110")} />
              {!isSidebarCollapsed && (
                <span className={cn(
                  "text-[13px] tracking-tight transition-all",
                  isActive ? "font-black" : "font-bold"
                )}>{item.label}</span>
              )}
              {isActive && !isSidebarCollapsed && (
                <div className="absolute right-3 size-1.5 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.6)] animate-in fade-in zoom-in duration-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section: Profile & Collapse */}
      <div className="p-4 border-t border-slate-200/40 bg-white/20 space-y-2">
        {!isSidebarCollapsed && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-3 mb-2 border border-slate-200/50 shadow-sm">
             <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm shrink-0">
               {session.name.charAt(0)}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-xs font-black text-slate-800 truncate leading-none mb-1.5">{session.name}</p>
               <div className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                 {session.role}
               </div>
             </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Button
            variant="ghost"
            onClick={toggleSidebar}
            className={cn(
              "h-11 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white transition-all border border-transparent hover:border-slate-200/50",
              isSidebarCollapsed ? "justify-center w-full" : "justify-start px-4 w-full"
            )}
          >
            {isSidebarCollapsed ? <ChevronRight className="size-5" /> : (
              <div className="flex items-center gap-4">
                <ChevronLeft className="size-5" />
                <span className="text-[13px] font-bold">Ciutkan</span>
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
              "h-11 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50/50 transition-all border border-transparent hover:border-red-100/50",
              isSidebarCollapsed ? "justify-center w-full" : "justify-start px-4 w-full"
            )}
          >
            {isSidebarCollapsed ? <LogOut className="size-5" /> : (
              <div className="flex items-center gap-4">
                <LogOut className="size-5" />
                <span className="text-[13px] font-bold">Keluar</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
