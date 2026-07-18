"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as LinkIcon, FileText, Anchor, Sparkles, Globe, CheckCircle2, Circle, AlertCircle, Download, BookMarked, Plus, FolderOpen } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const LOADING_STEPS = [
  "Analyzing target URL topic...",
  "Searching for relevant blog articles...",
  "Fetching article content...",
  "Scanning paragraphs for brand fit...",
  "AI finding best branded placement...",
  "Preparing your results...",
];

export default function BrandedAnchorPage() {
  const [isSearching, setIsSearching] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const [domain, setDomain] = useState('');
  const [anchor, setAnchor] = useState('');
  const [linkto, setLinkto] = useState('');
  const [altAnchor, setAltAnchor] = useState('');

  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Project management
  const { projects, addProject, savePlacement } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const p = addProject(newProjectName.trim());
    setSelectedProjectId(p.id);
    setNewProjectName('');
    setShowNewProject(false);
  };

  const handleSavePlacement = (res: any, idx: number) => {
    if (!selectedProjectId) return;
    savePlacement({
      projectId: selectedProjectId,
      domain,
      articleUrl: res.article_url,
      anchor,
      targetUrl: linkto,
      suggestedEdit: res.suggested_edit,
      relevanceScore: res.relevance_score,
      isBranded: true,
    });
    setSavedIds((prev) => new Set(prev).add(idx));
  };

  const handleSearch = async () => {
    if (!domain || !anchor || !linkto) {
      setError("Please fill in Target Domain, Branded Anchor, and Destination URL");
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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://link-place-latest.onrender.com";
      const res = await fetch(`${backendUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, anchor, linkto, altAnchor, isBranded: true })
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
    const headers = ['Domain', 'Article URL', 'Branded Anchor', 'Target URL', 'Suggested Placement'];
    const rows = results.map((res: any) => [
      new URL(res.article_url).hostname,
      res.article_url,
      anchor,
      linkto,
      `"${res.suggested_edit.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `branded_placements_${domain}.csv`);
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
          Find Branded Anchor
        </h1>
        <p className="text-zinc-500 text-sm">
          Analyze blog pages to naturally place your brand name based on target URL topic relevance.
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
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Project Selector */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Save to Project</label>
                {showNewProject ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-[#0a0a0a] border border-violet-500/30 rounded-lg px-3 py-2">
                      <FolderOpen className="w-4 h-4 text-violet-400 shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                        placeholder="Project name..."
                        className="flex-1 bg-transparent text-sm text-zinc-300 outline-none placeholder:text-zinc-600"
                      />
                    </div>
                    <button onClick={handleCreateProject} className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">Create</button>
                    <button onClick={() => setShowNewProject(false)} className="px-3 py-2 rounded-lg bg-white/5 text-zinc-400 text-sm transition-colors">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 focus:outline-none focus:border-white/10 appearance-none transition-all"
                      >
                        <option value="">-- Select a project --</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => setShowNewProject(true)}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-sm font-medium transition-colors border border-white/5"
                    >
                      <Plus className="w-4 h-4" />
                      New
                    </button>
                  </div>
                )}
              </div>

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
                  <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Branded Anchor Text</label>
                  <div className="relative flex items-center">
                    <Anchor className="absolute left-3 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={anchor}
                      onChange={(e) => setAnchor(e.target.value)}
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
                      value={linkto}
                      onChange={(e) => setLinkto(e.target.value)}
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
                    value={altAnchor}
                    onChange={(e) => setAltAnchor(e.target.value)}
                    placeholder="e.g. HubSpot CRM"
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

              {/* Results */}
              {results && results.length > 0 && (
                <div className="space-y-6 pt-4 border-t border-white/10">
                  <h3 className="text-white font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#00df81]" />
                    Found {results.length} Branded Placement{results.length > 1 ? 's' : ''}
                  </h3>
                  {results.map((res: any, idx: number) => {
                    let paragraphDisplay: React.ReactNode = res.paragraph;
                    if (res.paragraph && res.suggested_sentence) {
                      const parts = res.paragraph.split(res.suggested_sentence);
                      if (parts.length >= 2) {
                        paragraphDisplay = (
                          <>
                            {parts[0]}
                            <span className="underline decoration-[#6366f1] decoration-2 font-semibold text-white">{res.suggested_sentence}</span>
                            {parts.slice(1).join(res.suggested_sentence)}
                          </>
                        );
                      }
                    }

                    const naturalFitColor =
                      res.natural_fit === 'high' ? 'text-[#00df81] border-[#00df81]/30 bg-[#00df81]/10' :
                      res.natural_fit === 'medium' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
                      'text-red-400 border-red-400/30 bg-red-400/10';

                    return (
                      <div key={idx} className="bg-[#0a0a0a] border border-white/5 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-[#6366f1]/40 bg-[#6366f1]/10 text-[#6366f1] uppercase tracking-widest">
                            Suggestion {idx + 1}
                          </span>
                          <span className="text-xs text-zinc-500 font-medium">{idx === 0 ? 'Best Match' : `Match ${idx + 1}`}</span>
                        </div>

                        <div className="p-5 space-y-5">
                          <div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Article Found</div>
                            <div className="bg-[#121212] border border-white/5 rounded-lg px-4 py-2.5">
                              <a href={res.article_url} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] text-sm font-mono hover:underline break-all">
                                {res.article_url}
                              </a>
                            </div>
                          </div>

                          {res.paragraph && (
                            <div>
                              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Best Placement Paragraph</div>
                              <div className="bg-[#121212] border border-white/5 rounded-lg p-4">
                                <p className="text-zinc-300 text-sm leading-relaxed font-serif">{paragraphDisplay}</p>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold px-3 py-1 rounded-full border border-[#00df81]/30 bg-[#00df81]/10 text-[#00df81]">
                              Relevance: {res.relevance_score}/100
                            </span>
                            {res.natural_fit && (
                              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${naturalFitColor}`}>
                                Natural fit: {res.natural_fit}
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-sm">✏️</span>
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Suggested Edit</span>
                            </div>
                            {res.suggested_sentence && (
                              <p className="text-zinc-600 text-xs mb-3">Keep the rest of the paragraph as-is — only replace this one sentence.</p>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">✗ Original Sentence</div>
                                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 min-h-[80px]">
                                  <p className="text-zinc-500 text-sm leading-relaxed line-through">
                                    {res.suggested_sentence || '(full paragraph replacement)'}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold text-[#00df81] uppercase tracking-widest mb-2">✓ Suggested Edit</div>
                                <div className="bg-[#00df81]/5 border border-[#00df81]/20 rounded-lg p-3 min-h-[80px]">
                                  <p
                                    className="text-zinc-200 text-sm leading-relaxed [&_a]:text-[#6366f1] [&_a]:underline [&_a]:font-semibold [&_a]:cursor-pointer"
                                    dangerouslySetInnerHTML={{
                                      __html: res.suggested_edit.replace(
                                        '[[ANCHOR]]',
                                        `<a href="${linkto}" target="_blank" rel="noopener noreferrer">${anchor}</a>`
                                      )
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(res.suggested_edit.replace('[[ANCHOR]]', anchor))}
                              className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs font-medium transition-all"
                            >
                              📋 Copy edited text
                            </button>
                          </div>

                          {res.reason && (
                            <div>
                              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Why This Spot</div>
                              <p className="text-zinc-400 text-sm leading-relaxed">{res.reason}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <a href={res.article_url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 text-xs hover:text-white transition-colors">
                              View Article →
                            </a>
                            <button
                              onClick={() => handleSavePlacement(res, idx)}
                              disabled={savedIds.has(idx) || !selectedProjectId}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                savedIds.has(idx)
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default'
                                  : selectedProjectId
                                  ? 'bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 border border-violet-500/20'
                                  : 'bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed'
                              }`}
                              title={!selectedProjectId ? 'Select a project first' : ''}
                            >
                              <BookMarked className="w-3.5 h-3.5" />
                              {savedIds.has(idx) ? 'Saved!' : 'Save to Project'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

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
