import { create } from 'zustand';

interface LayoutState {
  isFullscreen: boolean;
  isSidebarCollapsed: boolean;
  setFullscreen: (val: boolean) => void;
  toggleFullscreen: () => void;
  toggleSidebar: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isFullscreen: false,
  isSidebarCollapsed: false,
  setFullscreen: (val) => set({ isFullscreen: val }),
  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
