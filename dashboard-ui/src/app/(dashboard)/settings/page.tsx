"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

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
  const { activePlan, setActivePlan } = useAppStore();

  return (
    <div className="max-w-5xl mx-auto pb-20 pt-8">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Manage Your Plan</h1>
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
