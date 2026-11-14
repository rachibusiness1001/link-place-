import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SUPER_ADMIN_EMAIL = "rachibusiness1001@gmail.com";

export interface AdminPermissions {
  viewTotalUsers: boolean;     // Sirf user kitne hai wo dekhe
  viewUsageStats: boolean;     // Kitne ne kitna kya use kiya wo dekhe
  viewUserEmails: boolean;     // Users ki full list & email dekhe
  addCredits: boolean;         // Kisi user ko credit add kar sake
  changeUserPlan: boolean;     // User ka plan change kar sake
  blockUsers: boolean;         // User ko block/unblock kar sake
}

export const DEFAULT_SUB_ADMIN_PERMISSIONS: AdminPermissions = {
  viewTotalUsers: true,
  viewUsageStats: true,
  viewUserEmails: true,
  addCredits: false,
  changeUserPlan: false,
  blockUsers: false,
};

export const FULL_ADMIN_PERMISSIONS: AdminPermissions = {
  viewTotalUsers: true,
  viewUsageStats: true,
  viewUserEmails: true,
  addCredits: true,
  changeUserPlan: true,
  blockUsers: true,
};

export interface ToolUsageBreakdown {
  findPlacement: number;
  listicleFinder: number;
  brandedAnchor: number;
  findAnchor: number;
  totalSearches: number;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "sub_admin" | "user";
  plan: "Free" | "Starter" | "Pro";
  credits: number;
  creditsUsed: number;
  isBlocked: boolean;
  joinedAt: string;
  lastActiveAt: string;
  usage: ToolUsageBreakdown;
  permissions?: AdminPermissions;
}

export interface UsageLogEntry {
  id: string;
  userEmail: string;
  userName: string;
  tool: "Find Placement" | "Listicle Finder" | "Branded Anchor" | "Find Anchor";
  targetDomain: string;
  creditsSpent: number;
  timestamp: string;
}

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

export interface User {
  uid: string;
  name?: string;
  email: string | null;
  role: "super_admin" | "sub_admin" | "admin" | "user";
  token?: string;
  tokens?: number;
  credits?: number;
  permissions?: AdminPermissions;
}

const INITIAL_MANAGED_USERS: ManagedUser[] = [
  {
    id: "usr_super_admin",
    name: "Rachit (Super Admin)",
    email: SUPER_ADMIN_EMAIL,
    role: "super_admin",
    plan: "Pro",
    credits: 100000,
    creditsUsed: 1420,
    isBlocked: false,
    joinedAt: "2026-07-01T10:00:00.000Z",
    lastActiveAt: new Date().toISOString(),
    usage: {
      findPlacement: 42,
      listicleFinder: 18,
      brandedAnchor: 25,
      findAnchor: 31,
      totalSearches: 116,
    },
    permissions: FULL_ADMIN_PERMISSIONS,
  },
  {
    id: "usr_101",
    name: "Aman Verma",
    email: "aman.seo@gmail.com",
    role: "user",
    plan: "Starter",
    credits: 2450,
    creditsUsed: 550,
    isBlocked: false,
    joinedAt: "2026-09-12T08:30:00.000Z",
    lastActiveAt: "2026-11-14T14:20:00.000Z",
    usage: {
      findPlacement: 19,
      listicleFinder: 8,
      brandedAnchor: 11,
      findAnchor: 14,
      totalSearches: 52,
    },
  },
  {
    id: "usr_102",
    name: "Priya Sharma",
    email: "priya.outreach@agency.io",
    role: "user",
    plan: "Pro",
    credits: 8200,
    creditsUsed: 1800,
    isBlocked: false,
    joinedAt: "2026-09-25T11:15:00.000Z",
    lastActiveAt: "2026-11-14T16:05:00.000Z",
    usage: {
      findPlacement: 64,
      listicleFinder: 22,
      brandedAnchor: 30,
      findAnchor: 19,
      totalSearches: 135,
    },
  },
  {
    id: "usr_103",
    name: "Rohit Patel",
    email: "rohit.links@gmail.com",
    role: "user",
    plan: "Free",
    credits: 120,
    creditsUsed: 380,
    isBlocked: false,
    joinedAt: "2026-10-04T09:00:00.000Z",
    lastActiveAt: "2026-11-13T19:45:00.000Z",
    usage: {
      findPlacement: 12,
      listicleFinder: 5,
      brandedAnchor: 3,
      findAnchor: 9,
      totalSearches: 29,
    },
  },
  {
    id: "usr_104",
    name: "Neha Gupta",
    email: "neha.digital@gmail.com",
    role: "sub_admin",
    plan: "Starter",
    credits: 5000,
    creditsUsed: 320,
    isBlocked: false,
    joinedAt: "2026-10-18T13:20:00.000Z",
    lastActiveAt: "2026-11-14T12:10:00.000Z",
    usage: {
      findPlacement: 10,
      listicleFinder: 6,
      brandedAnchor: 4,
      findAnchor: 7,
      totalSearches: 27,
    },
    permissions: {
      viewTotalUsers: true,
      viewUsageStats: true,
      viewUserEmails: true,
      addCredits: false,
      changeUserPlan: false,
      blockUsers: false,
    },
  },
];

const INITIAL_USAGE_LOGS: UsageLogEntry[] = [
  {
    id: "log_1",
    userEmail: SUPER_ADMIN_EMAIL,
    userName: "Rachit (Super Admin)",
    tool: "Listicle Finder",
    targetDomain: "ahrefs.com",
    creditsSpent: 10,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "log_2",
    userEmail: "priya.outreach@agency.io",
    userName: "Priya Sharma",
    tool: "Find Placement",
    targetDomain: "hubspot.com",
    creditsSpent: 20,
    timestamp: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
  },
  {
    id: "log_3",
    userEmail: "aman.seo@gmail.com",
    userName: "Aman Verma",
    tool: "Branded Anchor",
    targetDomain: "zapier.com",
    creditsSpent: 15,
    timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
  },
  {
    id: "log_4",
    userEmail: "rohit.links@gmail.com",
    userName: "Rohit Patel",
    tool: "Find Anchor",
    targetDomain: "backlinko.com",
    creditsSpent: 5,
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id: "log_5",
    userEmail: "priya.outreach@agency.io",
    userName: "Priya Sharma",
    tool: "Listicle Finder",
    targetDomain: "shopify.com",
    creditsSpent: 10,
    timestamp: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
  },
];

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  loginWithEmail: (email: string, name?: string) => ManagedUser;
  logoutUser: () => void;

  managedUsers: ManagedUser[];
  usageLogs: UsageLogEntry[];

  addCreditsToUser: (userId: string, amount: number) => void;
  setCreditsForUser: (userId: string, amount: number) => void;
  updateUserPlan: (userId: string, plan: "Free" | "Starter" | "Pro") => void;
  toggleBlockUser: (userId: string) => void;
  addNewUser: (
    email: string,
    name: string,
    plan: "Free" | "Starter" | "Pro",
    initialCredits: number
  ) => void;
  deleteManagedUser: (userId: string) => void;

  createOrUpdateSubAdmin: (
    email: string,
    name: string,
    permissions: AdminPermissions
  ) => void;
  updateSubAdminPermissions: (
    userId: string,
    permissions: AdminPermissions
  ) => void;
  removeSubAdminRole: (userId: string) => void;

  recordToolUsage: (
    tool: UsageLogEntry["tool"],
    targetDomain: string,
    creditsSpent?: number
  ) => void;

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
    (set, get) => ({
      user: {
        uid: "usr_super_admin",
        name: "Rachit (Super Admin)",
        email: SUPER_ADMIN_EMAIL,
        role: "super_admin",
        tokens: 100000,
        credits: 100000,
        permissions: FULL_ADMIN_PERMISSIONS,
      },
      setUser: (user) => set({ user }),

      managedUsers: INITIAL_MANAGED_USERS,
      usageLogs: INITIAL_USAGE_LOGS,

      loginWithEmail: (rawEmail: string, rawName?: string) => {
        const cleanEmail = rawEmail.trim().toLowerCase();
        const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
        const state = get();
        const existing = state.managedUsers.find(
          (u) => u.email.toLowerCase() === cleanEmail
        );

        let targetUser: ManagedUser;

        if (existing) {
          const updatedRole = isSuper ? "super_admin" : existing.role;
          const updatedPermissions = isSuper
            ? FULL_ADMIN_PERMISSIONS
            : existing.permissions;
          targetUser = {
            ...existing,
            name: rawName?.trim() || existing.name,
            role: updatedRole,
            permissions: updatedPermissions,
            lastActiveAt: new Date().toISOString(),
          };
          set({
            managedUsers: state.managedUsers.map((u) =>
              u.id === existing.id ? targetUser : u
            ),
          });
        } else {
          const derivedName =
            rawName?.trim() ||
            cleanEmail
              .split("@")[0]
              .replace(/[._-]+/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());

          targetUser = {
            id: `usr_${Date.now()}`,
            name: isSuper ? "Rachit (Super Admin)" : derivedName,
            email: cleanEmail,
            role: isSuper ? "super_admin" : "user",
            plan: isSuper ? "Pro" : "Starter",
            credits: isSuper ? 100000 : 500,
            creditsUsed: 0,
            isBlocked: false,
            joinedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            usage: {
              findPlacement: 0,
              listicleFinder: 0,
              brandedAnchor: 0,
              findAnchor: 0,
              totalSearches: 0,
            },
            permissions: isSuper ? FULL_ADMIN_PERMISSIONS : undefined,
          };
          set({
            managedUsers: [targetUser, ...state.managedUsers],
          });
        }

        set({
          user: {
            uid: targetUser.id,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
            tokens: targetUser.credits,
            credits: targetUser.credits,
            permissions: targetUser.permissions,
          },
          activePlan: targetUser.plan,
        });

        return targetUser;
      },

      logoutUser: () => {
        set({ user: null });
      },

      addCreditsToUser: (userId: string, amount: number) => {
        if (!Number.isFinite(amount) || amount === 0) return;
        set((state) => {
          const updatedUsers = state.managedUsers.map((u) => {
            if (u.id !== userId) return u;
            const nextCredits = Math.max(0, u.credits + amount);
            return { ...u, credits: nextCredits };
          });
          const current = state.user;
          const updatedCurrent =
            current && updatedUsers.find((u) => u.id === current.uid);
          return {
            managedUsers: updatedUsers,
            user: updatedCurrent
              ? {
                  ...current,
                  credits: updatedCurrent.credits,
                  tokens: updatedCurrent.credits,
                }
              : current,
          };
        });
      },

      setCreditsForUser: (userId: string, amount: number) => {
        if (!Number.isFinite(amount) || amount < 0) return;
        set((state) => {
          const updatedUsers = state.managedUsers.map((u) =>
            u.id === userId ? { ...u, credits: Math.max(0, Math.round(amount)) } : u
          );
          const current = state.user;
          const updatedCurrent =
            current && updatedUsers.find((u) => u.id === current.uid);
          return {
            managedUsers: updatedUsers,
            user: updatedCurrent
              ? {
                  ...current,
                  credits: updatedCurrent.credits,
                  tokens: updatedCurrent.credits,
                }
              : current,
          };
        });
      },

      updateUserPlan: (userId: string, plan: "Free" | "Starter" | "Pro") => {
        set((state) => {
          const updatedUsers = state.managedUsers.map((u) =>
            u.id === userId ? { ...u, plan } : u
          );
          const current = state.user;
          const isCurrent = current && current.uid === userId;
          return {
            managedUsers: updatedUsers,
            activePlan: isCurrent ? plan : state.activePlan,
          };
        });
      },

      toggleBlockUser: (userId: string) => {
        set((state) => ({
          managedUsers: state.managedUsers.map((u) => {
            if (u.id !== userId) return u;
            if (u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return u; // Never block super admin
            return { ...u, isBlocked: !u.isBlocked };
          }),
        }));
      },

      addNewUser: (email, name, plan, initialCredits) => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) return;
        set((state) => {
          if (state.managedUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
            return state;
          }
          const newUser: ManagedUser = {
            id: `usr_${Date.now()}`,
            name:
              name.trim() ||
              cleanEmail
                .split("@")[0]
                .replace(/[._-]+/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase()),
            email: cleanEmail,
            role:
              cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()
                ? "super_admin"
                : "user",
            plan,
            credits: Math.max(0, Number(initialCredits) || 0),
            creditsUsed: 0,
            isBlocked: false,
            joinedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            usage: {
              findPlacement: 0,
              listicleFinder: 0,
              brandedAnchor: 0,
              findAnchor: 0,
              totalSearches: 0,
            },
          };
          return { managedUsers: [newUser, ...state.managedUsers] };
        });
      },

      deleteManagedUser: (userId: string) => {
        set((state) => ({
          managedUsers: state.managedUsers.filter(
            (u) =>
              u.id !== userId ||
              u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
          ),
        }));
      },

      createOrUpdateSubAdmin: (email, name, permissions) => {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) return;

        set((state) => {
          const existing = state.managedUsers.find(
            (u) => u.email.toLowerCase() === cleanEmail
          );
          let nextUsers: ManagedUser[];
          if (existing) {
            nextUsers = state.managedUsers.map((u) =>
              u.id === existing.id
                ? {
                    ...u,
                    name: name.trim() || u.name,
                    role: "sub_admin",
                    permissions: { ...permissions },
                  }
                : u
            );
          } else {
            const newSubAdmin: ManagedUser = {
              id: `usr_${Date.now()}`,
              name:
                name.trim() ||
                cleanEmail
                  .split("@")[0]
                  .replace(/[._-]+/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase()),
              email: cleanEmail,
              role: "sub_admin",
              plan: "Pro",
              credits: 5000,
              creditsUsed: 0,
              isBlocked: false,
              joinedAt: new Date().toISOString(),
              lastActiveAt: new Date().toISOString(),
              usage: {
                findPlacement: 0,
                listicleFinder: 0,
                brandedAnchor: 0,
                findAnchor: 0,
                totalSearches: 0,
              },
              permissions: { ...permissions },
            };
            nextUsers = [newSubAdmin, ...state.managedUsers];
          }

          const current = state.user;
          const updatedCurrent =
            current &&
            nextUsers.find(
              (u) => u.email.toLowerCase() === (current.email || "").toLowerCase()
            );

          return {
            managedUsers: nextUsers,
            user: updatedCurrent
              ? {
                  ...current,
                  role: updatedCurrent.role,
                  permissions: updatedCurrent.permissions,
                }
              : current,
          };
        });
      },

      updateSubAdminPermissions: (userId, permissions) => {
        set((state) => {
          const nextUsers = state.managedUsers.map((u) =>
            u.id === userId ? { ...u, permissions: { ...permissions } } : u
          );
          const current = state.user;
          const updatedCurrent =
            current && nextUsers.find((u) => u.id === current.uid);
          return {
            managedUsers: nextUsers,
            user: updatedCurrent
              ? { ...current, permissions: updatedCurrent.permissions }
              : current,
          };
        });
      },

      removeSubAdminRole: (userId) => {
        set((state) => {
          const nextUsers = state.managedUsers.map((u) => {
            if (u.id !== userId) return u;
            if (u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) return u;
            return { ...u, role: "user" as const, permissions: undefined };
          });
          const current = state.user;
          const updatedCurrent =
            current && nextUsers.find((u) => u.id === current.uid);
          return {
            managedUsers: nextUsers,
            user: updatedCurrent
              ? {
                  ...current,
                  role: updatedCurrent.role,
                  permissions: updatedCurrent.permissions,
                }
              : current,
          };
        });
      },

      recordToolUsage: (tool, targetDomain, creditsSpent = 10) => {
        set((state) => {
          const activeEmail = (
            state.user?.email || SUPER_ADMIN_EMAIL
          ).toLowerCase();
          const activeName = state.user?.name || "Rachit (Super Admin)";

          const newLog: UsageLogEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userEmail: activeEmail,
            userName: activeName,
            tool,
            targetDomain: targetDomain || "unknown",
            creditsSpent,
            timestamp: new Date().toISOString(),
          };

          const nextUsers = state.managedUsers.map((u) => {
            if (u.email.toLowerCase() !== activeEmail) return u;
            const nextUsage = { ...u.usage };
            if (tool === "Find Placement") nextUsage.findPlacement += 1;
            else if (tool === "Listicle Finder") nextUsage.listicleFinder += 1;
            else if (tool === "Branded Anchor") nextUsage.brandedAnchor += 1;
            else if (tool === "Find Anchor") nextUsage.findAnchor += 1;
            nextUsage.totalSearches += 1;

            return {
              ...u,
              credits: Math.max(0, u.credits - creditsSpent),
              creditsUsed: u.creditsUsed + creditsSpent,
              lastActiveAt: new Date().toISOString(),
              usage: nextUsage,
            };
          });

          const updatedCurrent = nextUsers.find(
            (u) => u.email.toLowerCase() === activeEmail
          );

          return {
            managedUsers: nextUsers,
            usageLogs: [newLog, ...state.usageLogs.slice(0, 199)],
            user:
              state.user && updatedCurrent
                ? {
                    ...state.user,
                    credits: updatedCurrent.credits,
                    tokens: updatedCurrent.credits,
                  }
                : state.user,
          };
        });
      },

      activePlan: "Pro",
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
    { name: "linkplace-storage-v2" }
  )
);
