'use client';

import { useLayoutStore } from '@/store/useLayoutStore';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useOrientationClass } from '@/hooks/useOrientationClass';

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const { isFullscreen } = useLayoutStore();
  const pathname = usePathname();
  
  // Enable landscape = desktop mode for Capacitor APK
  useOrientationClass();
  
  // Operational pages that should take full width
  const isOperationalPage = pathname?.startsWith('/kasir') || pathname?.startsWith('/login') || pathname?.startsWith('/register') || pathname?.startsWith('/settings') || pathname?.startsWith('/laporan') || pathname?.startsWith('/riwayat');
  
  // Inactivity Auto Logout Logic
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let autoLogoutMinutes = 0;

    const updateConfig = () => {
      try {
        const saved = localStorage.getItem('kasirhub_prefs');
        if (saved) {
          const prefs = JSON.parse(saved);
          autoLogoutMinutes = Number(prefs.autoLogoutMinutes || 0);
        }
      } catch (e) {
        autoLogoutMinutes = 0;
      }
    };

    const handleLogout = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // Already logged out

      await supabase.auth.signOut();
      toast.info("Sesi berakhir karena tidak ada aktivitas.");
      window.location.href = '/login';
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (autoLogoutMinutes > 0) {
        timeoutId = setTimeout(handleLogout, autoLogoutMinutes * 60 * 1000);
      }
    };

    // Initial setup
    updateConfig();
    resetTimer();

    // Events to track activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Throttle config check and timer reset
    let lastReset = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      // Only refresh config and timer if at least 10 seconds have passed since last activity log
      if (now - lastReset > 10000) {
        updateConfig();
        resetTimer();
        lastReset = now;
      }
    };

    events.forEach(evt => window.addEventListener(evt, throttledReset, { passive: true }));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, throttledReset));
    };
  }, [pathname]);

  return (
    <main className={cn(
      "flex-1 transition-all duration-300 min-h-0 flex flex-col",
      !isFullscreen && "pb-16 lg:pb-0"
    )}>
      <div className={cn(
        "flex-1 flex flex-col min-h-0",
        !isOperationalPage && !isFullscreen && "lg:w-full lg:px-12"
      )}>
        {children}
      </div>
    </main>
  );
}
