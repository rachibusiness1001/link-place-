"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Shield,
  Users,
  Activity,
  UserPlus,
  Coins,
  Plus,
  Ban,
  CheckCircle2,
  Trash2,
  Search,
  Lock,
  Unlock,
  Sparkles,
  Crown,
  Eye,
  LogOut,
  ArrowRightLeft,
  BarChart3,
} from "lucide-react";
import {
  useAppStore,
  SUPER_ADMIN_EMAIL,
  AdminPermissions,
  DEFAULT_SUB_ADMIN_PERMISSIONS,
  FULL_ADMIN_PERMISSIONS,
} from "@/store/useAppStore";

const plans = [
  {
    name: "Free",
    price: "$0",
    tokens: "5,000 Tokens/mo",
    features: [
      "Normal Anchor Search",
      "Up to 5 searches per day",
      "Standard support",
    ],
    isPopular: false,
  },
  {
    name: "Starter",
    price: "$49",
    tokens: "50,000 Tokens/mo",
    features: [
      "Branded Anchor Search",
      "Unlimited searches",
      "Priority support",
      "Export to CSV",
    ],
    isPopular: true,
  },
  {
    name: "Pro",
    price: "$99",
    tokens: "200,000 Tokens/mo",
    features: [
      "Everything in Starter",
      "API Access",
      "Bulk Processing",
      "Dedicated Account Manager",
    ],
    isPopular: false,
  },
];

const PERMISSION_LABELS: {
  key: keyof AdminPermissions;
  title: string;
  subtitle: string;
}[] = [
  {
    key: "viewTotalUsers",
    title: "Total Users Count Dekhe",
    subtitle: "Sirf total kitne users hain aur overview numbers dekh sake",
  },
  {
    key: "viewUsageStats",
    title: "Kitne Ne Kitna Kya Use Kiya Dekhe",
    subtitle:
      "Har user ne kaunsa tool kitni baar use kiya aur kitne credits kharch kiye wo dekh sake",
  },
  {
    key: "viewUserEmails",
    title: "Users Ki Full List & Email Dekhe",
    subtitle: "Saare users ka naam, email, plan aur credits table dekh sake",
  },
  {
    key: "addCredits",
    title: "Users Ko Credits Add / Give Kar Sake",
    subtitle: "Apni taraf se kisi bhi user ke account me credits add kar sake",
  },
  {
    key: "changeUserPlan",
    title: "Users Ka Plan Change Kar Sake",
    subtitle: "User ka plan Free / Starter / Pro me badal sake",
  },
  {
    key: "blockUsers",
    title: "Users Ko Block / Unblock Kar Sake",
    subtitle: "Kisi user ka account block ya unblock kar sake",
  },
];

export default function SettingsPage() {
  const {
    user,
    loginWithEmail,
    managedUsers,
    usageLogs,
    addCreditsToUser,
    setCreditsForUser,
    updateUserPlan,
    toggleBlockUser,
    addNewUser,
    deleteManagedUser,
    createOrUpdateSubAdmin,
    updateSubAdminPermissions,
    removeSubAdminRole,
    activePlan,
    setActivePlan,
  } = useAppStore();

  const currentEmail = (user?.email || "").toLowerCase();
  const matchedManagedUser = managedUsers.find(
    (u) => u.email.toLowerCase() === currentEmail
  );

  const isSuperAdmin =
    currentEmail === SUPER_ADMIN_EMAIL.toLowerCase() ||
    user?.role === "super_admin" ||
    matchedManagedUser?.role === "super_admin";

  const isSubAdmin =
    !isSuperAdmin &&
    (user?.role === "sub_admin" ||
      user?.role === "admin" ||
      matchedManagedUser?.role === "sub_admin");

  const hasAdminAccess = isSuperAdmin || isSubAdmin;

  const myPermissions: AdminPermissions = isSuperAdmin
    ? FULL_ADMIN_PERMISSIONS
    : matchedManagedUser?.permissions ||
      user?.permissions ||
      DEFAULT_SUB_ADMIN_PERMISSIONS;

  const [mainSection, setMainSection] = useState<"admin" | "plans">(
    hasAdminAccess ? "admin" : "plans"
  );
  const [adminTab, setAdminTab] = useState<"users" | "usage" | "admins">(
    "users"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [customCreditInputs, setCustomCreditInputs] = useState<
    Record<string, string>
  >({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Add New User state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<"Free" | "Starter" | "Pro">(
    "Starter"
  );
  const [newUserCredits, setNewUserCredits] = useState("500");

  // Create New Sub-Admin state
  const [subAdminEmail, setSubAdminEmail] = useState("");
  const [subAdminName, setSubAdminName] = useState("");
  const [newAdminPerms, setNewAdminPerms] = useState<AdminPermissions>({
    viewTotalUsers: true,
    viewUsageStats: true,
    viewUserEmails: true,
    addCredits: false,
    changeUserPlan: false,
    blockUsers: false,
  });

  // Quick account switcher input for testing
  const [switchEmailInput, setSwitchEmailInput] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Computed metrics
  const totalUsersCount = managedUsers.length;
  const activeUsersCount = managedUsers.filter((u) => !u.isBlocked).length;
  const totalCreditsAvailable = managedUsers.reduce(
    (acc, u) => acc + (u.credits || 0),
    0
  );
  const totalCreditsUsed = managedUsers.reduce(
    (acc, u) => acc + (u.creditsUsed || 0),
    0
  );
  const totalToolSearches = managedUsers.reduce(
    (acc, u) => acc + (u.usage?.totalSearches || 0),
    0
  );
  const totalPlacementRuns = managedUsers.reduce(
    (acc, u) => acc + (u.usage?.findPlacement || 0),
    0
  );
  const totalListicleRuns = managedUsers.reduce(
    (acc, u) => acc + (u.usage?.listicleFinder || 0),
    0
  );
  const totalBrandedRuns = managedUsers.reduce(
    (acc, u) => acc + (u.usage?.brandedAnchor || 0),
    0
  );
  const totalAnchorRuns = managedUsers.reduce(
    (acc, u) => acc + (u.usage?.findAnchor || 0),
    0
  );

  const subAdminsList = managedUsers.filter((u) => u.role === "sub_admin");

  const filteredUsers = managedUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQuickAddCredits = (
    userId: string,
    userName: string,
    amount: number
  ) => {
    if (!isSuperAdmin && !myPermissions.addCredits) return;
    addCreditsToUser(userId, amount);
    showToast(`Added +${amount} credits to ${userName}`);
  };

  const handleCustomCreditAction = (
    userId: string,
    userName: string,
    mode: "add" | "set"
  ) => {
    if (!isSuperAdmin && !myPermissions.addCredits) return;
    const raw = customCreditInputs[userId];
    const num = Number(raw);
    if (!raw || !Number.isFinite(num) || num < 0) {
      showToast("Please enter a valid credit number");
      return;
    }
    if (mode === "add") {
      addCreditsToUser(userId, num);
      showToast(`Added +${num} credits to ${userName}`);
    } else {
      setCreditsForUser(userId, num);
      showToast(`Set ${userName}'s credits to ${num}`);
    }
    setCustomCreditInputs((prev) => ({ ...prev, [userId]: "" }));
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    addNewUser(
      newUserEmail,
      newUserName,
      newUserPlan,
      Number(newUserCredits) || 500
    );
    showToast(`User ${newUserEmail} added with ${newUserCredits} credits!`);
    setNewUserEmail("");
    setNewUserName("");
    setNewUserCredits("500");
  };

  const handleCreateSubAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    const clean = subAdminEmail.trim().toLowerCase();
    if (!clean) {
      showToast("Please enter an email for the new Admin");
      return;
    }
    if (clean === SUPER_ADMIN_EMAIL.toLowerCase()) {
      showToast(`${SUPER_ADMIN_EMAIL} is already the Super Admin!`);
      return;
    }
    createOrUpdateSubAdmin(clean, subAdminName, newAdminPerms);
    showToast(`Sub-Admin created/updated for ${clean}!`);
    setSubAdminEmail("");
    setSubAdminName("");
  };

  const handleSwitchLogin = (targetEmail: string, targetName?: string) => {
    const loggedIn = loginWithEmail(targetEmail, targetName);
    if (
      loggedIn.role === "super_admin" ||
      loggedIn.role === "sub_admin"
    ) {
      setMainSection("admin");
      setAdminTab("users");
    } else {
      setMainSection("plans");
    }
    showToast(`Logged in as ${loggedIn.email} (${loggedIn.role.toUpperCase()})`);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 pt-4 space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-900 border border-[#00df81]/40 text-[#00df81] text-xs font-semibold shadow-2xl"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Account Identity Bar */}
      <div className="bg-[#121212] border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base border ${
              isSuperAdmin
                ? "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                : isSubAdmin
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-blue-500/15 text-blue-400 border-blue-500/30"
            }`}
          >
            {isSuperAdmin ? (
              <Crown className="w-5 h-5" />
            ) : isSubAdmin ? (
              <Shield className="w-5 h-5" />
            ) : (
              (user?.name || "U")[0].toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold text-base">
                {matchedManagedUser?.name || user?.name || "User"}
              </span>
              {isSuperAdmin && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40">
                  SUPER ADMIN (FULL CONTROL)
                </span>
              )}
              {isSubAdmin && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  SUB-ADMIN (CUSTOM ACCESS)
                </span>
              )}
              {!hasAdminAccess && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400">
                  USER ({matchedManagedUser?.plan || activePlan})
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-3 flex-wrap">
              <span>
                Email:{" "}
                <strong className="text-zinc-200 font-mono">
                  {user?.email || "Not logged in"}
                </strong>
              </span>
              <span>•</span>
              <span>
                Available Credits:{" "}
                <strong className="text-[#00df81]">
                  {(
                    matchedManagedUser?.credits ??
                    user?.credits ??
                    0
                  ).toLocaleString()}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Mode / Account Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {currentEmail !== SUPER_ADMIN_EMAIL.toLowerCase() && (
            <button
              type="button"
              onClick={() =>
                handleSwitchLogin(SUPER_ADMIN_EMAIL, "Rachit (Super Admin)")
              }
              className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Crown className="w-3.5 h-3.5" />
              Switch to Super Admin ({SUPER_ADMIN_EMAIL})
            </button>
          )}

          {hasAdminAccess && (
            <div className="inline-flex rounded-xl bg-[#0a0a0a] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setMainSection("admin")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  mainSection === "admin"
                    ? "bg-red-500 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Admin Panel
              </button>
              <button
                type="button"
                onClick={() => setMainSection("plans")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mainSection === "plans"
                    ? "bg-white/15 text-white"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Subscription Plans
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          ADMIN PANEL SECTION (ONLY FOR SUPER ADMIN & SUB-ADMINS)
         ===================================================================== */}
      {hasAdminAccess && mainSection === "admin" && (
        <div className="space-y-6">
          {/* Admin Header Banner */}
          <div className="bg-gradient-to-r from-red-500/10 via-[#121212] to-[#121212] border border-red-500/20 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                <Shield className="w-3.5 h-3.5" />
                {isSuperAdmin
                  ? `Super Admin Control Center • ${SUPER_ADMIN_EMAIL}`
                  : `Sub-Admin Panel • Delegated by ${SUPER_ADMIN_EMAIL}`}
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {isSuperAdmin
                  ? "Super Admin Panel — Full System Control"
                  : "Admin Dashboard (Assigned Permissions)"}
              </h1>
              <p className="text-zinc-400 text-xs mt-1">
                {isSuperAdmin
                  ? "Aapke paas har user ka data, credits add/edit karne ka control, usage stats, aur naye Sub-Admins bana kar unke permissions set karne ka poora control hai."
                  : "Aapko Super Admin dwara select kiye gaye sections aur controls dikh rahe hain."}
              </p>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="flex flex-wrap gap-2 bg-[#0a0a0a] p-1.5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setAdminTab("users")}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                  adminTab === "users"
                    ? "bg-zinc-800 text-white border border-white/10"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Users className="w-4 h-4 text-blue-400" />
                Users & Credits
              </button>

              {(isSuperAdmin || myPermissions.viewUsageStats) && (
                <button
                  type="button"
                  onClick={() => setAdminTab("usage")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    adminTab === "usage"
                      ? "bg-zinc-800 text-white border border-white/10"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Activity className="w-4 h-4 text-[#00df81]" />
                  User Usage (&ldquo;Kisne Kitna Use Kiya&rdquo;)
                </button>
              )}

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setAdminTab("admins")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                    adminTab === "admins"
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-red-400" />
                  Manage Admins ({subAdminsList.length + 1})
                </button>
              )}
            </div>
          </div>

          {/* Top Overview Stat Cards (Visible if SuperAdmin or viewTotalUsers/viewUsageStats) */}
          {(isSuperAdmin ||
            myPermissions.viewTotalUsers ||
            myPermissions.viewUsageStats) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(isSuperAdmin || myPermissions.viewTotalUsers) && (
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-semibold uppercase tracking-wider">
                      Total Users
                    </span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white">
                    {totalUsersCount}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {activeUsersCount} Active •{" "}
                    {totalUsersCount - activeUsersCount} Blocked
                  </div>
                </div>
              )}

              {(isSuperAdmin || myPermissions.viewUsageStats) && (
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-semibold uppercase tracking-wider">
                      Total Tool Searches
                    </span>
                    <BarChart3 className="w-4 h-4 text-[#00df81]" />
                  </div>
                  <div className="text-3xl font-extrabold text-white">
                    {totalToolSearches}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Placement: {totalPlacementRuns} • Listicle:{" "}
                    {totalListicleRuns} • Branded: {totalBrandedRuns} • Anchor:{" "}
                    {totalAnchorRuns}
                  </div>
                </div>
              )}

              {(isSuperAdmin || myPermissions.viewUsageStats) && (
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-semibold uppercase tracking-wider">
                      Total Credits Used
                    </span>
                    <Activity className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-white">
                    {totalCreditsUsed.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Across all users & tools
                  </div>
                </div>
              )}

              {(isSuperAdmin || myPermissions.viewTotalUsers) && (
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-semibold uppercase tracking-wider">
                      Available Credits Pool
                    </span>
                    <Coins className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#00df81]">
                    {totalCreditsAvailable.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">
                    {subAdminsList.length + 1} Active Admin(s)
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===============================================================
              TAB 1: USERS & CREDITS CONTROL
             =============================================================== */}
          {adminTab === "users" && (
            <div className="space-y-6">
              {/* Super Admin Add New User Form */}
              {isSuperAdmin && (
                <form
                  onSubmit={handleCreateNewUser}
                  className="bg-[#121212] border border-white/5 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Plus className="w-4 h-4 text-[#00df81]" />
                        Add New User & Give Initial Credits
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Naya user add karein aur apni taraf se initial credits
                        aur plan assign karein.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="User Name (e.g. Rahul)"
                      className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25"
                    />
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="User Email (e.g. rahul@gmail.com)"
                      className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25"
                    />
                    <select
                      value={newUserPlan}
                      onChange={(e) =>
                        setNewUserPlan(
                          e.target.value as "Free" | "Starter" | "Pro"
                        )
                      }
                      className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-white/25"
                    >
                      <option value="Free">Free Plan</option>
                      <option value="Starter">Starter Plan</option>
                      <option value="Pro">Pro Plan</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={newUserCredits}
                      onChange={(e) => setNewUserCredits(e.target.value)}
                      placeholder="Initial Credits (e.g. 500)"
                      className="bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25"
                    />
                    <button
                      type="submit"
                      className="bg-[#00df81] hover:bg-[#00df81]/90 text-black font-bold text-xs rounded-xl px-4 py-2.5 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add User
                    </button>
                  </div>
                </form>
              )}

              {/* Users List Table */}
              {!isSuperAdmin && !myPermissions.viewUserEmails ? (
                <div className="bg-[#121212] border border-white/5 rounded-2xl p-8 text-center space-y-2">
                  <Lock className="w-7 h-7 text-amber-400 mx-auto mb-2" />
                  <div className="text-white font-bold text-sm">
                    Summary-Only Mode Enabled by Super Admin
                  </div>
                  <p className="text-zinc-400 text-xs max-w-md mx-auto">
                    Super Admin ({SUPER_ADMIN_EMAIL}) ne aapke account ke liye
                    sirf Total Users Count ({totalUsersCount} Users) aur Usage
                    Stats dekhne ki permission di hai. Individual user emails
                    hidden hain.
                  </p>
                </div>
              ) : (
                <div className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        All Registered Users ({filteredUsers.length})
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Har user ka data, unka usage, aur credits add/manage
                        karne ka panel
                      </p>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by email or name..."
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0a0a0a] border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          <th className="py-3.5 px-4">User & Email</th>
                          <th className="py-3.5 px-4">Role & Plan</th>
                          <th className="py-3.5 px-4">
                            Usage (Kitna Kya Use Kiya)
                          </th>
                          <th className="py-3.5 px-4">Credits Balance</th>
                          {(isSuperAdmin || myPermissions.addCredits) && (
                            <th className="py-3.5 px-4">
                              Give / Add Credits (Apne Taraf Se)
                            </th>
                          )}
                          {(isSuperAdmin || myPermissions.blockUsers) && (
                            <th className="py-3.5 px-4 text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {filteredUsers.map((u) => {
                          const isOwnerRow =
                            u.email.toLowerCase() ===
                            SUPER_ADMIN_EMAIL.toLowerCase();
                          return (
                            <tr
                              key={u.id}
                              className={`hover:bg-white/[0.02] transition-colors ${
                                u.isBlocked ? "opacity-60 bg-red-950/10" : ""
                              }`}
                            >
                              {/* User & Email */}
                              <td className="py-4 px-4">
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>{u.name}</span>
                                  {u.isBlocked && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold uppercase">
                                      Blocked
                                    </span>
                                  )}
                                </div>
                                <div className="text-zinc-400 font-mono text-[11px] mt-0.5">
                                  {u.email}
                                </div>
                                <div className="text-[10px] text-zinc-600 mt-0.5">
                                  Joined:{" "}
                                  {new Date(u.joinedAt).toLocaleDateString()}
                                </div>
                              </td>

                              {/* Role & Plan */}
                              <td className="py-4 px-4 space-y-1.5">
                                <div>
                                  {isOwnerRow ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">
                                      <Crown className="w-3 h-3" />
                                      SUPER ADMIN
                                    </span>
                                  ) : u.role === "sub_admin" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      <Shield className="w-3 h-3" />
                                      SUB-ADMIN
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400">
                                      USER
                                    </span>
                                  )}
                                </div>
                                <div>
                                  {isSuperAdmin ||
                                  myPermissions.changeUserPlan ? (
                                    <select
                                      value={u.plan}
                                      onChange={(e) => {
                                        updateUserPlan(
                                          u.id,
                                          e.target.value as
                                            | "Free"
                                            | "Starter"
                                            | "Pro"
                                        );
                                        showToast(
                                          `Updated ${u.name}'s plan to ${e.target.value}`
                                        );
                                      }}
                                      className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-zinc-200 focus:outline-none"
                                    >
                                      <option value="Free">Plan: Free</option>
                                      <option value="Starter">
                                        Plan: Starter
                                      </option>
                                      <option value="Pro">Plan: Pro</option>
                                    </select>
                                  ) : (
                                    <span className="text-[11px] text-zinc-400">
                                      Plan: <strong>{u.plan}</strong>
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Usage Summary */}
                              <td className="py-4 px-4">
                                <div className="font-semibold text-zinc-200 mb-1">
                                  Total: {u.usage?.totalSearches || 0} searches{" "}
                                  <span className="text-zinc-500 font-normal">
                                    ({(u.creditsUsed || 0).toLocaleString()} cr
                                    used)
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 text-[10px]">
                                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                    Placement: {u.usage?.findPlacement || 0}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                    Listicle: {u.usage?.listicleFinder || 0}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                    Branded: {u.usage?.brandedAnchor || 0}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                    Anchor: {u.usage?.findAnchor || 0}
                                  </span>
                                </div>
                              </td>

                              {/* Credits Balance */}
                              <td className="py-4 px-4">
                                <div className="text-base font-extrabold text-[#00df81]">
                                  {(u.credits || 0).toLocaleString()}
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  Available Credits
                                </div>
                              </td>

                              {/* Add / Set Credits Control */}
                              {(isSuperAdmin || myPermissions.addCredits) && (
                                <td className="py-4 px-4">
                                  <div className="space-y-2 min-w-[230px]">
                                    <div className="flex items-center gap-1">
                                      {[50, 100, 500, 1000].map((amt) => (
                                        <button
                                          key={amt}
                                          type="button"
                                          onClick={() =>
                                            handleQuickAddCredits(
                                              u.id,
                                              u.name,
                                              amt
                                            )
                                          }
                                          className="px-2 py-1 rounded-md bg-[#00df81]/10 hover:bg-[#00df81]/25 border border-[#00df81]/30 text-[#00df81] text-[10px] font-bold transition-all"
                                        >
                                          +{amt}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        value={customCreditInputs[u.id] || ""}
                                        onChange={(e) =>
                                          setCustomCreditInputs((prev) => ({
                                            ...prev,
                                            [u.id]: e.target.value,
                                          }))
                                        }
                                        placeholder="Custom credits..."
                                        className="w-28 bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#00df81]/50"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCustomCreditAction(
                                            u.id,
                                            u.name,
                                            "add"
                                          )
                                        }
                                        className="px-2.5 py-1 rounded-lg bg-[#00df81] hover:bg-[#00df81]/90 text-black font-bold text-[10px]"
                                      >
                                        + Add
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCustomCreditAction(
                                            u.id,
                                            u.name,
                                            "set"
                                          )
                                        }
                                        className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[10px]"
                                      >
                                        Set
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              )}

                              {/* Actions */}
                              {(isSuperAdmin || myPermissions.blockUsers) && (
                                <td className="py-4 px-4 text-right whitespace-nowrap">
                                  {isOwnerRow ? (
                                    <span className="text-[10px] text-zinc-600 font-semibold">
                                      Owner Protected
                                    </span>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          toggleBlockUser(u.id);
                                          showToast(
                                            `${
                                              u.isBlocked
                                                ? "Unblocked"
                                                : "Blocked"
                                            } ${u.email}`
                                          );
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all inline-flex items-center gap-1 ${
                                          u.isBlocked
                                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                            : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                                        }`}
                                      >
                                        {u.isBlocked ? (
                                          <>
                                            <Unlock className="w-3 h-3" />
                                            Unblock
                                          </>
                                        ) : (
                                          <>
                                            <Ban className="w-3 h-3" />
                                            Block
                                          </>
                                        )}
                                      </button>
                                      {isSuperAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            deleteManagedUser(u.id);
                                            showToast(`Deleted user ${u.email}`);
                                          }}
                                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/25 text-red-400 transition-all"
                                          title="Delete user"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===============================================================
              TAB 2: USER USAGE & ACTIVITY ("KITNE NE KITNA KYA USE KIYA")
             =============================================================== */}
          {adminTab === "usage" &&
            (isSuperAdmin || myPermissions.viewUsageStats) && (
              <div className="space-y-6">
                {/* Per-Tool Usage Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-[#121212] border border-blue-500/20 rounded-2xl p-4">
                    <div className="text-xs text-blue-400 font-bold uppercase">
                      Find Placement
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {totalPlacementRuns} runs
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Across all active users
                    </div>
                  </div>
                  <div className="bg-[#121212] border border-indigo-500/20 rounded-2xl p-4">
                    <div className="text-xs text-indigo-400 font-bold uppercase">
                      Listicle Finder
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {totalListicleRuns} runs
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Across all active users
                    </div>
                  </div>
                  <div className="bg-[#121212] border border-purple-500/20 rounded-2xl p-4">
                    <div className="text-xs text-purple-400 font-bold uppercase">
                      Branded Anchor
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {totalBrandedRuns} runs
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Across all active users
                    </div>
                  </div>
                  <div className="bg-[#121212] border border-emerald-500/20 rounded-2xl p-4">
                    <div className="text-xs text-emerald-400 font-bold uppercase">
                      Find Anchor
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {totalAnchorRuns} runs
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Across all active users
                    </div>
                  </div>
                </div>

                {/* Per-User Tool Usage Table */}
                <div className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/5">
                    <h3 className="text-base font-bold text-white">
                      User-wise Usage Report (Kis User Ne Kitna Kya Use Kiya)
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Har user ke searches aur credits consumption ka complete
                      breakdown
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0a0a0a] border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4">Find Placement</th>
                          <th className="py-3 px-4">Listicle Finder</th>
                          <th className="py-3 px-4">Branded Anchor</th>
                          <th className="py-3 px-4">Find Anchor</th>
                          <th className="py-3 px-4">Total Searches</th>
                          <th className="py-3 px-4">Credits Used</th>
                          <th className="py-3 px-4">Credits Left</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {managedUsers.map((u, idx) => (
                          <tr key={u.id} className="hover:bg-white/[0.02]">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-white">
                                {u.name}
                              </div>
                              {(isSuperAdmin ||
                                myPermissions.viewUserEmails) && (
                                <div className="text-[11px] text-zinc-500 font-mono">
                                  {u.email}
                                </div>
                              )}
                              {!isSuperAdmin &&
                                !myPermissions.viewUserEmails && (
                                  <div className="text-[10px] text-zinc-600">
                                    User #{idx + 1}
                                  </div>
                                )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-blue-300">
                              {u.usage?.findPlacement || 0}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-indigo-300">
                              {u.usage?.listicleFinder || 0}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-purple-300">
                              {u.usage?.brandedAnchor || 0}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-emerald-300">
                              {u.usage?.findAnchor || 0}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-white">
                              {u.usage?.totalSearches || 0}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-amber-400">
                              {(u.creditsUsed || 0).toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#00df81]">
                              {(u.credits || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Live Activity Log */}
                <div className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-white/5">
                    <h3 className="text-base font-bold text-white">
                      Recent Search & Activity Logs
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Real-time history of tool scans across the platform
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0a0a0a] border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4">Tool Used</th>
                          <th className="py-3 px-4">Target Website / Domain</th>
                          <th className="py-3 px-4">Credits Spent</th>
                          <th className="py-3 px-4">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {usageLogs.slice(0, 30).map((log) => (
                          <tr key={log.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">
                                {log.userName}
                              </div>
                              {(isSuperAdmin ||
                                myPermissions.viewUserEmails) && (
                                <div className="text-[11px] text-zinc-500 font-mono">
                                  {log.userEmail}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-200 text-[11px] font-medium">
                                {log.tool}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-indigo-300">
                              {log.targetDomain}
                            </td>
                            <td className="py-3 px-4 text-amber-400 font-semibold">
                              -{log.creditsSpent} cr
                            </td>
                            <td className="py-3 px-4 text-zinc-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          {/* ===============================================================
              TAB 3: MANAGE ADMINS & PERMISSIONS (SUPER ADMIN ONLY)
             =============================================================== */}
          {adminTab === "admins" && isSuperAdmin && (
            <div className="space-y-6">
              {/* Create Sub-Admin Card */}
              <form
                onSubmit={handleCreateSubAdmin}
                className="bg-[#121212] border border-red-500/25 rounded-2xl p-6 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-red-400" />
                      Naya Admin (Sub-Admin) Banayein & Permissions Select Karein
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Jis email ko aap yahan add karenge, uske Settings me Admin
                      Panel khul jayega — aur usko sirf wahi dikhega aur wahi
                      control milega jo aap neeche tick karenge.
                    </p>
                  </div>

                  {/* Quick Permission Presets */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setNewAdminPerms({
                          viewTotalUsers: true,
                          viewUsageStats: true,
                          viewUserEmails: true,
                          addCredits: false,
                          changeUserPlan: false,
                          blockUsers: false,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[11px] font-semibold"
                    >
                      Preset: Sirf Users & Usage Dekhe
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewAdminPerms({
                          viewTotalUsers: true,
                          viewUsageStats: true,
                          viewUserEmails: true,
                          addCredits: true,
                          changeUserPlan: false,
                          blockUsers: false,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold"
                    >
                      Preset: View + Add Credits
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAdminPerms(FULL_ADMIN_PERMISSIONS)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[11px] font-semibold"
                    >
                      Preset: All Controls
                    </button>
                  </div>
                </div>

                {/* Email & Name Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      New Admin Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={subAdminEmail}
                      onChange={(e) => setSubAdminEmail(e.target.value)}
                      placeholder="e.g. partner@gmail.com"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Admin Name
                    </label>
                    <input
                      type="text"
                      value={subAdminName}
                      onChange={(e) => setSubAdminName(e.target.value)}
                      placeholder="e.g. Team Manager"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40"
                    />
                  </div>
                </div>

                {/* Permission Checkboxes */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                    Select Permissions (Jo-Jo Aap Select Karenge Wahi Control
                    Uske Paas Hoga):
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PERMISSION_LABELS.map((item) => {
                      const checked = newAdminPerms[item.key];
                      return (
                        <label
                          key={item.key}
                          className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                            checked
                              ? "bg-[#00df81]/10 border-[#00df81]/40"
                              : "bg-[#0a0a0a] border-white/5 hover:border-white/15"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setNewAdminPerms((prev) => ({
                                ...prev,
                                [item.key]: e.target.checked,
                              }))
                            }
                            className="mt-0.5 rounded border-zinc-700 text-[#00df81] focus:ring-0"
                          />
                          <div>
                            <div className="text-xs font-bold text-white">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {item.subtitle}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-red-500 hover:bg-red-500/90 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg"
                >
                  <UserPlus className="w-4 h-4" />
                  Create / Save Sub-Admin with Selected Permissions
                </button>
              </form>

              {/* Existing Admins List & Live Permission Editor */}
              <div className="bg-[#121212] border border-white/5 rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Active Admins & Permission Controls
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Kisi bhi Sub-Admin ke permissions live on/off karein ya
                    &ldquo;Preview as this Admin&rdquo; daba kar check karein ki
                    unko kaisa dikhega.
                  </p>
                </div>

                {/* Super Admin Card */}
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Rachit (You)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500 text-white">
                          SUPER ADMIN (OWNER)
                        </span>
                      </div>
                      <div className="text-xs text-red-200 font-mono">
                        {SUPER_ADMIN_EMAIL}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-red-300 font-semibold">
                    All Permissions Permanently Enabled
                  </div>
                </div>

                {/* Sub-Admins List */}
                {subAdminsList.length === 0 ? (
                  <div className="text-center py-8 bg-[#0a0a0a] rounded-xl border border-white/5 text-zinc-500 text-xs">
                    Abhi koi Sub-Admin nahi hai. Upar form se naya Sub-Admin
                    banayein.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {subAdminsList.map((adm) => {
                      const perms =
                        adm.permissions || DEFAULT_SUB_ADMIN_PERMISSIONS;
                      return (
                        <div
                          key={adm.id}
                          className="p-5 rounded-xl bg-[#0a0a0a] border border-white/10 space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-white flex items-center gap-2">
                                <span>{adm.name}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  SUB-ADMIN
                                </span>
                              </div>
                              <div className="text-xs text-zinc-400 font-mono">
                                {adm.email}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleSwitchLogin(adm.email, adm.name)
                                }
                                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Preview as {adm.name}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  removeSubAdminRole(adm.id);
                                  showToast(
                                    `Removed Admin access from ${adm.email}`
                                  );
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Remove Admin
                              </button>
                            </div>
                          </div>

                          {/* Live Toggle Switches for this Sub-Admin */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-white/5">
                            {PERMISSION_LABELS.map((pItem) => {
                              const isOn = Boolean(perms[pItem.key]);
                              return (
                                <button
                                  key={pItem.key}
                                  type="button"
                                  onClick={() => {
                                    const updated = {
                                      ...perms,
                                      [pItem.key]: !isOn,
                                    };
                                    updateSubAdminPermissions(adm.id, updated);
                                    showToast(
                                      `Updated ${pItem.title} for ${adm.email}`
                                    );
                                  }}
                                  className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 ${
                                    isOn
                                      ? "bg-[#00df81]/10 border-[#00df81]/30 text-white"
                                      : "bg-zinc-900/60 border-white/5 text-zinc-500"
                                  }`}
                                >
                                  <span className="text-[11px] font-semibold">
                                    {pItem.title}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                      isOn
                                        ? "bg-[#00df81] text-black"
                                        : "bg-zinc-800 text-zinc-500"
                                    }`}
                                  >
                                    {isOn ? "ON" : "OFF"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUBSCRIPTION PLANS SECTION (VISIBLE TO ALL USERS OR VIA TAB)
         ===================================================================== */}
      {(!hasAdminAccess || mainSection === "plans") && (
        <div>
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              Manage Your Plan
            </h1>
            <p className="text-zinc-400 text-sm">
              Choose the best plan that fits your link building needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-6 rounded-[2rem] border ${
                  plan.isPopular
                    ? "bg-zinc-900/80 border-primary/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]"
                    : "bg-[#121212] border-white/5 hover:border-white/10"
                } transition-all`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-primary to-pink-500 rounded-full text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">
                    {plan.name}
                  </h3>
                  <div className="text-3xl font-bold text-white tracking-tight mb-2">
                    {plan.price}{" "}
                    <span className="text-sm font-normal text-zinc-500">
                      /mo
                    </span>
                  </div>
                  <div className="text-sm font-medium text-primary">
                    {plan.tokens}
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-sm text-zinc-300"
                    >
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setActivePlan(plan.name);
                    if (matchedManagedUser) {
                      updateUserPlan(
                        matchedManagedUser.id,
                        plan.name as "Free" | "Starter" | "Pro"
                      );
                    }
                    showToast(`Switched plan to ${plan.name}`);
                  }}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    activePlan === plan.name
                      ? "bg-white/5 text-white border border-white/10 cursor-default"
                      : plan.isPopular
                      ? "bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {activePlan === plan.name ? "Current Plan" : "Select Plan"}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Account Switcher Bar at Bottom (For Easy Testing of Super Admin vs Sub-Admin vs Normal User) */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-zinc-400" />
            Quick Login / Test Any Account Role
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Apni Super Admin ID ({SUPER_ADMIN_EMAIL}), kisi Sub-Admin, ya normal
            user se turant switch kar ke check karein.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              handleSwitchLogin(SUPER_ADMIN_EMAIL, "Rachit (Super Admin)")
            }
            className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold"
          >
            Super Admin ({SUPER_ADMIN_EMAIL})
          </button>
          {subAdminsList.map((sa) => (
            <button
              key={sa.id}
              type="button"
              onClick={() => handleSwitchLogin(sa.email, sa.name)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold"
            >
              Sub-Admin ({sa.email})
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              type="email"
              value={switchEmailInput}
              onChange={(e) => setSwitchEmailInput(e.target.value)}
              placeholder="Any email to login..."
              className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (switchEmailInput.trim()) {
                  handleSwitchLogin(switchEmailInput.trim());
                  setSwitchEmailInput("");
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
