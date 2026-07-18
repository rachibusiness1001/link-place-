"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Search, 
  Anchor,
  FileText,
  Link as LinkIcon,
  Globe,
  Settings,
  LogOut,
  Info,
  ChevronRight,
  BookMarked
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function Sidebar() {
  const pathname = usePathname();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { stats, activePlan } = useAppStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (pathname === '/') return null;

  const handleSoonClick = () => setToastMessage("Coming soon with high quality saas sites");

  const mainMenu = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Find Placement', href: '/tool', icon: Search },
    { name: 'Branded Anchor', href: '/branded-anchor', icon: Anchor },
    { name: 'Find Anchor', href: '/find-anchor', icon: LinkIcon },
    { name: 'All Projects', href: '/manage-placements', icon: BookMarked },
    { name: 'Bulk Placements', href: '#', icon: FileText, comingSoon: true },
  ];

  const { projects } = useAppStore();

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#0d0d0f] border-r border-white/5 flex flex-col z-50 text-zinc-400">
      {/* Logo Area */}
      <div className="h-16 px-6 flex items-center gap-3 shrink-0 border-b border-transparent">
        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.6)]">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <span className="font-bold text-lg tracking-tight text-white">linkplace</span>
      </div>

      {/* Top Status Tabs */}
      <div className="flex border-b border-white/5 text-[11px] font-medium tracking-wide">
        <div className="flex-1 py-3 px-4 text-center border-r border-white/5 hover:text-white transition-colors cursor-default">
          Tokens: {(stats.totalMonthlyTokens / 1000).toFixed(0)}k
        </div>
        <div className="flex-1 py-3 px-4 text-center hover:text-white transition-colors cursor-default">
          Plan: {activePlan}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar relative">
        
        {/* Main Menu */}
        <div className="mb-6">
          <div className="text-[10px] font-bold text-zinc-500/80 uppercase tracking-[0.15em] mb-2 px-6">Main Menu</div>
          <nav className="space-y-0.5 px-3">
            {mainMenu.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              if (item.comingSoon) {
                return (
                  <button key={item.name} onClick={handleSoonClick} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                      <span>{item.name}</span>
                    </div>
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 group-hover:text-zinc-300">SOON</div>
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
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${isActive ? 'text-white' : 'hover:bg-white/5 hover:text-white'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'opacity-70'}`} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Removed Projects Menu as per user request */}

        {/* Resources Menu */}
        <div>
          <div className="text-[10px] font-bold text-zinc-500/80 uppercase tracking-[0.15em] mb-2 px-6 flex items-center justify-between">
            Resources <ChevronRight className="w-3 h-3" />
          </div>
          <nav className="space-y-0.5 px-3">
            <Link href="/settings" className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 hover:text-white transition-colors group">
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span>Manage Subscription</span>
              </div>
            </Link>
            
            <button onClick={handleSoonClick} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors group">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span>Blog</span>
              </div>
              <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 group-hover:text-zinc-300">SOON</div>
            </button>
          </nav>
        </div>
      </div>

      {/* Bottom Profile Area */}
      <div className="p-4 border-t border-white/5 space-y-2 relative shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="w-8 h-8 rounded-full bg-zinc-800 text-white flex items-center justify-center font-bold text-xs border border-white/10">
            H
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-semibold text-white truncate">Harsh Dhameja</div>
            <div className="text-[9px] font-bold tracking-wider text-zinc-500">OWNER</div>
          </div>
        </div>

        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>

        {/* Custom Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 15, scale: 0.95, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 10, scale: 0.95, filter: 'blur(4px)' }}
              className="absolute bottom-[110%] left-4 right-4 bg-zinc-900/90 backdrop-blur-xl border border-primary/40 p-4 rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex items-start gap-3 z-50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 relative" />
              <p className="text-xs font-medium text-zinc-100 relative pt-0.5 leading-snug tracking-wide">{toastMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
