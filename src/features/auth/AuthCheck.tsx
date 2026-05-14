'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useStaffStore } from '@/store/useStaffStore';
import { supabase } from '@/services/supabase';
import { Loader2 } from 'lucide-react';
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


  // Listen to Supabase Auth state changes and hydrate Zustand session
  useEffect(() => {
    let isMounted = true;

    const hydrateFromSupabase = async () => {
      // 1. If offline, don't wait for Supabase, trust the local store
      if (!navigator.onLine) {
        setIsChecking(false);
        return;
      }

      // 2. Safety timeout: 15 seconds to prevent getting stuck (naik dari 6s)
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('Auth session check timed out, proceeding with local state.');
          setIsChecking(false);
        }
      }, 15000);

      try {
        const { data: { session: supaSession } } = await supabase.auth.getSession();
        
        if (isMounted && supaSession?.user) {
          // IMPORTANT: Check if user STILL EXISTS in auth.users (server check)
          const { error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error('[AuthCheck] User verification failed (possibly expired):', userError);
            // If session is expired, just clear session state and redirect
            setSession(null);
            await supabase.auth.signOut();
            window.location.href = '/login'; 
            return;
          }

          // Trigger sync down with a small delay to avoid auth lock contention
          const { triggerSync } = await import('@/hooks/useSync');
          setTimeout(() => {
            triggerSync(supaSession.user.id).catch(console.error);
          }, 1500);

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
            let profile = null;
            let retryCount = 0;
            
            while (!profile && retryCount < 3) {
              try {
                let profileData: any = null;
                const { data, error: profileErr } = await supabase
                  .from('profiles')
                  .select('full_name, role, status')
                  .eq('id', supaSession.user.id)
                  .maybeSingle();

                if (profileErr?.code === '42703' || profileErr?.message?.includes('status')) {
                  // Kolom status belum ada di tabel lama — fallback tanpa status
                  const { data: fallback } = await supabase
                    .from('profiles')
                    .select('full_name, role')
                    .eq('id', supaSession.user.id)
                    .maybeSingle();
                  profileData = fallback;
                } else {
                  profileData = data;
                }

                if (profileData?.status === 'removed') {
                  console.warn('[AuthCheck] Account removed, logging out.');
                  setSession(null);
                  await supabase.auth.signOut({ scope: 'global' });
                  await db.delete();
                  window.location.reload();
                  return;
                }
                
                profile = profileData;
              } catch (e) {
                console.error('[AuthCheck] Profile fetch error:', e);
              }

              if (!profile) {
                console.log(`[AuthCheck] Profile not found, retrying... (${retryCount + 1})`);
                await new Promise(r => setTimeout(r, 1000));
                retryCount++;
              }
            }

            setSession({
              id: supaSession.user.id,
              email: supaSession.user.email,
              name: profile?.full_name || supaSession.user.email?.split('@')[0] || 'Admin',
              role: profile?.role === 'staff' ? 'staff' : 'admin',
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
      if (event === 'SIGNED_OUT') {
        setSession(null);
        // DO NOT delete DB here to preserve offline data on session expiry
        router.replace('/login');
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && supaSession?.user) {
        // Double check existence on sign in / refresh
        const { error } = await supabase.auth.getUser();
        if (error) {
          await supabase.auth.signOut();
          return;
        }

        if (!session) {
          let profileData: any = null;
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('full_name, role, status')
            .eq('id', supaSession.user.id)
            .maybeSingle();

          if (profileErr?.code === '42703' || profileErr?.message?.includes('status')) {
            // Kolom status belum ada — fallback
            const { data: fallback } = await supabase
              .from('profiles')
              .select('full_name, role')
              .eq('id', supaSession.user.id)
              .maybeSingle();
            profileData = fallback;
          } else {
            profileData = profile;
          }

          if (profileData?.status === 'removed') {
            await supabase.auth.signOut({ scope: 'global' });
            return;
          }

          setSession({
            id: supaSession.user.id,
            email: supaSession.user.email,
            name: profileData?.full_name || supaSession.user.email?.split('@')[0] || 'Admin',
            role: profileData?.role === 'staff' ? 'staff' : 'admin',
          });
        }
      }
    });

    return () => {
      isMounted = false;
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
      if (pathname !== '/absensi' && pathname !== '/pengaturan/account') {
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
          <div className="size-16 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-100 animate-pulse">
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

