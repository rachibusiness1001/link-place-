"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { Globe, Anchor, Link as LinkIcon, Sparkles, CheckCircle2, Circle, FileText, Download, UploadCloud } from "lucide-react"

const LOADING_STEPS = [
  "Generating semantic keywords",
  "Searching for optimal domain",
  "Fetching article content",
  "Scanning paragraph relevance",
  "AI analyzing anchor context",
  "Finalizing placement"
];

const BULK_LOADING_STEPS = [
  "Parsing CSV data (142 rows)",
  "Initiating parallel crawling",
  "AI analyzing massive contexts",
  "Verifying domain authorities",
  "Mapping optimal anchor placements",
  "Generating final export file"
];

export function LinkPlacementDemo() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single')
  const [sequenceStep, setSequenceStep] = useState(0)
  
  // Typing states
  const [domainText, setDomainText] = useState("")
  const [anchorText, setAnchorText] = useState("")
  const [urlText, setUrlText] = useState("")
  
  const [loadingStep, setLoadingStep] = useState(0)

  // Cursor state
  const [cursorPos, setCursorPos] = useState({ x: 150, y: 350, opacity: 0 })
  const [cursorScale, setCursorScale] = useState(1)
  
  // Ripple effect state
  const [ripples, setRipples] = useState<{id: number, x: number, y: number}[]>([])

  // Helper to simulate click with ripple
  const simulateClick = async (x: number, y: number) => {
    setCursorScale(0.8);
    // Add ripple
    const id = Date.now() + Math.random();
    setRipples(prev => [...prev, { id, x, y }]);
    await new Promise(r => setTimeout(r, 150));
    setCursorScale(1);
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 1000);
  };

  // Automated sequence logic
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const runSequence = async () => {
      // --- RESET TO SINGLE ---
      setActiveTab('single');
      setSequenceStep(0);
      setDomainText("");
      setAnchorText("");
      setUrlText("");
      setLoadingStep(0);
      setCursorPos({ x: 150, y: 400, opacity: 0 });
      setCursorScale(1);
      setRipples([]);

      const typeText = async (setter: any, text: string, delay = 40) => {
        for (let i = 0; i <= text.length; i++) {
          setter(text.substring(0, i));
          await new Promise(r => setTimeout(r, delay));
        }
      };

      // Wait a moment before starting
      await new Promise(r => setTimeout(r, 1000));
      let cx = 250, cy = 150;
      setCursorPos({ x: cx, y: cy, opacity: 1 }); // move to domain input
      await new Promise(r => setTimeout(r, 800));

      // Click domain input
      await simulateClick(cx, cy);
      
      // Step 1: Type Domain
      setSequenceStep(1);
      await typeText(setDomainText, "techcrunch.com");
      
      // Move to anchor input
      await new Promise(r => setTimeout(r, 400));
      cx = 150; cy = 230;
      setCursorPos({ x: cx, y: cy, opacity: 1 });
      await new Promise(r => setTimeout(r, 500));
      
      // Click anchor input
      await simulateClick(cx, cy);

      // Step 2: Type Anchor
      setSequenceStep(2);
      await typeText(setAnchorText, "best SaaS analytics");

      // Move to URL input
      await new Promise(r => setTimeout(r, 400));
      cx = 450; cy = 230;
      setCursorPos({ x: cx, y: cy, opacity: 1 });
      await new Promise(r => setTimeout(r, 500));

      // Click URL input
      await simulateClick(cx, cy);

      // Step 3: Type URL
      setSequenceStep(3);
      await typeText(setUrlText, "https://yoursaas.com");

      // Move to button
      await new Promise(r => setTimeout(r, 500));
      cx = 300; cy = 390;
      setCursorPos({ x: cx, y: cy, opacity: 1 });
      await new Promise(r => setTimeout(r, 600));

      // Click button
      await simulateClick(cx, cy);
      setSequenceStep(4);
      
      // Step 5: Loading steps
      setCursorPos({ x: cx, y: 450, opacity: 0 }); // hide cursor
      await new Promise(r => setTimeout(r, 300));
      setSequenceStep(5);
      
      for (let i = 0; i < LOADING_STEPS.length; i++) {
        setLoadingStep(i);
        await new Promise(r => setTimeout(r, 600));
      }

      // Step 6: Show single result
      await new Promise(r => setTimeout(r, 500));
      setSequenceStep(6);
      
      // Wait to admire single result
      await new Promise(r => setTimeout(r, 4000));
      
      // --- BULK FLOW ---
      
      // Move to Bulk tab
      cx = 350; cy = 75;
      setCursorPos({ x: cx, y: cy, opacity: 1 }); 
      await new Promise(r => setTimeout(r, 800));
      await simulateClick(cx, cy);
      setActiveTab('bulk');
      setSequenceStep(7);

      // Move to Drag & Drop area
      await new Promise(r => setTimeout(r, 400));
      cx = 300; cy = 220;
      setCursorPos({ x: cx, y: cy, opacity: 1 });
      await new Promise(r => setTimeout(r, 800));

      // Click to upload file
      await simulateClick(cx, cy);
      setSequenceStep(8); // File Selected

      // Move to process bulk button
      await new Promise(r => setTimeout(r, 600));
      cx = 300; cy = 370;
      setCursorPos({ x: cx, y: cy, opacity: 1 });
      await new Promise(r => setTimeout(r, 600));
      
      // Click process bulk button
      await simulateClick(cx, cy);
      setSequenceStep(9); // Button clicked

      // Loading bulk
      setCursorPos({ x: cx, y: 450, opacity: 0 }); // hide cursor
      await new Promise(r => setTimeout(r, 300));
      setSequenceStep(10); // Loading state

      for (let i = 0; i < BULK_LOADING_STEPS.length; i++) {
        setLoadingStep(i);
        await new Promise(r => setTimeout(r, 600));
      }

      // Show Bulk Result
      await new Promise(r => setTimeout(r, 500));
      setSequenceStep(11);

      // Move to Export button
      cx = 300; cy = 360;
      setCursorPos({ x: cx, y: cy, opacity: 1 });
      await new Promise(r => setTimeout(r, 800));
      
      // Click Export
      await simulateClick(cx, cy);
      setSequenceStep(12); // Export success!

      // Hide cursor and wait before restart
      setCursorPos({ x: cx, y: 450, opacity: 0 });
      await new Promise(r => setTimeout(r, 5000));
      runSequence();
    };

    runSequence();

    return () => clearTimeout(timeout);
  }, []);

  return (
    <section className="relative overflow-hidden py-12 sm:py-16 bg-[#030303]">
      
      {/* 1. Hyper-Premium Noise Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      ></div>

      {/* 2. Premium Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)] pointer-events-none"></div>

      {/* Background Decorators */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-[#00df81]/50 to-transparent"></div>
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00df81]/15 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="container mx-auto px-4 flex flex-col items-center gap-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mb-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00df81]/10 text-[#00df81] text-sm font-medium mb-6 border border-[#00df81]/20 shadow-[0_0_30px_rgba(0,223,129,0.15)] backdrop-blur-md">
            <Sparkles className="w-4 h-4" />
            <span>Fully Automated Process</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-white drop-shadow-sm">
            See the magic in <span className="text-[#00df81] drop-shadow-[0_0_20px_rgba(0,223,129,0.4)]">action.</span>
          </h2>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light">
            Watch our intelligent engine scan single domains or process massive CSV lists to find the most natural, high-authority spots for your backlinks.
          </p>
        </motion.div>

        {/* Floating Wrapper for premium feel without text blur */}
        <motion.div 
          animate={{ 
            y: [-8, 8, -8]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="w-full max-w-2xl relative"
        >
          
          {/* 3. Animated Conic Gradient Border Glow */}
          <div className="absolute -inset-[2px] rounded-[1.2rem] bg-[conic-gradient(from_0deg,transparent_0_340deg,#00df81_360deg)] animate-[spin_4s_linear_infinite] opacity-50 blur-[2px]"></div>
          <div className="absolute -inset-[2px] rounded-[1.2rem] bg-[conic-gradient(from_180deg,transparent_0_340deg,#00df81_360deg)] animate-[spin_4s_linear_infinite] opacity-50 blur-[2px]"></div>

          {/* Tool UI Mockup Container */}
          <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0c]/80 shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] p-6 md:p-8 backdrop-blur-2xl overflow-hidden group">
            
            {/* 4. Sweeping Glare Reflection */}
            <motion.div 
              className="absolute inset-0 w-[200%] h-[200%] bg-gradient-to-tr from-transparent via-white/5 to-transparent -rotate-45 pointer-events-none"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            />

            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#00df81]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

            {/* Header */}
            <div className="mb-8 flex items-center justify-between relative z-10">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00df81] animate-pulse shadow-[0_0_12px_rgba(0,223,129,0.9)]"></span>
                  Find Link Placement
                </h1>
                <p className="text-zinc-500 text-xs">
                  Analyze thousands of pages instantly.
                </p>
              </div>
              
              {/* Tabs */}
              <div className="flex bg-[#000000]/50 border border-white/5 rounded-lg p-1 backdrop-blur-md">
                <button className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'single' ? 'bg-[#222226] text-white shadow-sm border border-white/10' : 'text-zinc-500 border border-transparent'}`}>
                  Single URL
                </button>
                <button className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'bulk' ? 'bg-[#222226] text-white shadow-sm border border-white/10' : 'text-zinc-500 border border-transparent'}`}>
                  Bulk CSV
                </button>
              </div>
            </div>

            {/* Form Area */}
            <div className="relative min-h-[360px] z-10">
              <AnimatePresence mode="wait">
                
                {/* -------------------- SINGLE FLOW -------------------- */}
                {activeTab === 'single' && (
                  sequenceStep >= 6 ? (
                    // RESULT VIEW
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
                      className="absolute inset-0 flex flex-col justify-center"
                    >
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 text-[#00df81] mb-6 justify-center">
                          <div className="relative">
                            <div className="absolute inset-0 bg-[#00df81] blur-md opacity-60 rounded-full animate-pulse"></div>
                            <CheckCircle2 className="w-8 h-8 relative z-10 bg-black rounded-full" />
                          </div>
                          <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">Placement Secured</h3>
                        </div>
                        
                        <motion.div 
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="bg-[#0c0c0e]/80 backdrop-blur-xl border border-[#00df81]/40 rounded-xl p-6 shadow-[0_0_40px_rgba(0,223,129,0.15)] relative overflow-hidden"
                        >
                          {/* Shimmer effect */}
                          <motion.div 
                            className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12"
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                          />

                          <div className="flex items-center justify-between mb-5 pb-5 border-b border-white/5 relative z-10">
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                              <Globe className="w-4 h-4 text-[#00df81]" />
                              <span className="font-mono">techcrunch.com/2026/saas-growth</span>
                            </div>
                            <div className="flex items-center gap-2 bg-[#00df81]/10 border border-[#00df81]/30 px-2 py-1 rounded-md shadow-[0_0_10px_rgba(0,223,129,0.1)]">
                              <span className="text-[10px] uppercase text-zinc-400 font-bold">Domain Authority</span>
                              <span className="text-xs font-bold text-[#00df81] drop-shadow-[0_0_5px_rgba(0,223,129,0.5)]">92</span>
                            </div>
                          </div>
                          
                          <div className="text-[15px] text-zinc-300 leading-relaxed font-serif relative z-10">
                            <span className="text-zinc-600 opacity-60">"...businesses are realizing that scaling requires more than just marketing. "</span>
                            To truly understand user retention, companies must rely on the <span className="relative inline-block group cursor-pointer mx-1">
                              <span className="relative z-10 bg-[#00df81]/20 text-[#00df81] font-semibold px-2 py-0.5 rounded shadow-[0_0_15px_rgba(0,223,129,0.3)]">best SaaS analytics</span>
                              <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#00df81] shadow-[0_0_10px_rgba(0,223,129,1)]"></span>
                            </span> platforms that provide deep insights into product usage.
                            <span className="text-zinc-600 opacity-60">" Without these tools, churn rates can easily spiral out of control..."</span>
                          </div>

                          <div className="mt-5 pt-5 border-t border-white/5 flex items-center text-xs text-zinc-500 gap-2 relative z-10">
                            <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                            Dest: <span className="text-zinc-300 bg-black/50 border border-white/5 px-2 py-0.5 rounded font-mono">https://yoursaas.com</span>
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  ) : sequenceStep >= 5 ? (
                    // LOADING VIEW
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col justify-center px-4"
                    >
                      {/* Animated Radar/Brain in background */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} className="w-64 h-64 rounded-full border-[1.5px] border-dashed border-[#00df81]" />
                        <motion.div animate={{ rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} className="absolute w-48 h-48 rounded-full border border-[#00df81]" />
                        <div className="absolute w-2 h-2 bg-[#00df81] rounded-full shadow-[0_0_20px_rgba(0,223,129,1)] animate-ping"></div>
                      </div>

                      <div className="space-y-6 relative z-10 max-w-md mx-auto w-full backdrop-blur-[2px]">
                        {LOADING_STEPS.map((stepText, idx) => {
                          const isActive = idx === loadingStep;
                          const isDone = idx < loadingStep;
                          return (
                            <motion.div 
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center gap-4 text-[15px] font-medium transition-colors duration-500 ${
                                (isActive || isDone) ? 'text-white' : 'text-zinc-600'
                              }`}
                            >
                              <div className="shrink-0 relative">
                                {(isDone || isActive) ? (
                                  <div className="relative">
                                    <CheckCircle2 className={`w-5 h-5 ${(isActive || isDone) ? 'text-[#00df81]' : ''}`} />
                                    {isActive && <div className="absolute inset-0 rounded-full bg-[#00df81]/50 blur-[8px] animate-pulse" />}
                                  </div>
                                ) : <Circle className="w-5 h-5 opacity-20" />}
                              </div>
                              <span className={`${isActive ? 'animate-pulse text-[#00df81] drop-shadow-[0_0_10px_rgba(0,223,129,0.6)]' : ''}`}>{stepText}</span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    // FORM VIEW
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      className="space-y-6 absolute inset-0"
                    >
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          Target Domain
                          {sequenceStep === 1 && <span className="w-1.5 h-1.5 rounded-full bg-[#00df81] animate-pulse shadow-[0_0_5px_rgba(0,223,129,0.5)]"></span>}
                        </label>
                        <div className="relative flex items-center group">
                          <div className={`absolute inset-0 rounded-lg transition-all duration-300 opacity-0 ${sequenceStep === 1 ? 'opacity-100 bg-[#00df81]/15 blur-md' : ''}`}></div>
                          <Globe className={`absolute left-3 w-4 h-4 z-10 transition-colors ${sequenceStep === 1 ? 'text-[#00df81]' : 'text-zinc-500'}`} />
                          <div className={`w-full bg-[#000000]/60 backdrop-blur-md border rounded-lg py-3 pl-10 pr-4 text-sm min-h-[46px] flex items-center z-10 transition-all duration-300 ${sequenceStep === 1 ? 'border-[#00df81]/60 text-white shadow-[0_0_20px_rgba(0,223,129,0.15)]' : 'border-white/10 text-zinc-300'}`}>
                            {domainText || <span className="text-zinc-600">e.g. example.com</span>}
                            {sequenceStep === 1 && <span className="w-0.5 h-4 bg-[#00df81] animate-pulse ml-0.5 shadow-[0_0_8px_rgba(0,223,129,1)]"></span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            Primary Anchor
                            {sequenceStep === 2 && <span className="w-1.5 h-1.5 rounded-full bg-[#00df81] animate-pulse shadow-[0_0_5px_rgba(0,223,129,0.5)]"></span>}
                          </label>
                          <div className="relative flex items-center">
                            <div className={`absolute inset-0 rounded-lg transition-all duration-300 opacity-0 ${sequenceStep === 2 ? 'opacity-100 bg-[#00df81]/15 blur-md' : ''}`}></div>
                            <Anchor className={`absolute left-3 w-4 h-4 z-10 transition-colors ${sequenceStep === 2 ? 'text-[#00df81]' : 'text-zinc-500'}`} />
                            <div className={`w-full bg-[#000000]/60 backdrop-blur-md border rounded-lg py-3 pl-10 pr-4 text-sm min-h-[46px] flex items-center z-10 transition-all duration-300 ${sequenceStep === 2 ? 'border-[#00df81]/60 text-white shadow-[0_0_20px_rgba(0,223,129,0.15)]' : 'border-white/10 text-zinc-300'}`}>
                              {anchorText || <span className="text-zinc-600">e.g. best SEO tools</span>}
                              {sequenceStep === 2 && <span className="w-0.5 h-4 bg-[#00df81] animate-pulse ml-0.5 shadow-[0_0_8px_rgba(0,223,129,1)]"></span>}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            Destination URL
                            {sequenceStep === 3 && <span className="w-1.5 h-1.5 rounded-full bg-[#00df81] animate-pulse shadow-[0_0_5px_rgba(0,223,129,0.5)]"></span>}
                          </label>
                          <div className="relative flex items-center">
                            <div className={`absolute inset-0 rounded-lg transition-all duration-300 opacity-0 ${sequenceStep === 3 ? 'opacity-100 bg-[#00df81]/15 blur-md' : ''}`}></div>
                            <LinkIcon className={`absolute left-3 w-4 h-4 z-10 transition-colors ${sequenceStep === 3 ? 'text-[#00df81]' : 'text-zinc-500'}`} />
                            <div className={`w-full bg-[#000000]/60 backdrop-blur-md border rounded-lg py-3 pl-10 pr-4 text-sm min-h-[46px] flex items-center z-10 transition-all duration-300 ${sequenceStep === 3 ? 'border-[#00df81]/60 text-white shadow-[0_0_20px_rgba(0,223,129,0.15)]' : 'border-white/10 text-zinc-300'}`}>
                              {urlText || <span className="text-zinc-600">https://...</span>}
                              {sequenceStep === 3 && <span className="w-0.5 h-4 bg-[#00df81] animate-pulse ml-0.5 shadow-[0_0_8px_rgba(0,223,129,1)]"></span>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Alternate Anchor Text <span className="lowercase text-zinc-600 font-normal">(optional)</span></label>
                        <div className="relative flex items-center">
                          <FileText className="absolute left-3 w-4 h-4 text-zinc-500" />
                          <div className="w-full bg-[#000000]/60 backdrop-blur-md border border-white/5 rounded-lg py-3 pl-10 pr-4 text-sm text-zinc-400 min-h-[46px] flex items-center">
                            <span className="text-zinc-600">e.g. SEO software, ranking tools</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 relative z-20">
                        <motion.button 
                          animate={{ 
                            backgroundColor: sequenceStep === 4 ? "#d4d4d8" : "#ffffff", 
                            scale: sequenceStep === 4 ? 0.96 : 1,
                            boxShadow: sequenceStep === 4 ? "0 0 40px rgba(0,223,129,0.6)" : "0 4px 14px rgba(255,255,255,0.1)"
                          }}
                          className="w-full py-4 rounded-lg text-black font-extrabold text-[15px] flex items-center justify-center gap-2 transition-all relative overflow-hidden group"
                        >
                          <Sparkles className={`w-5 h-5 transition-transform ${sequenceStep === 4 ? 'scale-125 text-[#00df81]' : ''}`} />
                          Find Best Placement
                          {sequenceStep === 4 && (
                            <motion.div 
                              className="absolute inset-0 bg-[#00df81]/30"
                              initial={{ opacity: 0.8, scale: 0 }}
                              animate={{ opacity: 0, scale: 2.5 }}
                              transition={{ duration: 0.6 }}
                            />
                          )}
                          <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-black/10 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100 animate-[shiny-text_2s_infinite]"></div>
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                )}

                {/* -------------------- BULK FLOW -------------------- */}
                {activeTab === 'bulk' && (
                  sequenceStep >= 11 ? (
                    // BULK RESULT VIEW
                    <motion.div
                      key="bulk-result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
                      className="absolute inset-0 flex flex-col justify-center"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <div className="absolute inset-0 bg-[#00df81] blur-md opacity-50 rounded-full animate-pulse"></div>
                            <CheckCircle2 className="w-5 h-5 text-[#00df81] relative z-10" />
                          </div>
                          <h3 className="text-lg font-bold text-white drop-shadow-sm">Bulk Process Complete</h3>
                        </div>
                        <span className="text-xs font-bold text-[#00df81] bg-[#00df81]/15 px-2 py-1 rounded shadow-[0_0_10px_rgba(0,223,129,0.2)]">142/142 Successful</span>
                      </div>
                      
                      <div className="bg-[#0c0c0e]/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-inner flex-1 mb-4">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-black/40 text-zinc-400 text-xs uppercase border-b border-white/10">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Domain</th>
                              <th className="px-4 py-3 font-semibold">Anchor</th>
                              <th className="px-4 py-3 text-right font-semibold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-zinc-300">
                            <tr className="bg-[#00df81]/10">
                              <td className="px-4 py-3 font-mono text-xs">forbes.com</td>
                              <td className="px-4 py-3 font-medium text-white">best saas</td>
                              <td className="px-4 py-3 text-right text-[#00df81] flex items-center justify-end gap-1 font-semibold"><CheckCircle2 className="w-3 h-3"/> Found</td>
                            </tr>
                            <tr className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs">wired.com</td>
                              <td className="px-4 py-3 text-zinc-300">top analytics</td>
                              <td className="px-4 py-3 text-right text-[#00df81] flex items-center justify-end gap-1 font-semibold"><CheckCircle2 className="w-3 h-3"/> Found</td>
                            </tr>
                            <tr className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs">techcrunch.com</td>
                              <td className="px-4 py-3 text-zinc-300">growth tools</td>
                              <td className="px-4 py-3 text-right text-[#00df81] flex items-center justify-end gap-1 font-semibold"><CheckCircle2 className="w-3 h-3"/> Found</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 font-mono text-xs text-zinc-600">...139 more</td>
                              <td className="px-4 py-3 text-zinc-600"></td>
                              <td className="px-4 py-3"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <motion.button 
                        animate={{ 
                          backgroundColor: sequenceStep === 12 ? "#00df81" : "#ffffff",
                          color: sequenceStep === 12 ? "#fff" : "#000",
                          scale: sequenceStep === 12 ? 0.96 : 1,
                          boxShadow: sequenceStep === 12 ? "0 0 30px rgba(0,223,129,0.5)" : "0 4px 14px rgba(255,255,255,0.1)"
                        }}
                        className="w-full py-3.5 rounded-lg font-extrabold text-[15px] flex items-center justify-center gap-2 transition-all relative overflow-hidden"
                      >
                        {sequenceStep === 12 ? <CheckCircle2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                        {sequenceStep === 12 ? "Exported Successfully!" : "Export CSV Results"}
                      </motion.button>
                    </motion.div>

                  ) : sequenceStep >= 10 ? (
                    // BULK LOADING VIEW
                    <motion.div
                      key="bulk-loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col justify-center px-4"
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                        <motion.div animate={{ rotate: 360, scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="w-72 h-72 rounded-xl border-2 border-[#00df81] rotate-45 shadow-[0_0_30px_rgba(0,223,129,0.4)]" />
                      </div>
                      <div className="space-y-6 relative z-10 max-w-md mx-auto w-full backdrop-blur-[2px]">
                        {BULK_LOADING_STEPS.map((stepText, idx) => {
                          const isActive = idx === loadingStep;
                          const isDone = idx < loadingStep;
                          return (
                            <motion.div 
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`flex items-center gap-4 text-[15px] font-medium transition-colors duration-500 ${
                                (isActive || isDone) ? 'text-white' : 'text-zinc-600'
                              }`}
                            >
                              <div className="shrink-0 relative">
                                {(isDone || isActive) ? (
                                  <div className="relative">
                                    <CheckCircle2 className={`w-5 h-5 ${(isActive || isDone) ? 'text-[#00df81]' : ''}`} />
                                    {isActive && <div className="absolute inset-0 rounded-full bg-[#00df81]/50 blur-[8px] animate-pulse" />}
                                  </div>
                                ) : <Circle className="w-5 h-5 opacity-20" />}
                              </div>
                              <span className={`${isActive ? 'animate-pulse text-[#00df81] drop-shadow-[0_0_10px_rgba(0,223,129,0.6)]' : ''}`}>{stepText}</span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    // BULK FORM VIEW
                    <motion.div
                      key="bulk-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute inset-0 flex flex-col"
                    >
                      {sequenceStep < 8 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl bg-black/40 backdrop-blur-sm transition-colors relative group">
                          <div className="absolute inset-0 bg-[#00df81]/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-[#00df81]/15 group-hover:scale-110 transition-all shadow-lg">
                            <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-[#00df81] transition-colors" />
                          </div>
                          <h3 className="text-white font-bold mb-1">Drag & Drop your CSV</h3>
                          <p className="text-zinc-500 text-sm">Target Domain, Anchor, Destination URL</p>
                        </div>
                      ) : (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }} 
                          animate={{ scale: 1, opacity: 1 }} 
                          className="flex-1 flex flex-col items-center justify-center border border-[#00df81]/40 rounded-xl bg-[#00df81]/10 relative shadow-[0_0_30px_rgba(0,223,129,0.15),inset_0_0_20px_rgba(0,223,129,0.1)] backdrop-blur-md"
                        >
                          <div className="w-16 h-16 rounded-full bg-[#00df81]/20 flex items-center justify-center mb-4 relative shadow-[0_0_15px_rgba(0,223,129,0.3)]">
                            <FileText className="w-8 h-8 text-[#00df81]" />
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                              <CheckCircle2 className="w-6 h-6 text-black bg-[#00df81] rounded-full absolute -bottom-1 -right-1 border-2 border-[#121214]" />
                            </motion.div>
                          </div>
                          <h3 className="text-white font-bold mb-1 drop-shadow-sm">link-targets.csv</h3>
                          <p className="text-[#00df81] text-sm font-medium">Ready to process 142 rows</p>
                        </motion.div>
                      )}

                      <div className="pt-6 relative z-20">
                        <motion.button 
                          animate={{ 
                            backgroundColor: sequenceStep === 9 ? "#d4d4d8" : "#ffffff", 
                            scale: sequenceStep === 9 ? 0.96 : 1,
                            boxShadow: sequenceStep === 9 ? "0 0 40px rgba(0,223,129,0.6)" : "0 4px 14px rgba(255,255,255,0.1)"
                          }}
                          className={`w-full py-4 rounded-lg text-black font-extrabold text-[15px] flex items-center justify-center gap-2 transition-all relative overflow-hidden ${sequenceStep < 8 ? 'bg-zinc-700 opacity-50 cursor-not-allowed text-zinc-400' : 'bg-white'}`}
                        >
                          <Sparkles className={`w-5 h-5 ${sequenceStep >= 8 ? 'text-black' : ''}`} />
                          Process Bulk Placements
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                )}

              </AnimatePresence>
            </div>
          </div>

          {/* Simulated Mouse Cursor with Ripple */}
          <motion.div
            className="absolute z-50 pointer-events-none drop-shadow-2xl"
            animate={{
              x: cursorPos.x,
              y: cursorPos.y,
              opacity: cursorPos.opacity,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 120,
              mass: 0.5
            }}
          >
            {/* Click Ripples */}
            {ripples.map(ripple => (
              <motion.div
                key={ripple.id}
                initial={{ opacity: 0.8, scale: 0 }}
                animate={{ opacity: 0, scale: 4 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute top-0 left-0 w-8 h-8 border-2 border-white/50 rounded-full bg-white/10 -translate-x-1/4 -translate-y-1/4"
              />
            ))}
            
            {/* Custom SVG Mac Cursor */}
            <motion.div animate={{ scale: cursorScale }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
              <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
                <path d="M11.3934 26.6025L6.62128 4.29369C6.31481 2.86088 7.78168 1.63935 9.10825 2.22384L28.1678 10.617C29.4754 11.1929 29.5303 13.045 28.261 13.7226L19.5029 18.3976C19.2325 18.542 19.0116 18.769 18.8732 19.0435L14.4073 27.9022C13.7431 29.2198 11.7583 28.3086 11.3934 26.6025Z" fill="black" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </motion.div>
          </motion.div>
          
        </motion.div>
      </div>
    </section>
  )
}
