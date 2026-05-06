import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserSession {
  id: string;
  name: string;
  role: 'admin' | 'staff';
  username?: string;
  can_view_reports?: boolean;
}

interface StaffState {
  session: UserSession | null;
  isCheckedIn: boolean;
  isHydrated: boolean;
  setSession: (session: UserSession | null) => void;
  setCheckedIn: (status: boolean) => void;
  setHydrated: (status: boolean) => void;
  logout: () => void;
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set) => ({
      session: null,
      isCheckedIn: false,
      isHydrated: false,
      setSession: (session) => set({ session }),
      setCheckedIn: (status) => set({ isCheckedIn: status }),
      setHydrated: (status) => set({ isHydrated: status }),
      logout: () => set({ session: null, isCheckedIn: false }),
    }),
    { 
      name: 'kasirhub_auth_session',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      }
    }
  )
);
