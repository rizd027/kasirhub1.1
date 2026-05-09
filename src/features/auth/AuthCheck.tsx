'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffStore } from '@/store/useStaffStore';
import { supabase } from '@/services/supabase';
import { Loader2 } from 'lucide-react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { PinDialog } from '@/components/ui/PinDialog';
import { db } from '@/db/dexie';

const PUBLIC_ROUTES = ['/login', '/register', '/menu'];

export function AuthCheck({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, setSession, isCheckedIn, isHydrated } = useStaffStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const isPinVerifiedRef = useRef(false);

  // Realtime Supabase → Dexie sync
  useRealtimeSync();

  // Listen to Supabase Auth state changes and hydrate Zustand session
  useEffect(() => {
    let isMounted = true;

    const hydrateFromSupabase = async () => {
      // 1. If offline, don't wait for Supabase, trust the local store
      if (!navigator.onLine) {
        setIsChecking(false);
        return;
      }

      // 2. Safety timeout: 6 seconds to prevent getting stuck
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('Auth session check timed out, proceeding with local state.');
          setIsChecking(false);
        }
      }, 6000);

      try {
        const { data: { session: supaSession } } = await supabase.auth.getSession();
        
        if (isMounted && supaSession?.user) {
          // Trigger sync down
          const { triggerSync } = await import('@/hooks/useSync');
          triggerSync(supaSession.user.id).catch(console.error);

          // Hydrate PIN from Settings if not set locally
          try {
            const settings = await db.settings.get(supaSession.user.id);
            if (settings?.pin_code) {
              localStorage.setItem('kasirhub_app_password', settings.pin_code);
            }
          } catch (pinErr) {
            console.error('Failed to hydrate PIN:', pinErr);
          }

          if (!session) {
            // If we have a supaSession but no local session, try to get profile
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, role')
                .eq('id', supaSession.user.id)
                .maybeSingle();

              setSession({
                id: supaSession.user.id,
                email: supaSession.user.email,
                name: profile?.full_name || supaSession.user.email?.split('@')[0] || 'Admin',
                role: profile?.role === 'staff' ? 'staff' : 'admin',
              });
            } catch (profileErr) {
              // Fallback for profile failure
              setSession({
                id: supaSession.user.id,
                email: supaSession.user.email,
                name: supaSession.user.email?.split('@')[0] || 'Admin',
                role: 'admin',
              });
            }
          }
        }
      } catch (err) {
        console.error('Initial session check failed:', err);
      } finally {
        clearTimeout(safetyTimeout);
        if (isMounted) setIsChecking(false);
      }
    };

    hydrateFromSupabase();

    // 3. Background Auto-Sync Interval (every 60 seconds)
    const syncInterval = setInterval(async () => {
      if (navigator.onLine && session?.id && !isChecking) {
        console.log('[BackgroundSync] Starting periodic sync...');
        const { triggerSync } = await import('@/hooks/useSync');
        triggerSync(session.id).catch(console.error);
      }
    }, 60000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, supaSession) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && supaSession?.user) {
        if (!session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', supaSession.user.id)
            .maybeSingle();

          setSession({
            id: supaSession.user.id,
            email: supaSession.user.email,
            name: profile?.full_name || supaSession.user.email?.split('@')[0] || 'Admin',
            role: profile?.role === 'staff' ? 'staff' : 'admin',
          });
        }
      }
    });

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Route guard
  useEffect(() => {
    if (!isHydrated || isChecking) return;

    // 1. Public routes — allow access, redirect away if already logged in
    if (PUBLIC_ROUTES.includes(pathname)) {
      if (session) {
        if (session.role === 'staff' && !isCheckedIn) {
          router.replace('/absensi');
        } else {
          router.replace('/kasir');
        }
      }
      return;
    }

    // 2. No session → go to login
    if (!session) {
      router.replace('/login'); // Use replace to avoid back-button loops
      return;
    }

    // 3. Staff not checked in → force absensi
    if (session.role === 'staff' && !isCheckedIn) {
      if (pathname !== '/absensi' && pathname !== '/settings/account') {
        router.replace('/absensi');
      }
    }
  }, [isHydrated, isChecking, session, isCheckedIn, pathname, router]);

  // Global App Lock Effect (Separated to stabilize dependencies)
  useEffect(() => {
    if (!isHydrated || isChecking || !session) return;

    // Don't lock on public routes
    if (PUBLIC_ROUTES.includes(pathname)) return;

    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (savedPin && !isPinVerifiedRef.current && !isAppLocked) {
      setIsAppLocked(true);
    }
  }, [isHydrated, isChecking, session, pathname, isAppLocked]);

  // Loading Splash Screen
  if (!isHydrated || isChecking) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-100 animate-pulse">
            K
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-black text-slate-800 tracking-tighter">KasirHub</h1>
            <div className="flex items-center gap-2 mt-2">
              <Loader2 className="size-3 text-indigo-600 animate-spin" />
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Menyiapkan Sesi...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PinDialog 
        isOpen={isAppLocked}
        onClose={() => {
          // If locked, we can't really close without verifying
          // but we can let them log out if needed
          setIsAppLocked(false);
          router.replace('/login');
        }}
        onSuccess={() => {
          isPinVerifiedRef.current = true;
          setIsAppLocked(false);
        }}
        title="App Locked"
        description="Masukkan PIN untuk masuk ke KasirHub"
      />
      {children}
    </>
  );
}
