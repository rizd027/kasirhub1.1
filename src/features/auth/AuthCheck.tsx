'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffStore } from '@/store/useStaffStore';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

const PUBLIC_ROUTES = ['/login', '/register', '/menu'];

export function AuthCheck({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, setSession, isCheckedIn, isHydrated } = useStaffStore();
  const [isChecking, setIsChecking] = useState(true);

  // Listen to Supabase Auth state changes and hydrate Zustand session
  useEffect(() => {
    let isMounted = true;

    const hydrateFromSupabase = async () => {
      // Safety timeout: 6 seconds to prevent getting stuck
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('Auth session check timed out, proceeding with local state.');
          setIsChecking(false);
        }
      }, 6000);

      try {
        const { data: { session: supaSession } } = await supabase.auth.getSession();
        
        if (isMounted && supaSession?.user && !session) {
          // If we have a supaSession but no local session, try to get profile
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, role')
              .eq('id', supaSession.user.id)
              .single();

            setSession({
              id: supaSession.user.id,
              name: profile?.full_name || supaSession.user.email?.split('@')[0] || 'Admin',
              role: 'admin',
            });
          } catch (profileErr) {
            // Fallback for profile failure
            setSession({
              id: supaSession.user.id,
              name: supaSession.user.email?.split('@')[0] || 'Admin',
              role: 'admin',
            });
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, supaSession) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && supaSession?.user) {
        if (!session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', supaSession.user.id)
            .single();

          setSession({
            id: supaSession.user.id,
            name: profile?.full_name || supaSession.user.email?.split('@')[0] || 'Admin',
            role: 'admin',
          });
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route guard
  useEffect(() => {
    if (!isHydrated || isChecking) return;

    // 1. Public routes — allow access, redirect away if already logged in
    if (PUBLIC_ROUTES.includes(pathname)) {
      if (session) {
        if (session.role === 'staff' && !isCheckedIn) {
          router.replace('/settings/absensi');
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
      if (pathname !== '/settings/absensi' && pathname !== '/settings/account') {
        router.replace('/settings/absensi');
      }
    }
  }, [isHydrated, isChecking, session, isCheckedIn, pathname, router]);

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

  return <>{children}</>;
}
