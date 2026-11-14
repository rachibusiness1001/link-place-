"use strict";

/**
 * Listicle Finder Route — POST /api/listicle-finder
 * Finds listicle-style articles on a target website using Sitemap/RSS/Crawl + Regex + DeepSeek AI.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const { findListiclesForWebsite } = require("../utils/listicleFinder");

const router = express.Router();

// Basic rate limiting per user / IP
const listicleLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 10, // max 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many Listicle Finder scans. Please wait a minute before scanning again.",
  },
});

const inFlightScans = new Map();

router.post("/", listicleLimiter, async (req, res) => {
  const rawUrl = (req.body?.websiteUrl || req.body?.url || req.body?.domain || "").trim();
  const bypassCache = Boolean(req.body?.bypassCache);

  if (!rawUrl) {
    return res.status(400).json({
      error: "Please enter a valid website URL (e.g. https://example.com).",
    });
  }

  const key = rawUrl.toLowerCase();

  try {
    let scanPromise;
    if (!bypassCache && inFlightScans.has(key)) {
      scanPromise = inFlightScans.get(key);
    } else {
      scanPromise = findListiclesForWebsite(rawUrl, { bypassCache }).finally(() => {
        inFlightScans.delete(key);
      });
      inFlightScans.set(key, scanPromise);
    }

    const result = await scanPromise;
    return res.status(200).json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message || "Failed to scan website for listicle articles. Please try again.",
    });
  }
});

module.exports = router;
