"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, Gift, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import axios from 'axios';

const plans = [
  {
    name: 'Free',
    price: '$0',
    tokens: '5,000 Tokens/mo',
    features: ['Normal Anchor Search', 'Up to 5 searches per day', 'Standard support'],
    isPopular: false,
  },
  {
    name: 'Starter',
    price: '$49',
    tokens: '50,000 Tokens/mo',
    features: ['Branded Anchor Search', 'Unlimited searches', 'Priority support', 'Export to CSV'],
    isPopular: true,
  },
  {
    name: 'Pro',
    price: '$99',
    tokens: '200,000 Tokens/mo',
    features: ['Everything in Starter', 'API Access', 'Bulk Processing', 'Dedicated Account Manager'],
    isPopular: false,
  }
];

export default function SettingsPage() {
  const { activePlan, setActivePlan, user, setUser } = useAppStore();
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleRedeem = async () => {
    if (!promoCode.trim() || !user?.token) return;
    
    try {
      setRedeeming(true);
      setMessage(null);
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/credits/redeem`, 
        { code: promoCode },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      
      // Update local store with new token balance
      setUser({ ...user, tokens: res.data.newBalance });
      setMessage({ text: `Successfully redeemed ${res.data.creditsAdded} credits!`, type: 'success' });
      setPromoCode("");
    } catch (error: any) {
      setMessage({ 
        text: error.response?.data?.error || "Failed to redeem promo code.", 
        type: 'error' 
      });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 pt-8 px-8">
      
      {/* Promo Code Section */}
      <div className="mb-12 bg-[#0d0d0f] rounded-2xl border border-white/5 p-8 relative overflow-hidden group">
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" />
              Redeem Promo Code
            </h2>
            <p className="text-zinc-400 text-sm mb-4">
              Have a special code? Enter it below to instantly add free tokens to your account. 
              Current Balance: <strong className="text-white font-mono">{user?.tokens?.toLocaleString() || 0}</strong>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="e.g. LINK2024"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-primary/50 uppercase"
              />
              <button
                onClick={handleRedeem}
                disabled={redeeming || !promoCode}
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center min-w-[120px]"
              >
                {redeeming ? <Loader2 className="w-5 h-5 animate-spin" /> : "Redeem"}
              </button>
            </div>
            
            {message && (
              <p className={`mt-3 text-sm font-medium ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Manage Your Plan</h1>
        <p className="text-zinc-400 text-sm">Choose the best plan that fits your link building needs.</p>
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
                ? 'bg-zinc-900/80 border-primary/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]' 
                : 'bg-[#121212] border-white/5 hover:border-white/10'
            } transition-all`}
          >
            {plan.isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-primary to-pink-500 rounded-full text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
                Most Popular
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
              <div className="text-3xl font-bold text-white tracking-tight mb-2">
                {plan.price} <span className="text-sm font-normal text-zinc-500">/mo</span>
              </div>
              <div className="text-sm font-medium text-primary">{plan.tokens}</div>
            </div>

            <div className="space-y-4 mb-8">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm text-zinc-300">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setActivePlan(plan.name)}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activePlan === plan.name
                  ? 'bg-white/5 text-white border border-white/10 cursor-default'
                  : plan.isPopular
                    ? 'bg-primary text-white hover:bg-primary/90 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {activePlan === plan.name ? 'Current Plan' : 'Select Plan'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
