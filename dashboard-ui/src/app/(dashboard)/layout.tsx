import Sidebar from "../../components/Sidebar";
import { Search, SlidersHorizontal } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-50 flex">
      <Sidebar />
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        {/* Top Navigation / Search Bar */}
        <header className="h-16 border-b border-white/5 flex items-center px-8 bg-[#0a0a0a] shrink-0">
          <div className="flex-1 max-w-2xl relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search anything and everything" 
              className="w-full bg-[#121212] border border-white/5 rounded-lg py-2 pl-10 pr-10 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/10 focus:ring-1 focus:ring-white/10 transition-all"
            />
            <button className="absolute right-3 text-zinc-500 hover:text-zinc-300">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
