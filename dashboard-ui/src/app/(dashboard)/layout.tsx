"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import { Search, SlidersHorizontal, Globe, FolderOpen, ExternalLink } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useRouter } from "next/navigation";

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { placements, projects } = useAppStore();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const results = query.trim().length > 0
    ? placements.filter(
        (p) =>
          p.domain.toLowerCase().includes(query.toLowerCase()) ||
          p.anchor.toLowerCase().includes(query.toLowerCase()) ||
          (p.clientName || "").toLowerCase().includes(query.toLowerCase()) ||
          (p.clientEmail || "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  const getProjectName = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.name || "Unknown Project";

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="flex-1 max-w-2xl relative flex items-center">
      <Search className="w-4 h-4 absolute left-3 text-zinc-500 z-10" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search any domain, client, or anchor..."
        className="w-full bg-[#121212] border border-white/5 rounded-lg py-2 pl-10 pr-10 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
      />
      <button className="absolute right-3 text-zinc-500 hover:text-zinc-300">
        <SlidersHorizontal className="w-4 h-4" />
      </button>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest border-b border-white/5">
            Found {results.length} placement{results.length !== 1 ? "s" : ""}
          </div>
          {results.map((pl) => (
            <button
              key={pl.id}
              onClick={() => {
                router.push("/manage-placements");
                setIsOpen(false);
                setQuery("");
              }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
            >
              <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{pl.domain}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <FolderOpen className="w-3 h-3 text-violet-400" />
                  <span className="text-xs text-zinc-500 truncate">{getProjectName(pl.projectId)}</span>
                  {pl.clientEmail && (
                    <span className="text-[10px] text-zinc-600 truncate">· {pl.clientEmail}</span>
                  )}
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 px-4 py-4 text-center text-sm text-zinc-600">
          No saved placements found for "{query}"
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        {/* Top Navigation / Search Bar */}
        <header className="h-16 border-b border-white/5 flex items-center px-8 bg-[#0a0a0a] shrink-0">
          <GlobalSearch />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
