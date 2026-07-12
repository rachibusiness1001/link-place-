"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import {
  FolderOpen, Trash2, Mail, User, ExternalLink, Globe, Plus,
  Download, ChevronDown, ChevronRight, Search, BookMarked, Inbox
} from "lucide-react";

export default function ManagePlacementsPage() {
  const { projects, placements, deleteProject, deletePlacement, updatePlacement, addProject } = useAppStore();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<{ name: string; email: string }>({ name: "", email: "" });
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    addProject(newProjectName.trim());
    setNewProjectName("");
    setShowNewProject(false);
  };

  const handleStartEditContact = (pl: any) => {
    setEditingContact(pl.id);
    setContactDraft({ name: pl.clientName || "", email: pl.clientEmail || "" });
  };

  const handleSaveContact = (id: string) => {
    updatePlacement(id, { clientName: contactDraft.name, clientEmail: contactDraft.email });
    setEditingContact(null);
  };

  const handleExportProject = (projectId: string) => {
    const pls = placements.filter((p) => p.projectId === projectId);
    if (!pls.length) return;
    const proj = projects.find((p) => p.id === projectId);
    const headers = ["Domain", "Article URL", "Anchor", "Target URL", "Client Name", "Client Email", "Suggested Edit", "Saved At"];
    const rows = pls.map((p) => [
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
    a.download = `${proj?.name || "project"}_placements.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredPlacements = (projectId: string) =>
    placements.filter(
      (p) =>
        p.projectId === projectId &&
        (filterQuery === "" ||
          p.domain.toLowerCase().includes(filterQuery.toLowerCase()) ||
          (p.clientName || "").toLowerCase().includes(filterQuery.toLowerCase()) ||
          (p.clientEmail || "").toLowerCase().includes(filterQuery.toLowerCase()))
    );

  const totalPlacements = placements.length;

  return (
    <motion.div
      className="max-w-5xl mx-auto pt-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
            <BookMarked className="w-6 h-6 text-violet-400" />
            Manage Placements
          </h1>
          <p className="text-zinc-500 text-sm">
            Track all your saved placements across projects. Add client contacts and export anytime.
          </p>
        </div>
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Projects", value: projects.length },
          { label: "Total Placements", value: totalPlacements },
          { label: "With Client Info", value: placements.filter((p) => p.clientEmail).length },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#121212] border border-white/5 rounded-xl p-4">
            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
            <div className="text-xs text-zinc-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search Filter */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Filter by domain, client name or email..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="w-full bg-[#121212] border border-white/5 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 transition-all"
        />
      </div>

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProject && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 bg-[#1a1a2e] border border-violet-500/20 rounded-xl p-5 flex items-center gap-3"
          >
            <FolderOpen className="w-5 h-5 text-violet-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              placeholder="Project name, e.g. SEO Client Q3..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
            />
            <button
              onClick={handleCreateProject}
              className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowNewProject(false)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-sm transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#121212] border border-white/5 flex items-center justify-center mb-4">
            <Inbox className="w-6 h-6 text-zinc-600" />
          </div>
          <h3 className="text-white font-semibold mb-2">No projects yet</h3>
          <p className="text-zinc-500 text-sm max-w-sm mb-6">
            Create your first project and save placements from the Find Placement tool.
          </p>
          <button
            onClick={() => setShowNewProject(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      )}

      {/* Projects List */}
      <div className="space-y-3">
        {projects.map((project) => {
          const pls = filteredPlacements(project.id);
          const allPls = placements.filter((p) => p.projectId === project.id);
          const isExpanded = expandedProjects.has(project.id);

          return (
            <motion.div
              key={project.id}
              layout
              className="bg-[#121212] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors"
            >
              {/* Project Header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer"
                onClick={() => toggleProject(project.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                  <FolderOpen className="w-4 h-4 text-violet-400" />
                  <span className="text-white font-medium text-sm">{project.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    {allPls.length} placements
                  </span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleExportProject(project.id)}
                    title="Export to CSV"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    title="Delete Project"
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Placements */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {pls.length === 0 && (
                        <div className="px-5 py-6 text-center text-zinc-600 text-sm">
                          No placements match your filter.
                        </div>
                      )}
                      {pls.map((pl) => (
                        <div key={pl.id} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              {/* Domain + URL */}
                              <div className="flex items-center gap-2 mb-2">
                                <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="text-emerald-400 text-xs font-mono font-medium">{pl.domain}</span>
                                {pl.isBranded && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold">BRANDED</span>
                                )}
                                <a
                                  href={pl.articleUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-zinc-600 hover:text-zinc-300 transition-colors ml-auto"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>

                              {/* Suggested Paragraph */}
                              <p className="text-zinc-400 text-xs leading-relaxed mb-3 font-serif line-clamp-2">
                                {pl.suggestedEdit}
                              </p>

                              {/* Anchor + Target */}
                              <div className="flex flex-wrap gap-3 text-[11px] text-zinc-600 mb-3">
                                <span>Anchor: <span className="text-zinc-400">{pl.anchor}</span></span>
                                <span>→</span>
                                <span className="text-zinc-500 truncate max-w-xs">{pl.targetUrl}</span>
                              </div>

                              {/* Client Contact */}
                              {editingContact === pl.id ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5">
                                    <User className="w-3.5 h-3.5 text-zinc-500" />
                                    <input
                                      type="text"
                                      value={contactDraft.name}
                                      onChange={(e) => setContactDraft({ ...contactDraft, name: e.target.value })}
                                      placeholder="Client name"
                                      className="bg-transparent text-xs text-zinc-300 outline-none w-28 placeholder:text-zinc-600"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-1.5">
                                    <Mail className="w-3.5 h-3.5 text-zinc-500" />
                                    <input
                                      type="email"
                                      value={contactDraft.email}
                                      onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })}
                                      placeholder="Client email"
                                      className="bg-transparent text-xs text-zinc-300 outline-none w-40 placeholder:text-zinc-600"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleSaveContact(pl.id)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingContact(null)}
                                    className="px-3 py-1.5 rounded-lg bg-white/5 text-zinc-500 text-xs transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleStartEditContact(pl)}
                                  className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-300 transition-colors group"
                                >
                                  {pl.clientEmail ? (
                                    <>
                                      <Mail className="w-3.5 h-3.5 text-violet-400" />
                                      <span className="text-violet-400">{pl.clientName && `${pl.clientName} · `}{pl.clientEmail}</span>
                                      <span className="text-zinc-600 group-hover:text-zinc-400 text-[10px]">(edit)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add client contact</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => deletePlacement(pl.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-colors shrink-0 mt-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-[10px] text-zinc-700 mt-2">
                            Saved {new Date(pl.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
