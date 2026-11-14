"use client";

import React from "react";
import { motion } from "framer-motion";
import ListicleFinderSection from "@/components/ListicleFinderSection";

export default function ListicleFinderPage() {
  return (
    <motion.div
      className="max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <ListicleFinderSection standalone={true} />
    </motion.div>
  );
}
