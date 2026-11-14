"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  ListChecks,
  Search,
  CheckCircle2,
  Circle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Download,
  Info,
  Sparkles,
} from "lucide-react";

interface ListicleItem {
  title: string;
  url: string;
  type: string;
  confidence: "High" | "Medium" | string;
}

interface ListicleScanResponse {
  website: string;
  source: string;
  totalUrlsScanned: number;
  totalFound: number;
  fewerThanTen: boolean;
  notice: string | null;
  aiCallsMade?: number;
  listicles: ListicleItem[];
}

const PROGRESS_MESSAGES = [
  "Scanning sitemap...",
  "Checking sitemap_index.xml, robots.txt & feeds...",
  "Applying regex filter on article slugs & titles...",
  "Analyzing doubtful articles with DeepSeek AI...",
  "Compiling confirmed listicle articles...",
];

/**
 * Normalizes a user-typed website URL on the client side:
 * adds https:// if missing and strips trailing slashes.
 */
function normalizeWebsiteInput(raw: string): { valid: boolean; normalized: string; error?: string } {
  let val = raw.trim();
  if (!val) {
    return { valid: false, normalized: "", error: "Please enter a website URL (e.g. https://ahrefs.com)." };
  }
  if (!/^https?:\/\//i.test(val)) {
    val = "https://" + val;
  }
  val = val.replace(/\/+$/, "");

  try {
    const parsed = new URL(val);
    if (!parsed.hostname.includes(".")) {
      return {
        valid: false,
        normalized: val,
        error: "Please enter a valid public domain (e.g. https://example.com).",
      };
    }
    const cleanBase = `${parsed.protocol}//${parsed.hostname}`;
    return { valid: true, normalized: cleanBase };
  } catch {
    return {
      valid: false,
      normalized: val,
      error: "Invalid URL format. Please enter a valid URL like https://example.com",
    };
  }
}

export default function ListicleFinderSection() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [scanResult, setScanResult] = useState<ListicleScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleFindListicles = async () => {
    const check = normalizeWebsiteInput(websiteUrl);
    if (!check.valid) {
      setError(check.error || "Invalid website URL.");
      return;
    }

    setWebsiteUrl(check.normalized);
    setError(null);
    setScanResult(null);
    setIsScanning(true);
    setProgressStep(0);

    const timer = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_MESSAGES.length - 1));
    }, 2800);

    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "http://localhost:3000";

      const res = await fetch(`${apiBase}/api/listicle-finder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: check.normalized }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to scan website for listicles.");
      }

      setScanResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong while scanning for listicles.");
    } finally {
      clearInterval(timer);
      setIsScanning(false);
    }
  };

  const handleCopySingle = (url: string, idx: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const handleCopyAll = () => {
    if (!scanResult?.listicles?.length) return;
    const allUrls = scanResult.listicles.map((item) => item.url).join("\n");
    navigator.clipboard.writeText(allUrls);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExportCSV = () => {
    if (!scanResult?.listicles?.length) return;

    const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = ["No.", "Article Title", "URL", "Listicle Type", "Confidence"];
    const rows = scanResult.listicles.map((item, idx) => [
      escapeCsv(idx + 1),
      escapeCsv(item.title),
      escapeCsv(item.url),
      escapeCsv(item.type),
      escapeCsv(item.confidence),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    let hostSlug = "website";
    try {
      hostSlug = new URL(scanResult.website).hostname.replace(/^www\./, "");
    } catch {}
    link.setAttribute("href", url);
    link.setAttribute("download", `listicles_${hostSlug}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-14 pt-10 border-t border-white/10 pb-12">
      {/* Section Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[#6366f1]/30 bg-[#6366f1]/10 text-[#6366f1] text-[10px] font-bold uppercase tracking-widest mb-3">
          <ListChecks className="w-3.5 h-3.5" />
          Outreach & Link Pitching
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Listicle Finder
        </h2>
        <p className="text-zinc-500 text-sm">
          Enter a website URL to find listicle-type articles (&ldquo;10 Best Tools...&rdquo;, &ldquo;7 Ways to...&rdquo;, &ldquo;Top Alternatives...&rdquo;) ready for link or product inclusion pitches.
        </p>
      </div>

      {/* Main Card */}
      <motion.div
        className="bg-[#121212] border border-white/5 rounded-xl p-8 transition-colors hover:border-white/10 space-y-6"
        layout
      >
        {/* URL Input Field */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
            Website URL
          </label>
          <div className="relative flex items-center">
            <Globe className="absolute left-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onBlur={() => {
                if (websiteUrl.trim()) {
                  const res = normalizeWebsiteInput(websiteUrl);
                  if (res.valid) setWebsiteUrl(res.normalized);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isScanning) {
                  handleFindListicles();
                }
              }}
              placeholder="e.g. https://example.com"
              className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
            />
          </div>
          <p className="text-[11px] text-zinc-600">
            Automatically normalizes to https:// and removes trailing slashes
          </p>
        </div>

        {/* Find Listicles Button */}
        <div>
          <button
            type="button"
            onClick={handleFindListicles}
            disabled={isScanning}
            className="w-full py-3 rounded-lg bg-zinc-100 hover:bg-white text-black font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {isScanning ? PROGRESS_MESSAGES[progressStep] : "Find Listicles"}
          </button>
        </div>

        {/* Loading Progress Steps */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-4 border-t border-white/5 space-y-3"
            >
              {PROGRESS_MESSAGES.map((msg, idx) => {
                const isActive = idx === progressStep;
                const isDone = idx < progressStep;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 text-xs font-medium transition-colors ${
                      isActive || isDone ? "text-[#00df81]" : "text-zinc-600"
                    }`}
                  >
                    {isDone || isActive ? (
                      <CheckCircle2 className="w-4 h-4 text-[#00df81] shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 shrink-0" />
                    )}
                    <span className={isActive ? "animate-pulse" : ""}>{msg}</span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        {error && !isScanning && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5">Scan Error</div>
              <p className="text-red-300/90 text-xs leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Initial Empty State (before any scan) */}
        {!scanResult && !isScanning && !error && (
          <div className="text-center py-8 px-4 rounded-xl bg-[#0a0a0a] border border-white/5">
            <Search className="w-7 h-7 text-zinc-600 mx-auto mb-2.5 opacity-60" />
            <p className="text-zinc-400 text-sm font-medium">
              Ready to discover listicle opportunities
            </p>
            <p className="text-zinc-600 text-xs mt-1 max-w-md mx-auto">
              Enter any website above and click &ldquo;Find Listicles&rdquo; to scan its sitemap, RSS feed, and blog pages for listicle-format articles.
            </p>
          </div>
        )}

        {/* Scan Results */}
        {scanResult && !isScanning && (
          <div className="space-y-5 pt-4 border-t border-white/10">
            {/* Fewer than 10 found notice */}
            {scanResult.listicles.length > 0 && scanResult.listicles.length < 10 && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="font-semibold text-amber-200">
                    Fewer than 10 listicles found:{" "}
                  </span>
                  {scanResult.notice ||
                    `This website only has ${scanResult.listicles.length} listicle article(s) across ${scanResult.totalUrlsScanned} scanned URLs. Showing all found results.`}
                </div>
              </div>
            )}

            {/* Empty State when 0 listicles found */}
            {scanResult.listicles.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl bg-[#0a0a0a] border border-white/5">
                <ListChecks className="w-8 h-8 text-zinc-600 mx-auto mb-3 opacity-40" />
                <p className="text-zinc-300 text-sm font-semibold">
                  No listicle articles found on {scanResult.website}
                </p>
                <p className="text-zinc-500 text-xs mt-1 max-w-md mx-auto">
                  {scanResult.notice ||
                    `We scanned ${scanResult.totalUrlsScanned} URLs and did not find any articles matching listicle patterns.`}
                </p>
              </div>
            ) : (
              <>
                {/* Top Summary & Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#00df81]" />
                    <span className="text-white font-semibold text-sm">
                      Found {scanResult.listicles.length} Listicle Article
                      {scanResult.listicles.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs text-zinc-500">
                      ({scanResult.totalUrlsScanned} URLs scanned via {scanResult.source})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyAll}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#0a0a0a] hover:bg-white/5 text-zinc-300 hover:text-white text-xs font-medium transition-all"
                    >
                      {copiedAll ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00df81]" />
                          <span className="text-[#00df81]">Copied All!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy all
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#00df81]/30 bg-[#00df81]/10 hover:bg-[#00df81]/20 text-[#00df81] text-xs font-medium transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                  </div>
                </div>

                {/* Results Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#0a0a0a]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-[#101014]">
                        <th className="py-3 px-3 w-12">No.</th>
                        <th className="py-3 px-3">Article Title</th>
                        <th className="py-3 px-3">URL</th>
                        <th className="py-3 px-3 whitespace-nowrap">Listicle Type</th>
                        <th className="py-3 px-3 whitespace-nowrap">Confidence</th>
                        <th className="py-3 px-3 text-right">Copy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {scanResult.listicles.map((item, idx) => {
                        const isHigh =
                          String(item.confidence).toLowerCase() === "high";
                        return (
                          <tr
                            key={item.url + idx}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-3.5 px-3 font-mono text-zinc-500">
                              {idx + 1}
                            </td>
                            <td className="py-3.5 px-3 text-zinc-200 font-medium max-w-[220px]">
                              <div className="line-clamp-2 leading-snug" title={item.title}>
                                {item.title}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 max-w-[220px]">
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#6366f1] font-mono hover:underline inline-flex items-center gap-1 break-all line-clamp-1"
                                title={item.url}
                              >
                                <span className="truncate max-w-[185px]">{item.url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#6366f1]/10 text-[#818cf8] border border-[#6366f1]/25">
                                {item.type}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  isHigh
                                    ? "bg-[#00df81]/10 text-[#00df81] border-[#00df81]/30"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                }`}
                              >
                                {isHigh ? "High" : "Medium"}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleCopySingle(item.url, idx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[11px] font-medium transition-colors"
                              >
                                {copiedIdx === idx ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#00df81]" />
                                    <span className="text-[#00df81]">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    Copy
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
