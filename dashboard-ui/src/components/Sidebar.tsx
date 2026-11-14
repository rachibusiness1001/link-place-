"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Search,
  Anchor,
  FileText,
  Link as LinkIcon,
  Settings,
  LogOut,
  Info,
  ChevronRight,
  BookMarked,
  ListChecks,
  Shield,
} from "lucide-react";
import { useAppStore, SUPER_ADMIN_EMAIL } from "@/store/useAppStore";

export default function Sidebar() {
  const pathname = usePathname();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { stats, activePlan, user, managedUsers } = useAppStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (pathname === "/") return null;

  const handleSoonClick = () =>
    setToastMessage("Coming soon with high quality saas sites");

  const currentEmail = (user?.email || "").toLowerCase();
  const matchedUser = managedUsers.find(
    (u) => u.email.toLowerCase() === currentEmail
  );

  const isSuperAdmin =
    currentEmail === SUPER_ADMIN_EMAIL.toLowerCase() ||
    user?.role === "super_admin" ||
    matchedUser?.role === "super_admin";

  const isSubAdmin =
    !isSuperAdmin &&
    (user?.role === "sub_admin" ||
      user?.role === "admin" ||
      matchedUser?.role === "sub_admin");

  const hasAdminAccess = isSuperAdmin || isSubAdmin;
  const displayCredits =
    matchedUser?.credits ?? user?.credits ?? stats.totalMonthlyTokens;
  const displayPlan = matchedUser?.plan || activePlan;
  const displayName = matchedUser?.name || user?.name || "Rachit";
  const displayEmail = user?.email || SUPER_ADMIN_EMAIL;

  const mainMenu = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Find Placement", href: "/tool", icon: Search },
    { name: "Listicle Finder", href: "/listicle-finder", icon: ListChecks },
    { name: "Branded Anchor", href: "/branded-anchor", icon: Anchor },
    { name: "Find Anchor", href: "/find-anchor", icon: LinkIcon },
    { name: "All Projects", href: "/manage-placements", icon: BookMarked },
    { name: "Bulk Placements", href: "#", icon: FileText, comingSoon: true },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#0d0d0f] border-r border-white/5 flex flex-col z-50 text-zinc-400">
      {/* Logo Area */}
      <div className="h-16 px-6 flex items-center gap-3 shrink-0 border-b border-transparent">
        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.6)]">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <span className="font-bold text-lg tracking-tight text-white">
          linkplace
        </span>
      </div>

      {/* Top Status Tabs */}
      <div className="flex border-b border-white/5 text-[11px] font-medium tracking-wide">
        <div className="flex-1 py-3 px-3 text-center border-r border-white/5 hover:text-white transition-colors cursor-default">
          Credits: {displayCredits.toLocaleString()}
        </div>
        <div className="flex-1 py-3 px-3 text-center hover:text-white transition-colors cursor-default">
          Plan: {displayPlan}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar relative">
        {/* Main Menu */}
        <div className="mb-6">
          <div className="text-[10px] font-bold text-zinc-500/80 uppercase tracking-[0.15em] mb-2 px-6">
            Main Menu
          </div>
          <nav className="space-y-0.5 px-3">
            {mainMenu.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (item.comingSoon) {
                return (
                  <button
                    key={item.name}
                    onClick={handleSoonClick}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                      <span>{item.name}</span>
                    </div>
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 group-hover:text-zinc-300">
                      SOON
                    </div>
                  </button>
                );
              }

              return (
                <Link key={item.name} href={item.href} className="block relative">
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-[#1e1b38] rounded-lg border border-[#3b327b]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 35,
                      }}
                    />
                  )}
                  <div
                    className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      isActive
                        ? "text-white"
                        : "hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-blue-400" : "opacity-70"
                      }`}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Resources Menu */}
        <div>
          <div className="text-[10px] font-bold text-zinc-500/80 uppercase tracking-[0.15em] mb-2 px-6 flex items-center justify-between">
            Resources <ChevronRight className="w-3 h-3" />
          </div>
          <nav className="space-y-0.5 px-3">
            <Link
              href="/settings"
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors group ${
                pathname === "/settings"
                  ? "bg-[#1e1b38] border border-[#3b327b] text-white"
                  : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                {hasAdminAccess ? (
                  <Shield className="w-4 h-4 text-red-400" />
                ) : (
                  <Settings className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                )}
                <span>
                  {hasAdminAccess ? "Settings & Admin" : "Manage Subscription"}
                </span>
              </div>
              {hasAdminAccess && (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  {isSuperAdmin ? "SUPER" : "ADMIN"}
                </span>
              )}
            </Link>

            <button
              onClick={handleSoonClick}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span>Blog</span>
              </div>
              <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 group-hover:text-zinc-300">
                SOON
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Bottom Profile Area */}
      <div className="p-4 border-t border-white/5 space-y-2 relative shrink-0">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-2.5 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shrink-0 ${
              isSuperAdmin
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : isSubAdmin
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                : "bg-zinc-800 text-white border-white/10"
            }`}
          >
            {displayName[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-semibold text-white truncate">
              {displayName}
            </div>
            <div className="text-[10px] text-zinc-400 truncate font-mono">
              {displayEmail}
            </div>
            <div
              className={`text-[9px] font-extrabold tracking-wider mt-0.5 ${
                isSuperAdmin
                  ? "text-red-400"
                  : isSubAdmin
                  ? "text-amber-400"
                  : "text-zinc-500"
              }`}
            >
              {isSuperAdmin
                ? "SUPER ADMIN"
                : isSubAdmin
                ? "SUB-ADMIN"
                : "USER"}
            </div>
          </div>
        </Link>

        <Link
          href="/login"
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Switch Account / Logout</span>
        </Link>

        {/* Custom Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 10, scale: 0.95, filter: "blur(4px)" }}
              className="absolute bottom-[110%] left-4 right-4 bg-zinc-900/90 backdrop-blur-xl border border-primary/40 p-4 rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex items-start gap-3 z-50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 relative" />
              <p className="text-xs font-medium text-zinc-100 relative pt-0.5 leading-snug tracking-wide">
                {toastMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
