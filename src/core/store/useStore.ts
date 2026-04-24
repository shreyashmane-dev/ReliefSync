import { create } from 'zustand';

export interface AppState {
  user: any | null;
  setUser: (user: any | null) => void;
  incidents: any[];
  setIncidents: (incidents: any[]) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null, // Require login now
  setUser: (user) => set({ user }),
  incidents: [],
  setIncidents: (incidents) => set({ incidents }),
  activeTab: 'reports',
  setActiveTab: (activeTab) => set({ activeTab }),
}));
