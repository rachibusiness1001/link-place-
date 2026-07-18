"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Link as LinkIcon, Search, CheckCircle2, AlertCircle, ExternalLink, Copy, ChevronRight, Loader2 } from 'lucide-react';

export default function FindAnchorPage() {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [anchorText, setAnchorText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleSearch = async () => {
    if (!websiteUrl.trim() || !anchorText.trim()) {
      setError("Please enter both a website URL and anchor text.");
      return;
    }
    setIsSearching(true);
    setError(null);
    setResults(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://link-place-latest.onrender.com";
      const res = await fetch(`${backendUrl}/api/find-anchor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: websiteUrl.trim(), anchorText: anchorText.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to search. Please try again.");
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = (url: string, idx: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <motion.div
      className="max-w-2xl mx-auto pt-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
          <LinkIcon className="w-6 h-6 text-[#6366f1]" />
          Find Anchor
        </h1>
        <p className="text-zinc-500 text-sm">
          Enter any website URL and anchor text — we'll scan every article on that site and show you every page where that anchor text already exists.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Zero cost — No API used
        </div>
      </div>

      <div className="bg-[#121212] border border-white/5 rounded-xl p-8 hover:border-white/10 transition-colors space-y-6">
        
        {/* Website URL */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Website URL</label>
          <div className="relative flex items-center">
            <Globe className="absolute left-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. buildd.co or https://buildd.co"
              className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
            />
          </div>
          <p className="text-[11px] text-zinc-600">Domain only — no need for https://</p>
        </div>

        {/* Anchor Text */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Anchor Text to Find</label>
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={anchorText}
              onChange={(e) => setAnchorText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. ai engineering course"
              className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
            />
          </div>
          <p className="text-[11px] text-zinc-600">We'll find every article on this website that mentions this text</p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="w-full py-3 rounded-lg bg-[#6366f1] hover:bg-[#5254cc] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning articles... (this may take 30–60 seconds)
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Find All Mentions
            </>
          )}
        </button>

        {/* Results */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 pt-4 border-t border-white/5"
            >
              {/* Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#00df81]" />
                  <span className="text-white font-semibold">
                    {results.totalFound === 0
                      ? `No articles found with "${results.anchorText}"`
                      : `Found ${results.totalFound} article${results.totalFound > 1 ? 's' : ''} mentioning "${results.anchorText}"`}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-600">{results.totalChecked} pages scanned</span>
              </div>

              {results.totalFound === 0 && (
                <div className="text-center py-8 text-zinc-600 text-sm">
                  <LinkIcon className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p>No articles on <span className="text-zinc-400">{results.websiteUrl}</span> mention "<span className="text-zinc-400">{results.anchorText}</span>".</p>
                  <p className="mt-1 text-xs text-zinc-700">Try a different anchor text or website.</p>
                </div>
              )}

              {/* Article list */}
              {results.articles && results.articles.length > 0 && (
                <div className="space-y-3">
                  {results.articles.map((article: any, idx: number) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
                    >
                      {/* Article title + URL */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate">{article.title}</p>
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#6366f1] text-xs font-mono hover:underline break-all flex items-center gap-1 mt-0.5"
                          >
                            {article.url}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>
                        <button
                          onClick={() => handleCopy(article.url, idx)}
                          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-medium transition-all"
                        >
                          <Copy className="w-3 h-3" />
                          {copiedIdx === idx ? 'Copied!' : 'Copy URL'}
                        </button>
                      </div>

                      {/* Context snippet with anchor highlighted */}
                      {article.context && (
                        <div className="bg-[#121212] border border-white/5 rounded-lg px-3 py-2">
                          <p className="text-zinc-500 text-xs leading-relaxed font-mono">
                            {article.context.split(new RegExp(`(${anchorText})`, 'gi')).map((part: string, i: number) =>
                              part.toLowerCase() === anchorText.toLowerCase()
                                ? <mark key={i} className="bg-[#6366f1]/30 text-[#a5b4fc] rounded px-0.5 not-italic">{part}</mark>
                                : <span key={i}>{part}</span>
                            )}
                          </p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 rounded-xl border border-white/5 bg-[#0d0d0f]">
        <h3 className="text-white text-sm font-semibold mb-2">How it works</h3>
        <div className="space-y-2 text-xs text-zinc-500">
          {[
            "We scan the website's sitemap.xml or RSS feed to find all article URLs",
            "Each article is fetched and checked for the anchor text you provided",
            "All matching pages are returned with a preview snippet",
            "No external APIs used — completely free, unlimited"
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <ChevronRight className="w-3 h-3 text-[#6366f1] mt-0.5 shrink-0" />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
