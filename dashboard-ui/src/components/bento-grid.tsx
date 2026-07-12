"use client"

import { motion } from "framer-motion"
import { Sparkles, Brain, ShieldCheck, Globe2, TrendingUp } from "lucide-react"

export function BentoGrid() {
  return (
    <section className="py-12 sm:py-16 bg-black relative overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#00df81]/10 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="container mx-auto px-4 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white text-sm font-medium mb-6"
          >
            <Sparkles className="w-4 h-4 text-[#00df81]" />
            <span>AI-Powered Link Building</span>
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4"
          >
            Everything you need to <span className="text-[#00df81]">build authority</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-zinc-400"
          >
            Stop paying for generic links. Our intelligence layer ensures every backlink drives maximum topical relevance, domain authority, and SEO impact.
          </motion.p>
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
          {/* Box 1: Large - AI Matching */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="col-span-1 md:col-span-2 row-span-2 rounded-3xl bg-[#0c0c0e] border border-white/5 p-8 relative overflow-hidden group shadow-2xl flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#00df81]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#00df81]/10 border border-[#00df81]/20 flex items-center justify-center mb-6">
                <Brain className="w-6 h-6 text-[#00df81]" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Contextual Matching</h3>
              <p className="text-zinc-400 text-lg mb-8 max-w-md">
                Our engine reads the recent content of 50,000+ publishers to find the exact topical overlap for your keyword, ensuring your link feels 100% natural.
              </p>
              
              {/* Graphic - FIXED HEIGHT AND BARS */}
              <div className="mt-auto relative h-48 w-full rounded-xl bg-[#050505] border border-white/5 overflow-hidden flex items-end p-6 group-hover:border-white/10 transition-colors">
                <div className="w-full h-full flex items-end justify-between gap-3 opacity-90 relative z-10">
                  <motion.div animate={{ height: ["40%", "70%", "40%"] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="w-full bg-gradient-to-t from-zinc-800 to-zinc-700 rounded-t-md" />
                  <motion.div animate={{ height: ["60%", "30%", "60%"] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.5, ease: "easeInOut" }} className="w-full bg-gradient-to-t from-zinc-800 to-zinc-700 rounded-t-md" />
                  <motion.div animate={{ height: ["50%", "75%", "50%"] }} transition={{ duration: 4, repeat: Infinity, delay: 1, ease: "easeInOut" }} className="w-full bg-gradient-to-t from-[#00df81]/40 to-[#00df81] rounded-t-md relative shadow-[0_0_20px_rgba(0,223,129,0.5)]">
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-black text-[#00df81] bg-[#00df81]/10 px-2 py-1 rounded border border-[#00df81]/20 whitespace-nowrap">99% Match</div>
                  </motion.div>
                  <motion.div animate={{ height: ["30%", "60%", "30%"] }} transition={{ duration: 3.2, repeat: Infinity, delay: 1.5, ease: "easeInOut" }} className="w-full bg-gradient-to-t from-zinc-800 to-zinc-700 rounded-t-md" />
                  <motion.div animate={{ height: ["80%", "40%", "80%"] }} transition={{ duration: 3.8, repeat: Infinity, delay: 2, ease: "easeInOut" }} className="w-full bg-gradient-to-t from-zinc-800 to-zinc-700 rounded-t-md" />
                  <motion.div animate={{ height: ["50%", "80%", "50%"] }} transition={{ duration: 3.4, repeat: Infinity, delay: 2.5, ease: "easeInOut" }} className="w-full bg-gradient-to-t from-zinc-800 to-zinc-700 rounded-t-md hidden sm:block" />
                </div>
                
                {/* Scanning laser line effect */}
                <motion.div 
                  animate={{ y: ["0%", "150%", "0%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00df81] to-transparent shadow-[0_0_15px_rgba(0,223,129,1)] z-20 pointer-events-none opacity-50"
                />
              </div>
            </div>
          </motion.div>

          {/* Box 2: Guarantee */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="col-span-1 rounded-3xl bg-[#0c0c0e] border border-white/5 p-8 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">12-Month Link Guarantee</h3>
            <p className="text-zinc-400">
              Zero risk. If your backlink is removed, marked nofollow, or the domain drops in authority within a year, we replace it for free.
            </p>
          </motion.div>

          {/* Box 3: Verified Sites */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="col-span-1 rounded-3xl bg-[#0c0c0e] border border-white/5 p-8 relative overflow-hidden group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <Globe2 className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-4xl font-black text-white mb-1 tracking-tight">50,000+</h3>
            <p className="text-[#00df81] font-semibold text-sm uppercase tracking-wider mb-2">Vetted Publishers</p>
            <p className="text-zinc-400 text-sm">
              We cut out the middlemen to bring you direct access to top-tier, high-DA domains that actually move the needle.
            </p>
          </motion.div>

          {/* Box 4: Impact Forecast */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="col-span-1 md:col-span-3 rounded-3xl bg-[#0c0c0e] border border-[#00df81]/20 p-8 relative overflow-hidden group flex flex-col md:flex-row items-center justify-between gap-8"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none"></div>
            
            <div className="relative z-10 w-full flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl">
                <div className="w-12 h-12 rounded-xl bg-[#00df81]/10 border border-[#00df81]/20 flex items-center justify-center mb-6">
                  <TrendingUp className="w-6 h-6 text-[#00df81]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Traffic & Ranking Forecast</h3>
                <p className="text-zinc-400">
                  See the estimated SEO lift before you spend. We analyze historical data across thousands of campaigns to project exactly how a placement will boost your SERP positions.
                </p>
              </div>

              {/* Mini glowing graph */}
              <div className="w-full md:w-auto flex-1 h-32 relative">
                <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                  <motion.path 
                    d="M0,80 C50,80 80,60 120,60 C160,60 190,90 240,70 C290,50 340,20 400,10" 
                    fill="none" 
                    stroke="#00df81" 
                    strokeWidth="4"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                  />
                  <motion.path 
                    d="M0,80 C50,80 80,60 120,60 C160,60 190,90 240,70 C290,50 340,20 400,10 L400,100 L0,100 Z" 
                    fill="url(#gradient)" 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 2 }}
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#00df81" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00df81" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute right-0 top-0 bg-[#00df81] text-black text-xs font-bold px-2 py-1 rounded-full shadow-[0_0_15px_rgba(0,223,129,0.6)]">
                  +34% Traffic
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
