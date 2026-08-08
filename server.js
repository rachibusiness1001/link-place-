/**
 * LinkPlace v3 — AI Keyword Generation + Better Search
 */
"use strict";
const express = require("express");
const path = require("path");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const cors = require("cors");
const fs = require("fs");
if (!process.env.ANTHROPIC_API_KEY || !process.env.SERPAPI_KEY) {
  console.error("CRITICAL: Missing ANTHROPIC_API_KEY or SERPAPI_KEY in environment");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
app.use(cors()); // Allow all origins since frontend is on Vercel
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

const anchorHuntRoute = require('./src/routes/anchorHunt');
app.use('/', anchorHuntRoute);

const placementNormalRoute = require('./src/routes/placementNormal');
app.use('/api/analyze-normal', placementNormalRoute);

const placementBrandedRoute = require('./src/routes/placementBranded');
app.use('/api/analyze-branded', placementBrandedRoute);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
});
app.use("/api/analyze", limiter);

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 500 });
const inFlight = new Map();

const DOMAIN_RE = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
const URL_RE = /^https?:\/\/.+/;

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateInputs(domain, anchor, linkto) {
  if (!domain || !anchor || !linkto) return "domain, anchor, and linkto are required";
  if (domain.length > 120) return "domain too long (max 120 chars)";
  if (anchor.length > 250) return "anchor text too long (max 250 chars)";
  if (linkto.length > 500) return "linkto URL too long (max 500 chars)";
  if (!DOMAIN_RE.test(domain)) return "invalid domain format (e.g. example.com)";
  if (!URL_RE.test(linkto)) return "linkto must be a valid URL starting with http:// or https://";
  return null;
}

const INDEX_SEGMENTS = new Set([
  "blog", "blogs", "category", "categories", "tag", "tags", "author", "authors",
  "news", "resources", "topics", "archive", "page", "feed", "rss", "sitemap",
  "search", "wp-content", "wp-includes",
]);
const SKIP_PREFIXES = [
  "/pricing", "/about", "/contact", "/login", "/signup", "/register",
  "/cart", "/checkout", "/account", "/terms", "/privacy", "/faq",
  "/support", "/demo", "/features", "/product", "/plans", "/free-trial",
  "/alternatives", "/404", "/cdn-cgi", "/wp-admin", "/wp-login",
  "/sitemap", "/feed", "/rss", "/amp/",
];

// Blog path indicators — URL must contain one of these to qualify
const BLOG_PATH_INDICATORS = [
  "/blog/", "/blogs/", "/post/", "/posts/", "/article/", "/articles/",
  "/news/", "/insights/", "/resources/", "/learn/", "/guide/", "/guides/",
  "/journal/", "/editorial/", "/content/", "/stories/", "/story/",
  "/tips/", "/advice/", "/howto/", "/how-to/", "/tutorial/", "/tutorials/",
];

function isContentUrl(url) {
  try {
    const parsed = new URL(url);
    const urlPath = parsed.pathname.replace(/\/$/, "");
    if (!urlPath || urlPath === "/") return false;
    
    const skipPrefixes = ["/tag/", "/category/", "/author/", "/search/", "/page/", "/topics/"];
    if (skipPrefixes.some(p => urlPath.toLowerCase().startsWith(p))) return false;
    
    const rejectWords = ["about", "contact", "login", "register", "signup", "signin", "privacy", "terms", "policy", "cart", "checkout", "pricing"];
    const segments = urlPath.split("/").filter(Boolean);
    if (segments.length === 0) return false;
    
    if (segments.length === 1 && rejectWords.includes(segments[0].toLowerCase())) return false;
    if (urlPath.match(/\.(jpg|png|gif|svg|pdf|css|js|xml)$/i)) return false;
    
    return true;
  } catch(e) {
    return false;
  }
}

function isArticleUrl(url) {
  try {
    const parsed = new URL(url);
    const urlPath = parsed.pathname.replace(/\/$/, "");
    if (!urlPath || urlPath === "/") return false;
    if (SKIP_PREFIXES.some((p) => urlPath.toLowerCase().startsWith(p))) return false;

    const segments = urlPath.split("/").filter(Boolean);
    if (segments.length === 1 && INDEX_SEGMENTS.has(segments[0].toLowerCase())) return false;
    if (/\/page\/\d+/.test(urlPath) || /\/\d+$/.test(urlPath)) return false;

    const meaningful = segments.filter((s) => !INDEX_SEGMENTS.has(s.toLowerCase()));
    if (meaningful.length === 0) return false;
    if (/^\d{4}$/.test(segments[segments.length - 1])) return false;

    const lowerPath = urlPath.toLowerCase();
    const isBlogPath = BLOG_PATH_INDICATORS.some((indicator) => lowerPath.includes(indicator));

    if (isBlogPath) {
      // Strict validation for confirmed blog-path URLs (unchanged)
      const blogSegIdx = segments.findIndex((s) =>
        ["blog", "blogs", "article", "articles", "post", "posts", "news", "insights",
         "resources", "learn", "guide", "guides", "tips", "tutorial", "tutorials"].includes(s.toLowerCase())
      );
      if (blogSegIdx !== -1) {
        const afterBlog = segments.slice(blogSegIdx + 1).filter(Boolean);
        if (afterBlog.length === 0) return false;
        const slug = afterBlog[afterBlog.length - 1];
        if (/\*/.test(slug)) return false;
        if (/^\d+$/.test(slug)) return false;
        if (slug.length < 5) return false;
      } else {
        const slug = segments[segments.length - 1];
        if (/\*/.test(slug) || /^\d+$/.test(slug) || slug.length < 5) return false;
      }
      return true;
    } else {
      // ✅ NEW: No blog-path prefix — common on flat-URL sites like ipwithease.com
      // (root-level WordPress slugs). Apply slug-quality heuristics instead of
      // hard-rejecting: single-segment, long slug, multiple hyphen-separated words.
      if (segments.length !== 1) return false;
      const slug = segments[0];
      if (/\*/.test(slug) || /^\d+$/.test(slug)) return false;
      if (slug.length < 8) return false;
      // e.g. "about-us" (2 words) → rejected; "ids-ips-in-cloud-environments" (5 words) → accepted
      const wordCount = slug.split("-").filter(Boolean).length;
      if (wordCount < 3) return false;
      return true;
    }
  } catch { return false; }
}


const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "can", "how", "what", "why", "when", "where", "which",
  "that", "this", "these", "those", "it", "its", "use", "using", "used",
  "get", "got", "make", "made", "also", "just", "more", "most", "some",
  "all", "any", "each", "both", "few", "very", "so", "than", "then", "too",
]);

function extractKeywordsLocal(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

// ─── AI Keyword Generation ─────────────────────────────────────────────────────
async function generateKeywordsWithAI(anchor, linkto, linktoInfo = null, isBranded = false) {
  console.log(`[KEYWORDS] Generating AI keywords for anchor="${anchor}" linkto="${linkto}" isBranded=${isBranded}`);
  try {
    const brandedInstructions = isBranded
      ? "\nBRANDED ANCHOR MODE: The anchor is just a brand/company name. IGNORE the brand name itself. Generate keywords SOLELY based on the Target Page topic (e.g., what the company does, or what the software is). We want to find articles discussing this underlying topic."
      : "\nContext: Understand the company/product from the Target Page information above. If the anchor is just a company name, generate keywords based on what the company ACTUALLY DOES (e.g. email security, dmarc, revenue intelligence).";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        temperature: 0.2,
        system: "You are an SEO keyword expert. Return ONLY a comma-separated list of keywords. No explanation, no numbering, no extra text.",
        messages: [{
          role: "user",
          content: `Generate 10-12 semantic search keywords for finding blog articles where this anchor text would naturally fit.
Anchor: "${anchor}"
Target Page URL: ${linkto}
Target Page Title: ${linktoInfo?.title || ''}
Target Page Snippet: ${linktoInfo?.snippet || ''}
${brandedInstructions}
Rules:
- Include related concepts, synonyms, industry terms
- Include both broad and specific terms
- Keywords should help find informational blog articles
- Return ONLY comma-separated keywords`,
        }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    console.log(`[KEYWORDS] AI generated: ${text}`);

    const aiKeywords = text.split(",").map((k) => k.trim().toLowerCase()).filter((k) => k.length > 2 && !STOP_WORDS.has(k));
    const localKeywords = extractKeywordsLocal(anchor);

    // Merge AI + local, deduplicated
    const merged = [...new Set([...localKeywords, ...aiKeywords])];
    console.log(`[KEYWORDS] Final merged (${merged.length}): ${merged.join(", ")}`);
    return merged;
  } catch (err) {
    console.log(`[KEYWORDS] AI failed, falling back to local: ${err.message}`);
    return extractKeywordsLocal(anchor);
  }
}

// ─── Multi-Anchor Variation Generation ─────────────────────────────────────────
async function generateAnchorVariations(originalAnchor) {
  console.log(`[VARIATIONS] Generating 5 semantic anchor variations for "${originalAnchor}"`);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        temperature: 0.3,
        system: "You are an SEO expert. Return ONLY a JSON array of exactly 5 strings, nothing else. No explanation, no backticks.",
        messages: [{
          role: "user",
          content: `Given this exact anchor text: "${originalAnchor}", generate exactly 5 close, natural, highly relevant alternative anchor phrases (synonyms, semantic variations, or closely related phrasing) that mean almost the same thing and could be used as anchor text for the exact same topic.
          
Do NOT generate keywords about unrelated topics. Every single phrase MUST be a direct semantic variation or close alternative to "${originalAnchor}".

Return ONLY a valid JSON array of exactly 5 strings, nothing else — no markdown, no explanation.`
        }],
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const cleanJson = text.replace(/^```json\s*|```\s*$/g, "").trim();
    const arr = JSON.parse(cleanJson);
    if (Array.isArray(arr) && arr.length > 0) {
      console.log(`[VARIATIONS] Generated (${arr.length}): ${arr.slice(0, 5).join(", ")}`);
      return arr.slice(0, 5).map(s => String(s).trim()).filter(Boolean);
    }
  } catch (err) {
    console.log(`[VARIATIONS] Failed: ${err.message}`);
  }
  return [];
}

// --- /api/analyze endpoints have been moved to src/routes/placementNormal and src/routes/placementBranded ---

app.post("/api/variations", async (req, res) => {
  const { anchor } = req.body;
  if (!anchor) return res.status(400).json({ error: "Anchor required." });
  try {
    const variations = await generateAnchorVariations(anchor);
    return res.status(200).json({ variations });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/generate-anchor-variations", async (req, res) => {
  const { anchor } = req.body;
  if (!anchor) return res.status(400).json({ error: "Anchor required." });
  try {
    const variations = await generateAnchorVariations(anchor);
    return res.status(200).json({
      original_anchor: anchor,
      variations: variations.length > 0 ? variations : [anchor]
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace v3 running on port ${PORT}`));

module.exports = { app };
