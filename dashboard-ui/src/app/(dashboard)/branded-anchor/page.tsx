"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as LinkIcon, FileText, Anchor, Sparkles, Globe, CheckCircle2, Circle } from 'lucide-react';

const LOADING_STEPS = [
  "Generating semantic keywords...",
  "Searching for the best article on this domain...",
  "Fetching article content...",
  "Scanning paragraphs for relevance...",
  "AI finding the best anchor placement...",
  "Preparing your results..."
];

export default function BrandedAnchorPage() {
  const [activeTab, setActiveTab] = useState('single');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // Demo loading effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSearching) {
      setLoadingStep(0);
      let step = 0;
      timer = setInterval(() => {
        step++;
        if (step >= LOADING_STEPS.length) {
          clearInterval(timer);
          setTimeout(() => {
            setIsSearching(false);
            alert("Demo complete: Found 2 Branded Placements!");
          }, 1000);
        } else {
          setLoadingStep(step);
        }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [isSearching]);

  const handleSearch = () => {
    setIsSearching(true);
  };

  const tabs = [
    { id: 'single', label: 'Single URL' },
    { id: 'bulk', label: 'Bulk CSV' }
  ];

  return (
    <motion.div 
      className="max-w-2xl mx-auto pt-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Find Branded Anchor
        </h1>
        <p className="text-zinc-500 text-sm">
          Analyze thousands of pages to naturally place your brand name based on contextual relevance.
        </p>
      </div>

      <motion.div 
        className="bg-[#121212] border border-white/5 rounded-xl p-8 transition-colors hover:border-white/10"
        layout
      >
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-4"
            >
              <div className="space-y-6">
                {LOADING_STEPS.map((stepText, idx) => {
                  const isActive = idx === loadingStep;
                  const isDone = idx < loadingStep;

                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`flex items-center gap-4 text-sm font-medium transition-colors duration-300 ${
                        (isActive || isDone) ? 'text-[#00df81]' : 'text-zinc-600'
                      }`}
                    >
                      <div className="shrink-0 relative">
                        {(isDone || isActive) ? (
                          <div className="relative">
                            <CheckCircle2 className={`w-5 h-5 ${(isActive || isDone) ? 'text-[#00df81]' : ''}`} />
                            {isActive && (
                              <div className="absolute inset-0 rounded-full bg-[#00df81]/20 blur-[4px] animate-pulse" />
                            )}
                          </div>
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </div>
                      <span className={isActive ? 'animate-pulse' : ''}>{stepText}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="single"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Target Domain</label>
                <div className="relative flex items-center">
                  <Globe className="absolute left-3 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="e.g. example.com" 
                    className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Branded Anchor Text</label>
                  <div className="relative flex items-center">
                    <Anchor className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="e.g. HubSpot" 
                      className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Destination URL</label>
                  <div className="relative flex items-center">
                    <LinkIcon className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="https://..." 
                      className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Alternate Branded Anchor <span className="lowercase text-zinc-600 font-normal">(optional)</span></label>
                <div className="relative flex items-center">
                  <FileText className="absolute left-3 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="e.g. HubSpot CRM" 
                    className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleSearch}
                  className="w-full py-3 rounded-lg bg-zinc-100 hover:bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Find Branded Placement
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
