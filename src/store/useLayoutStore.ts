import { create } from 'zustand';

interface LayoutState {
  isFullscreen: boolean;
  setFullscreen: (val: boolean) => void;
  toggleFullscreen: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isFullscreen: false,
  setFullscreen: (val) => set({ isFullscreen: val }),
  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
}));
