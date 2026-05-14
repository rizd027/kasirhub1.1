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


  useEffect(() => {
    let isMounted = true;

    const hydrateFromSupabase = async () => {
      if (!navigator.onLine) {
        setIsChecking(false);
        return;
      }

      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('Auth session check timed out, proceeding with local state.');
          setIsChecking(false);
        }
      }, 15000);

      try {
        const { data: { session: supaSession } } = await supabase.auth.getSession();
        
        if (isMounted && supaSession?.user) {
          const { error: userError } = await supabase.auth.getUser();
          
          if (userError) {
            console.error('[AuthCheck] User verification failed (possibly expired):', userError);
            
            if (userError.message?.includes('Refresh Token Not Found') || userError.status === 400) {
                console.warn('[AuthCheck] Invalid session detected, performing hard logout.');
            }

            setSession(null);
            await supabase.auth.signOut();
            localStorage.clear();
            window.location.href = '/login'; 
            return;
          }

          const { triggerSync } = await import('@/hooks/useSync');
          setTimeout(() => {
            triggerSync(supaSession.user.id).catch(console.error);
          }, 1500);

          try {
            const settings = await db.settings.get(supaSession.user.id);
            if (settings?.pin_code) {
              localStorage.setItem('kasirhub_app_password', settings.pin_code);
            }
          } catch (pinErr) {
            console.error('Failed to hydrate PIN:', pinErr);
          }

          if (!session) {
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
        router.replace('/login');
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && supaSession?.user) {
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

  useEffect(() => {
    if (!isHydrated || isChecking) return;

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

    if (!session) {
      router.replace('/login');
      return;
    }

    if (session.role === 'staff' && !isCheckedIn) {
      if (pathname !== '/absensi' && pathname !== '/pengaturan/account') {
        router.replace('/absensi');
      }
    }
  }, [isHydrated, isChecking, session, isCheckedIn, pathname, router]);

  useEffect(() => {
    if (!isHydrated || isChecking || !session) return;

    if (PUBLIC_ROUTES.includes(pathname)) return;

    const savedPin = localStorage.getItem('kasirhub_app_password');
    if (savedPin && !isPinVerifiedRef.current && !isAppLocked) {
      setIsAppLocked(true);
    }
  }, [isHydrated, isChecking, session, pathname, isAppLocked]);

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

