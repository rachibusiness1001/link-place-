"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Ticket, Activity, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { useAppStore } from '@/store/useAppStore';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSearches: 0,
    creditsDistributed: 0,
    recentUsers: []
  });

  const { user } = useAppStore();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!user?.token) return;
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setStats(res.data);
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      }
    };
    
    if (user?.token) {
      fetchStats();
    }
  }, [user]);

  const cards = [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { title: 'Total Searches', value: stats.totalSearches.toLocaleString(), icon: Search, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { title: 'Credits Distributed', value: stats.creditsDistributed.toLocaleString(), icon: Ticket, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { title: 'System Status', value: 'Healthy', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-zinc-400">Overview of LinkPlace platform metrics and activity.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-6 rounded-2xl bg-[#0d0d0f] border ${card.border} relative overflow-hidden group`}
          >
            <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${card.bg} blur-2xl opacity-50 group-hover:opacity-100 transition-opacity`} />
            
            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-sm font-medium text-zinc-400 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-white">{card.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </div>
            
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-500 font-medium relative z-10">
              <TrendingUp className="w-3 h-3" />
              <span>+12% from last week</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Users Table */}
      <div className="bg-[#0d0d0f] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-400" />
            Recent Signups
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-white/[0.02] text-xs uppercase font-semibold text-zinc-500">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Joined At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stats.recentUsers.map((user: any, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{user.name}</div>
                    <div className="text-xs">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user.plan === 'pro' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      user.plan === 'starter' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                    }`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {stats.recentUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                    No recent users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
