"use client"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"

export function StickyFooter() {
  return (
    <footer className="relative w-full overflow-hidden bg-black border-t border-white/10 pt-16 mt-12 pb-0">
      <div className="relative z-10 w-full flex justify-center md:justify-end px-12 pb-12">
        <div className="flex flex-row space-x-12 sm:space-x-16 md:space-x-24 text-sm sm:text-lg md:text-xl text-white/60">
          <ul className="space-y-2">
            <li className="hover:text-white hover:underline cursor-pointer transition-colors">Home</li>
            <li className="hover:text-white hover:underline cursor-pointer transition-colors">Features</li>
            <li className="hover:text-white hover:underline cursor-pointer transition-colors">Pricing</li>
          </ul>
          <ul className="space-y-2">
            <li className="hover:text-white hover:underline cursor-pointer transition-colors">Testimonials</li>
            <li className="hover:text-white hover:underline cursor-pointer transition-colors">FAQ</li>
            <li className="hover:text-white hover:underline cursor-pointer transition-colors">Contact</li>
          </ul>
        </div>
      </div>
      
      {/* Background Huge Text */}
      <div className="relative w-full h-[25vw] sm:h-[18vw] overflow-hidden flex items-end justify-center pointer-events-none select-none">
        <motion.h2
          className="absolute bottom-[-5%] left-0 right-0 text-center text-[12vw] leading-none font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-t from-white/15 to-transparent whitespace-nowrap"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          MY LINK PLACE
        </motion.h2>
      </div>
    </footer>
  )
}
