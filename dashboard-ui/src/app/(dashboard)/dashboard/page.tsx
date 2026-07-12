"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/useAppStore';
import { RefreshCcw, Mail, Zap, Sparkles, MoveRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { activePlan, stats } = useAppStore();
  const [timeframe, setTimeframe] = useState<'30 days' | '7 days' | '24 hours'>('7 days');

  return (
    <div className="max-w-6xl mx-auto pb-20">
      
      {/* Header Section */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome back, Harsh Dhameja</h1>
          <p className="text-zinc-400 text-sm">Measure your placement performance, exports, and token usage for this week.</p>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 rounded-lg bg-[#121212] border border-white/5 hover:border-white/10 hover:bg-[#1a1a1a] transition-all text-zinc-400">
            <RefreshCcw className="w-4 h-4" />
          </button>
          <div className="flex bg-[#121212] border border-white/5 rounded-lg p-1">
            {['30 days', '7 days', '24 hours'].map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t as any)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeframe === t 
                    ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/5' 
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Placements Found', value: '1,075' },
          { label: 'Exported CSVs', value: '41.8%' },
          { label: 'AI Tokens Used', value: '30.5%' },
          { label: 'Active Projects', value: '0' },
        ].map((metric, i) => (
          <div key={i} className="bg-[#121212] border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors">
            <div className="text-3xl font-bold text-white mb-2 tracking-tight">{metric.value}</div>
            <div className="text-sm text-zinc-500 font-medium">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Secondary Action Cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        
        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 flex flex-col hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#e83e8c] uppercase">Tool Status</span>
            <Mail className="w-4 h-4 text-[#e83e8c]" />
          </div>
          <h3 className="text-white font-bold mb-2">Find your next placement</h3>
          <p className="text-zinc-500 text-sm mb-6 flex-1">
            You have tokens ready to be used. Start finding high quality contextual links for your URLs.
          </p>
          <Link href="/tool" className="text-[#e83e8c] text-sm font-semibold flex items-center gap-2 hover:gap-3 transition-all self-end">
            Go to Finder <MoveRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 flex flex-col hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#fd7e14] uppercase">Workspace</span>
            <Sparkles className="w-4 h-4 text-[#fd7e14]" />
          </div>
          <h3 className="text-white font-bold mb-2">SaaS Plan Level</h3>
          <p className="text-zinc-500 text-sm mb-6 flex-1">
            Active plan: <strong className="text-white">FREE</strong>. Enjoy limited searches with basic AI models.
          </p>
          <button className="text-[#3b82f6] text-sm font-semibold flex items-center gap-2 hover:gap-3 transition-all self-end">
            Manage Billing <MoveRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-[#121212] border border-white/5 rounded-xl p-6 flex flex-col hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-[0.15em] text-[#20c997] uppercase">AI Suggestion</span>
            <Zap className="w-4 h-4 text-[#20c997]" />
          </div>
          <h3 className="text-white font-bold mb-2">Try Branded Anchors</h3>
          <p className="text-zinc-500 text-sm mb-6 flex-1">
            Use the branded anchor mode to naturally integrate your brand name into articles that match your target URL's topic.
          </p>
          <Link href="/branded-anchor" className="text-[#20c997] text-sm font-semibold flex items-center gap-2 hover:gap-3 transition-all self-end">
            Branded Anchor <MoveRight className="w-4 h-4" />
          </Link>
        </div>

      </div>

      {/* List View */}
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Recent Placements Activity</h2>
        <p className="text-zinc-500 text-sm mb-4">The most recent successful link placements found by the AI.</p>
        
        <div className="bg-[#121212] border border-white/5 rounded-xl divide-y divide-white/5">
          {[
            { target: 'invoice-tools.com', email: 'connect@wbcomdesigns.com', campaign: 'LINK exchange outreach 02-07-26', status: 'PENDING' },
            { target: 'saas-metrics.io', email: 'sales@paylinedata.com', campaign: 'LINK exchange outreach 02-07-26', status: 'PENDING' },
          ].map((item, i) => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#1a1a2e] border border-[#2a2a4e] flex items-center justify-center text-[#5c5c99] font-bold text-sm">
                  {item.target.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-medium text-sm group-hover:text-blue-400 transition-colors">{item.target}</div>
                  <div className="text-zinc-500 text-xs">{item.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-zinc-500 text-xs text-right">
                  Campaign: <span className="text-zinc-300 font-medium">{item.campaign}</span>
                </div>
                <div className="px-2 py-1 rounded border border-[#fd7e14]/20 bg-[#fd7e14]/10 text-[#fd7e14] text-[10px] font-bold uppercase tracking-wider">
                  {item.status}
                </div>
              </div>
            </div>
          ))}
          {/* Empty state for demonstration */}
          <div className="p-8 text-center text-zinc-500 text-sm">
            End of activity log
          </div>
        </div>
      </div>
      
    </div>
  );
}
