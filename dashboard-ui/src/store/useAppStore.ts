import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Placement {
  id: string;
  projectId: string;
  domain: string;
  articleUrl: string;
  anchor: string;
  targetUrl: string;
  suggestedEdit: string;
  relevanceScore?: number;
  clientName?: string;
  clientEmail?: string;
  savedAt: string;
  isBranded?: boolean;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

interface User {
  uid: string;
  email: string | null;
  role?: string;
  token?: string;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  activePlan: string;
  setActivePlan: (plan: string) => void;
  stats: {
    placementsFound: number;
    placementsExported: number;
    tokensUsedPerPlacement: number;
    regenerationsPerPlacement: number;
    totalMonthlyTokens: number;
    usedMonthlyTokens: number;
    totalMonthlyPlacements: number;
    usedMonthlyPlacements: number;
  };
  projects: Project[];
  addProject: (name: string) => Project;
  deleteProject: (id: string) => void;
  placements: Placement[];
  savePlacement: (placement: Omit<Placement, "id" | "savedAt">) => void;
  deletePlacement: (id: string) => void;
  updatePlacement: (id: string, updates: Partial<Placement>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
      activePlan: "Starter",
      setActivePlan: (plan) => set({ activePlan: plan }),
      stats: {
        placementsFound: 12450,
        placementsExported: 8400,
        tokensUsedPerPlacement: 2.4,
        regenerationsPerPlacement: 1.2,
        totalMonthlyTokens: 100000,
        usedMonthlyTokens: 68400,
        totalMonthlyPlacements: 100,
        usedMonthlyPlacements: 84,
      },
      projects: [],
      addProject: (name: string) => {
        const newProject: Project = {
          id: `proj_${Date.now()}`,
          name,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ projects: [...state.projects, newProject] }));
        return newProject;
      },
      deleteProject: (id: string) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          placements: state.placements.filter((pl) => pl.projectId !== id),
        }));
      },
      placements: [],
      savePlacement: (placement) => {
        const newPlacement: Placement = {
          ...placement,
          id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          savedAt: new Date().toISOString(),
        };
        set((state) => ({ placements: [...state.placements, newPlacement] }));
      },
      deletePlacement: (id: string) => {
        set((state) => ({
          placements: state.placements.filter((pl) => pl.id !== id),
        }));
      },
      updatePlacement: (id: string, updates: Partial<Placement>) => {
        set((state) => ({
          placements: state.placements.map((pl) =>
            pl.id === id ? { ...pl, ...updates } : pl
          ),
        }));
      },
    }),
    { name: "linkplace-storage" }
  )
);
