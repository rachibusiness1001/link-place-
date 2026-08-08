"use strict";
const express = require("express");
const router = express.Router();

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

// Helper: fetch a URL silently with a strict timeout
async function silentFetch(url, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const r = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    return { html: await r.text(), ok: r.ok };
  } catch {
    return { html: "", ok: false };
  }
}

function isContentUrl(url) {
  // Simple check to ensure it's not an obvious asset or admin page
  const lower = url.toLowerCase();
  if (lower.match(/\.(jpg|jpeg|png|gif|svg|pdf|css|js|xml|json)$/)) return false;
  if (lower.includes("/wp-admin/") || lower.includes("/wp-includes/")) return false;
  return true;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

router.post("/api/find-anchor", async (req, res) => {
  const { websiteUrl, anchorText } = req.body;

  if (!websiteUrl || !anchorText) {
    return res.status(400).json({ error: "websiteUrl and anchorText are required" });
  }

  let baseUrl = "";
  try {
    const parsed = new URL(websiteUrl.startsWith("http") ? websiteUrl : "https://" + websiteUrl);
    baseUrl = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return res.status(400).json({ error: "Invalid website URL" });
  }

  const foundArticles = new Set();
  const LIMIT = 10; // Only need up to 10 articles as per requirements

  // Step 1: Find URLs via sitemap or RSS
  const sitemapUrls = [];
  const sitemapCandidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/post-sitemap.xml`,
    `${baseUrl}/rss.xml`,
    `${baseUrl}/feed`
  ];

  for (const sitemapUrl of sitemapCandidates) {
    if (sitemapUrls.length >= 300) break;
    const { html, ok } = await silentFetch(sitemapUrl, 10000);
    if (!ok || !html) continue;

    // Fast regex to extract all URLs from XML
    const locMatches = html.match(/<loc>(.*?)<\/loc>/g) || [];
    const linkMatches = html.match(/<link>(.*?)<\/link>/g) || [];
    const allMatches = [...locMatches, ...linkMatches];
    
    for (const m of allMatches) {
      const url = m.replace(/<[^>]+>/g, "").trim();
      if (url && url.startsWith("http") && isContentUrl(url)) {
        sitemapUrls.push(url);
      }
      
      // If it's a nested sitemap, optionally fetch it (limited to avoid huge overhead)
      if (url.endsWith(".xml") && sitemapUrls.length < 300) {
        const nested = await silentFetch(url, 5000);
        if (nested.ok) {
           const nestedLocs = nested.html.match(/<loc>(.*?)<\/loc>/g) || [];
           for (const nl of nestedLocs) {
             const nUrl = nl.replace(/<[^>]+>/g, "").trim();
             if (nUrl && nUrl.startsWith("http") && isContentUrl(nUrl)) sitemapUrls.push(nUrl);
           }
        }
      }
    }
  }

  // Fallback to homepage links if no sitemaps worked
  if (sitemapUrls.length === 0) {
    const { html } = await silentFetch(baseUrl, 8000);
    if (html) {
      const hrefMatches = html.match(/href="([^"#?]+)"/g) || [];
      for (const m of hrefMatches) {
        const href = m.replace(/href="|"/g, "").trim();
        let fullUrl = href;
        if (href.startsWith("/")) fullUrl = baseUrl + href;
        if (fullUrl.startsWith("http") && isContentUrl(fullUrl)) sitemapUrls.push(fullUrl);
      }
    }
  }

  const uniqueUrls = [...new Set(sitemapUrls)];

  if (uniqueUrls.length === 0) {
    return res.status(200).json({ articles: [] }); // Explicitly return empty array for frontend handling
  }

  // Step 2: Search for the exact anchor text inside the pages
  const batchSize = 10;
  const fastSearchRegex = new RegExp(`\\b${escapeRegExp(anchorText)}\\b`, "i");

  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    if (foundArticles.size >= LIMIT) break; // Stop early if we have 10

    const batch = uniqueUrls.slice(i, i + batchSize);
    
    const results = await Promise.allSettled(batch.map(async (url) => {
      const { html, ok } = await silentFetch(url, 6000);
      if (!ok || !html) return null;
      
      // Strip out scripts and styles to avoid false positives in code
      let cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
      cleanText = cleanText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
      cleanText = cleanText.replace(/<[^>]+>/g, ' '); // strip all tags
      
      if (fastSearchRegex.test(cleanText)) {
        return url;
      }
      return null;
    }));

    for (const res of results) {
      if (res.status === "fulfilled" && res.value) {
        foundArticles.add(res.value);
        if (foundArticles.size >= LIMIT) break;
      }
    }
  }

  return res.status(200).json({
    articles: Array.from(foundArticles).slice(0, LIMIT)
  });
});

module.exports = router;
