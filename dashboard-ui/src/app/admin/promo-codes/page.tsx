"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ticket, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import axios from 'axios';

interface PromoCode {
  _id: string;
  code: string;
  creditAmount: number;
  isActive: boolean;
  usedCount: number;
  createdAt: string;
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [creditAmount, setCreditAmount] = useState(100);
  const { user } = useAppStore();

  useEffect(() => {
    fetchCodes();
  }, [user]);

  const fetchCodes = async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/promos`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      setCodes(res.data.promoCodes);
    } catch (error) {
      console.error("Failed to fetch promo codes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user?.token) return;
    try {
      setGenerating(true);
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/promos`, { creditAmount }, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      await fetchCodes();
    } catch (error) {
      console.error("Failed to generate promo code:", error);
      alert("Failed to generate code.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Promo Codes</h1>
          <p className="text-zinc-400">Generate and manage credit promo codes.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-[#0d0d0f] p-2 rounded-xl border border-white/5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">Credits:</span>
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(Number(e.target.value))}
              className="bg-white/[0.02] border border-white/10 rounded-lg pl-16 pr-4 py-2 w-32 text-white focus:outline-none focus:border-red-500/50"
            />
          </div>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg font-medium transition-colors"
          >
            {generating ? <Clock className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate Code
          </button>
        </div>
      </div>

      <div className="bg-[#0d0d0f] rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="bg-white/[0.02] text-xs uppercase font-semibold text-zinc-500 border-b border-white/5">
            <tr>
              <th className="px-6 py-4">Promo Code</th>
              <th className="px-6 py-4">Credit Value</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Uses</th>
              <th className="px-6 py-4">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center">Loading codes...</td></tr>
            ) : codes.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No promo codes found. Generate one above.</td></tr>
            ) : (
              codes.map((code) => (
                <tr key={code._id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono font-bold text-white tracking-wider bg-white/5 px-3 py-1.5 rounded border border-white/10">
                      {code.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-emerald-400">
                    +{code.creditAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {code.isActive ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full w-fit border border-green-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-500/10 px-2.5 py-1 rounded-full w-fit border border-red-500/20">
                        <Trash2 className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-300">
                    {code.usedCount}
                  </td>
                  <td className="px-6 py-4">
                    {new Date(code.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
