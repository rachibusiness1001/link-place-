"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as LinkIcon, FileText, Anchor, Sparkles, Globe, CheckCircle2, Circle, AlertCircle, Download } from 'lucide-react';

const LOADING_STEPS = [
  "Generating semantic keywords...",
  "Searching for the best article on this domain...",
  "Fetching article content...",
  "Scanning paragraphs for relevance...",
  "AI finding the best anchor placement...",
  "Preparing your results..."
];

export default function ToolPage() {
  const [activeTab, setActiveTab] = useState('single');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const [domain, setDomain] = useState('');
  const [anchor, setAnchor] = useState('');
  const [linkto, setLinkto] = useState('');
  const [altAnchor, setAltAnchor] = useState('');
  
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!domain || !anchor || !linkto) {
      setError("Please fill in Target Domain, Primary Anchor, and Destination URL");
      return;
    }
    
    setIsSearching(true);
    setError(null);
    setResults(null);
    setLoadingStep(0);
    
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1));
    }, 2000);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
      const res = await fetch(`${backendUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, anchor, linkto, altAnchor, isBranded: false })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze. Please try again.");
      }
      
      setResults(data.suggestions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      clearInterval(stepInterval);
      setLoadingStep(LOADING_STEPS.length);
      setIsSearching(false);
    }
  };

  const handleExportCSV = () => {
    if (!results || results.length === 0) return;
    
    // Create CSV content
    const headers = ['Domain', 'Article URL', 'Anchor Text', 'Target URL', 'Suggested Placement'];
    const rows = results.map((res: any) => [
      new URL(res.article_url).hostname,
      res.article_url,
      anchor,
      linkto,
      `"${res.suggested_edit.replace(/"/g, '""')}"` // Escape quotes
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `placements_${domain}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      className="max-w-2xl mx-auto pt-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Find Link Placement
        </h1>
        <p className="text-zinc-500 text-sm">
          Analyze thousands of pages to find the most contextually relevant insertion points.
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
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. example.com" 
                    className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Primary Anchor Text</label>
                  <div className="relative flex items-center">
                    <Anchor className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text" 
                      value={anchor}
                      onChange={(e) => setAnchor(e.target.value)}
                      placeholder="e.g. best SEO tools" 
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
                      value={linkto}
                      onChange={(e) => setLinkto(e.target.value)}
                      placeholder="https://..." 
                      className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Alternate Anchor Text <span className="lowercase text-zinc-600 font-normal">(optional)</span></label>
                <div className="relative flex items-center">
                  <FileText className="absolute left-3 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text" 
                    value={altAnchor}
                    onChange={(e) => setAltAnchor(e.target.value)}
                    placeholder="e.g. SEO software, ranking tools" 
                    className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {results && results.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#00df81]" />
                    Found {results.length} Placements
                  </h3>
                  {results.map((res: any, idx: number) => (
                    <div key={idx} className="bg-[#0a0a0a] border border-white/5 rounded-lg p-5">
                      <div className="flex items-center gap-2 text-xs text-[#00df81] mb-2 font-mono">
                        <Globe className="w-3 h-3" />
                        {new URL(res.article_url).hostname.replace('www.', '')}
                        <span className="text-zinc-600 ml-2">Score: {res.relevance_score}</span>
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed font-serif">
                        {res.suggested_edit}
                      </p>
                      <a href={res.article_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 text-xs hover:text-white mt-4 inline-block transition-colors">
                        View Article →
                      </a>
                    </div>
                  ))}
                  
                  <div className="pt-2">
                    <button 
                      onClick={handleExportCSV}
                      className="w-full py-2.5 rounded-lg bg-[#0a0a0a] border border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-300 font-medium text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      Export Placements as CSV
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="w-full py-3 rounded-lg bg-zinc-100 hover:bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  Find Best Placement
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
