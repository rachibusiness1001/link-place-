"use client"

import { motion } from "framer-motion"

// Using premium SaaS brands and publishers as dummy logos
const LOGOS = [
  "Forbes",
  "TechCrunch",
  "Wired",
  "The Verge",
  "Bloomberg",
  "Business Insider",
  "Mashable",
  "Fast Company",
  "Inc.",
  "Entrepreneur"
]

export function InfiniteMarquee() {
  return (
    <div className="py-6 bg-black overflow-hidden relative border-y border-white/5">
      {/* Gradient Masks for fading effect at edges */}
      <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
      <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>

      <div className="container mx-auto px-4 text-center mb-8">
        <p className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">
          Trusted by top-tier publishers & brands
        </p>
      </div>

      <div className="flex relative w-full overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 30,
            ease: "linear",
            repeat: Infinity,
          }}
          className="flex flex-none gap-16 items-center whitespace-nowrap pl-16"
        >
          {/* Double array for seamless loop */}
          {[...LOGOS, ...LOGOS, ...LOGOS].map((logo, index) => (
            <div 
              key={index} 
              className="flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0"
            >
              <span className="text-2xl font-black tracking-tighter text-zinc-300">
                {logo}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
