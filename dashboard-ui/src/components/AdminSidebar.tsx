"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Ticket,
  ListOrdered,
  Settings,
  LogOut,
  Info
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function AdminSidebar() {
  const pathname = usePathname();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleSoonClick = () => setToastMessage("Coming soon");

  const mainMenu = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Promo Codes', href: '/admin/promo-codes', icon: Ticket },
    { name: 'Search Logs', href: '/admin/search-logs', icon: ListOrdered },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-[#0d0d0f] border-r border-white/5 flex flex-col z-50 text-zinc-400">
      {/* Logo Area */}
      <div className="h-16 px-6 flex items-center gap-3 shrink-0 border-b border-transparent">
        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.6)]">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
        <span className="font-bold text-lg tracking-tight text-white">linkplace<span className="text-red-500 text-xs ml-1 bg-red-500/10 px-1 py-0.5 rounded">ADMIN</span></span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 custom-scrollbar relative">
        <div className="mb-6">
          <div className="text-[10px] font-bold text-zinc-500/80 uppercase tracking-[0.15em] mb-2 px-6">Admin Panel</div>
          <nav className="space-y-0.5 px-3">
            {mainMenu.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.name} href={item.href} className="block relative">
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-red-500/10 rounded-lg border border-red-500/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                  <div className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${isActive ? 'text-white' : 'hover:bg-white/5 hover:text-white'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'opacity-70'}`} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Profile Area */}
      <div className="p-4 border-t border-white/5 space-y-2 relative shrink-0">
        <Link href="/dashboard" className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors mb-4 border border-white/5">
          Return to User App
        </Link>
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="w-8 h-8 rounded-full bg-red-900/50 text-red-500 flex items-center justify-center font-bold text-xs border border-red-500/20">
            A
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-semibold text-white truncate">Admin User</div>
            <div className="text-[9px] font-bold tracking-wider text-red-500">SUPER ADMIN</div>
          </div>
        </div>

        <Link href="/login" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </Link>
      </div>
    </aside>
  );
}
