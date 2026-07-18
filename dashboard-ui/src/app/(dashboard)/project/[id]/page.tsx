"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { useParams, useRouter } from "next/navigation";
import {
  FolderOpen, Trash2, Mail, User, ExternalLink, Globe,
  Download, Search, BookMarked, ArrowLeft, Inbox
} from "lucide-react";
import Link from "next/link";

export default function ProjectViewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const { projects, placements, deleteProject, deletePlacement, updatePlacement } = useAppStore();
  
  const [filterQuery, setFilterQuery] = useState("");
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<{ name: string; email: string }>({ name: "", email: "" });

  const project = projects.find(p => p.id === projectId);
  
  // Handle case where project is deleted or not found
  useEffect(() => {
    if (!project && projects.length > 0) {
      router.push('/manage-placements');
    }
  }, [project, projects, router]);

  if (!project) return null;

  const projectPlacements = placements.filter(p => p.projectId === projectId);
  const filteredPlacements = projectPlacements.filter(
    (p) =>
      filterQuery === "" ||
      p.domain.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (p.clientName || "").toLowerCase().includes(filterQuery.toLowerCase()) ||
      (p.clientEmail || "").toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleStartEditContact = (pl: any) => {
    setEditingContact(pl.id);
    setContactDraft({ name: pl.clientName || "", email: pl.clientEmail || "" });
  };

  const handleSaveContact = (id: string) => {
    updatePlacement(id, { clientName: contactDraft.name, clientEmail: contactDraft.email });
    setEditingContact(null);
  };

  const handleExportProject = () => {
    if (!projectPlacements.length) return;
    const headers = ["Domain", "Article URL", "Anchor", "Target URL", "Client Name", "Client Email", "Suggested Edit", "Saved At"];
    const rows = projectPlacements.map((p) => [
      p.domain, p.articleUrl, p.anchor, p.targetUrl,
      p.clientName || "", p.clientEmail || "",
      `"${(p.suggestedEdit || "").replace(/"/g, '""')}"`,
      new Date(p.savedAt).toLocaleDateString()
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_placements.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDeleteProject = () => {
    if (confirm("Are you sure you want to delete this project and all its placements?")) {
      deleteProject(projectId);
      router.push('/manage-placements');
    }
  };

  return (
    <motion.div
      className="max-w-5xl mx-auto pt-4 pb-12"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Back Link */}
      <Link href="/manage-placements" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white text-sm font-medium transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to All Projects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 bg-[#121212] p-6 rounded-xl border border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <FolderOpen className="w-6 h-6 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{project.name}</h1>
          </div>
          <p className="text-zinc-500 text-sm flex items-center gap-2 mt-3">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 uppercase tracking-widest">
              {projectPlacements.length} placements
            </span>
            <span>·</span>
            Created {new Date(project.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportProject}
            disabled={projectPlacements.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleDeleteProject}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Search Filter */}
      {projectPlacements.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter placements by domain, client name or email..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-[#121212] border border-white/5 rounded-lg py-3 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 transition-all shadow-sm"
          />
        </div>
      )}

      {/* Placements List */}
      <div className="space-y-4">
        {projectPlacements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#121212] border border-white/5 rounded-xl text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Inbox className="w-5 h-5 text-zinc-600" />
            </div>
            <h3 className="text-white font-medium mb-1">No placements saved</h3>
            <p className="text-zinc-500 text-sm mb-6 max-w-sm">
              Use the Find Placement or Branded Anchor tools to find links and save them to this project.
            </p>
            <Link 
              href="/tool"
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              Find Placements
            </Link>
          </div>
        ) : filteredPlacements.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 bg-[#121212] rounded-xl border border-white/5">
            No placements match your filter.
          </div>
        ) : (
          filteredPlacements.map((pl) => (
            <motion.div 
              key={pl.id} 
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#121212] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Domain + URL */}
                  <div className="flex items-center gap-2 mb-3">
                    <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 text-xs font-mono font-medium tracking-wide">{pl.domain}</span>
                    {pl.isBranded && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold ml-1">BRANDED</span>
                    )}
                    <a
                      href={pl.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-600 hover:text-zinc-300 transition-colors ml-auto flex items-center gap-1.5 text-xs font-medium"
                    >
                      View Article <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Suggested Paragraph */}
                  <div className="bg-[#0a0a0a] border border-white/5 rounded-lg p-4 mb-4">
                    <p className="text-zinc-300 text-sm leading-relaxed font-serif">
                      {pl.suggestedEdit}
                    </p>
                  </div>

                  {/* Anchor + Target */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mb-4 bg-white/[0.02] inline-flex p-2 rounded-lg border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600 uppercase tracking-wider text-[9px] font-bold">Anchor</span>
                      <span className="text-white font-medium">{pl.anchor}</span>
                    </div>
                    <span className="text-zinc-700">→</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-600 uppercase tracking-wider text-[9px] font-bold">Target</span>
                      <span className="text-zinc-300 truncate max-w-xs">{pl.targetUrl}</span>
                    </div>
                  </div>

                  {/* Client Contact */}
                  <div className="flex items-center mt-2">
                    {editingContact === pl.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-500" />
                          <input
                            type="text"
                            value={contactDraft.name}
                            onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })}
                            placeholder="Client name"
                            className="bg-transparent text-xs text-zinc-300 outline-none w-32 placeholder:text-zinc-600"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5">
                          <Mail className="w-3.5 h-3.5 text-zinc-500" />
                          <input
                            type="email"
                            value={contactDraft.email}
                            onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })}
                            placeholder="Client email"
                            className="bg-transparent text-xs text-zinc-300 outline-none w-48 placeholder:text-zinc-600"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveContact(pl.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-colors ml-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingContact(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEditContact(pl)}
                        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors group bg-[#0a0a0a] px-3 py-1.5 rounded-lg border border-white/5"
                      >
                        {pl.clientEmail ? (
                          <>
                            <Mail className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-violet-400 font-medium">{pl.clientName && `${pl.clientName} · `}{pl.clientEmail}</span>
                            <span className="text-zinc-600 group-hover:text-zinc-400 text-[10px] ml-1">(edit)</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5" />
                            <span>Add client contact</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Side Info */}
                <div className="flex flex-col items-end justify-between shrink-0 h-full">
                  <div className="text-[10px] text-zinc-600 font-medium tracking-wide uppercase">
                    {new Date(pl.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <button
                    onClick={() => deletePlacement(pl.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors mt-auto"
                    title="Remove placement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
