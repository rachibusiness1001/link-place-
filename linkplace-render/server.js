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
        if (afterBlog.length === 0) return false; // /blogs/ with nothing after = index
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
      if (segments.length !== 1) return false; // multi-segment non-blog paths = likely category/nav structures
      const slug = segments[0];
      if (/\*/.test(slug) || /^\d+$/.test(slug)) return false;
      if (slug.length < 8) return false; // root-level article slugs are typically descriptive/long
      // Must look like a real article slug: at least 3 hyphen-separated words
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

// ─── Extract topic/type from linkto URL ──────────────────────────────────────
async function analyzeLinktoPage(linkto) {
  console.log(`[LINKTO] Analyzing destination URL: ${linkto}`);
  try {
    const { html, status } = await fetchWithRetry(linkto, 1, 8000); // title/meta only needed, 8s is enough
    if (isBlockedPage(html, status)) {
      console.log(`[LINKTO] Blocked, using URL slug only`);
      return extractLinktoFromSlug(linkto);
    }
    const article = extractArticleContent(html, linkto);
    if (!article) return extractLinktoFromSlug(linkto);

    // Get first 1500 chars of content for topic detection
    const snippet = article.textContent.slice(0, 1500).replace(/\s+/g, " ").trim();
    const title = article.title || "";

    // Check if it's a tool/product page
    const toolIndicators = [
      /\b(free trial|start free|get started|sign up|pricing|plans?|features?)\b/i,
      /\b(dashboard|login|register|download|install|api key)\b/i,
      /\b(software|platform|saas|tool|app)\b/i,
    ];
    const isToolPage = toolIndicators.some((re) => re.test(snippet) || re.test(title));

    console.log(`[LINKTO] title="${title.slice(0, 60)}", isToolPage=${isToolPage}`);
    const kws = extractKeywordsLocal(title + " " + snippet).slice(0, 15);
    return { title, snippet, summary: snippet, isToolPage, keywords: kws, aiKeywords: kws };
  } catch (err) {
    console.log(`[LINKTO] Fetch failed: ${err.message}`);
    return extractLinktoFromSlug(linkto);
  }
}

function extractLinktoFromSlug(linkto) {
  try {
    const slug = new URL(linkto).pathname.replace(/\//g, " ").replace(/-/g, " ").trim();
    const toolIndicators = [/\b(tool|software|platform|app|saas)\b/i];
    const isToolPage = toolIndicators.some((re) => re.test(slug));
    const kws = extractKeywordsLocal(slug).slice(0, 10);
    return { title: slug, snippet: slug, summary: slug, isToolPage, keywords: kws, aiKeywords: kws };
  } catch { return { title: "", snippet: "", summary: "", isToolPage: false, keywords: [], aiKeywords: [] }; }
}

function isBlockedPage(html, statusCode) {
  if (statusCode === 403 || statusCode === 429) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes("cf-challenge-running") ||
    lower.includes("cf-turnstile") ||
    lower.includes("enable javascript and cookies to continue") ||
    lower.includes("ddos-guard") ||
    lower.includes("please enable cookies") ||
    (lower.includes("just a moment") && lower.includes("checking your browser"))
  );
}

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

async function fetchWithRetry(url, maxAttempts = 2, timeoutMs = 30000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal, redirect: "follow" });
      const html = await res.text();
      return { html, status: res.status };
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`[FETCH] Attempt ${attempt} failed for ${url}: ${err.message}. Retrying...`);
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
}

async function searchArticles(domain, anchor, keywords, isBranded = false) {
  const phrase = anchor.toLowerCase().trim();
  const queries = isBranded ? [
    `site:${domain} ${keywords.slice(0, 2).join(" ")}`,
    `site:${domain} ${keywords[0] || "software"}`,
    `site:${domain} ${keywords[1] || "tool"}`
  ] : [
    // Single most-important keyword FIRST — broadest, highest chance of results
    `site:${domain} ${keywords[0] || "blog"}`,
    // 2-keyword combo — moderate restriction
    `site:${domain} ${keywords[0] || ""} ${keywords[1] || ""}`,
    // 3-keyword combo — most restrictive, kept as a bonus attempt
    `site:${domain} ${keywords.slice(0, 3).join(" ")}`,
    // Exact anchor phrase LAST — supplementary only
    `site:${domain} "${phrase}"`,
  ];

  const allUrls = new Set();
  const queryTelemetry = [];

  // ✅ PERF FIX: Run ALL queries in PARALLEL (was sequential — caused 2-3 min waits)
  // Timeout reduced from 18s to 8s. All 4 queries now fire simultaneously.
  const queryResults = await Promise.allSettled(
    queries.map(async (query) => {
      console.log(`[SEARCH] Query: ${query}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000); // ✅ PERF: SerpAPI is fast, 6s enough
      try {
        const res = await fetch(
          `https://serpapi.com/search?${new URLSearchParams({ q: query, api_key: process.env.SERPAPI_KEY, engine: "google", num: "10" })}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);

        if (!res.ok) {
          console.log(`[SEARCH] SerpAPI HTTP ${res.status} for: ${query}`);
          return { query, error: `HTTP ${res.status}`, resultCount: 0 };
        }

        const data = await res.json();

        if (data.error) {
          const isZeroResults = /hasn't returned any results|no results found/i.test(data.error);
          if (isZeroResults) {
            console.log(`[SEARCH] Zero results (normal): ${query}`);
            return { query, rawResultCount: 0, isZeroResults: true };
          } else {
            console.log(`[SEARCH] SerpAPI ERROR: ${data.error}`);
            return { query, error: data.error, resultCount: 0, isZeroResults: false };
          }
        }

        const rawResults = data?.organic_results || [];
        const resultCount = rawResults.length;
        const validUrls = rawResults
          .filter(r => r.link && r.link.includes(domain) && isArticleUrl(r.link))
          .map(r => r.link);

        console.log(`[SEARCH] "${query}" → ${resultCount} raw, ${validUrls.length} passed filter`);
        return { query, rawResultCount: resultCount, validUrlCount: validUrls.length, validUrls };

      } catch (err) {
        clearTimeout(timer);
        console.log(`[SEARCH] Query failed: ${err.message}`);
        return { query, error: err.message, resultCount: 0 };
      }
    })
  );

  // Merge results from all parallel queries
  for (const result of queryResults) {
    const data = result.status === "fulfilled" ? result.value : { query: "unknown", error: result.reason?.message || "unknown error", resultCount: 0 };
    queryTelemetry.push(data);
    if (data.validUrls) {
      for (const url of data.validUrls) allUrls.add(url);
    }
  }

  const urls = [...allUrls].slice(0, 6);
  console.log(`[SEARCH] Final URLs (${urls.length}): ${urls.join(", ")}`);
  return { urls, telemetry: queryTelemetry };

}

function extractArticleContent(html, url) {
  try {
    console.log(`[EXTRACT-DEBUG] HTML length for ${url}: ${html.length} chars`);
    console.log(`[EXTRACT-DEBUG] First 300 chars: ${html.slice(0, 300).replace(/\n/g, ' ')}`);

    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    // Remove comment, reply, TOC, sidebar, index, and navigation sections before extraction
    doc.querySelectorAll('[class*="comment" i], [id*="comment" i], [class*="reply" i], [id*="reply" i], [class*="disqus" i], [id*="disqus" i], [class*="toc" i], [id*="toc" i], [class*="table-of-content" i], [id*="table-of-content" i], [class*="sidebar" i], [id*="sidebar" i], [class*="widget" i], [id*="widget" i], [class*="menu" i], [id*="menu" i], [class*="nav" i], [id*="nav" i], [class*="index" i], [id*="index" i], [role="doc-toc" i], [role="navigation" i], [aria-label*="toc" i], [aria-label*="navigation" i], nav, aside, footer, header').forEach((el) => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    // Remove any containers or lists whose heading says Table of Contents, In this article, etc.
    doc.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div, span, strong, b, summary").forEach((h) => {
      const txt = h.textContent.replace(/\s+/g, " ").trim();
      if (/^(table of contents?|contents|in this article|on this page|quick jump|quick links|topics covered|what('s|\s+is)\s+inside|overview)\s*$/i.test(txt)) {
        // ✅ FIX: Removed div[class*='content' i] which was matching the entire article container (e.g. entry-content)
        const wrapper = h.closest("nav, aside, section, details, div[class*='toc' i], div[id*='toc' i], div[class*='table-of-content' i], div[id*='table-of-content' i], div") || h.parentNode;
        if (wrapper && wrapper.parentNode && wrapper !== doc.body && wrapper.textContent.length < 5000) {
          wrapper.parentNode.removeChild(wrapper);
        } else if (h.parentNode) {
          h.parentNode.removeChild(h);
        }
      }
    });
    const reader = new Readability(doc);
    const article = reader.parse();
    if (!article || !article.content || article.textContent.length < 200) {
      // ✅ DIAGNOSTIC: log exactly why extraction failed
      console.log(`[EXTRACT-DEBUG] FAILED for ${url}: article=${!!article}, hasContent=${!!article?.content}, textLength=${article?.textContent?.length || 0}`);
      console.log(`[EXTRACT-DEBUG] Page title tag: ${dom.window.document.title}`);
      return null;
    }
    console.log(`[EXTRACT] ${article.textContent.length} chars, title: "${article.title?.slice(0, 60)}"`);
    return article;
  } catch (err) {
    console.log(`[EXTRACT] Error for ${url}: ${err.message}`);
    return null;
  }
}

function segmentParagraphs(articleHtml) {
  if (!articleHtml) return [];
  try {
    const dom = new JSDOM(articleHtml);
    const doc = dom.window.document;
    const paragraphs = [];
    // Only real prose paragraphs and blockquotes qualify.
    // Ignore any element inside lists (ul, ol, li), TOC, sidebar, menu, or navigation containers.
    doc.querySelectorAll("p, blockquote").forEach((el) => {
      if (el.closest("nav, aside, header, footer, ul, ol, li, [class*='toc' i], [id*='toc' i], [class*='table-of-content' i], [id*='table-of-content' i], [class*='content-list' i], [id*='content-list' i], [class*='sidebar' i], [id*='sidebar' i], [class*='menu' i], [id*='menu' i], [class*='widget' i], [id*='widget' i], [class*='index' i], [id*='index' i], [role='doc-toc' i], [role='navigation' i]")) {
        return;
      }
      const text = el.textContent.replace(/\s+/g, " ").trim();
      const linkCount = el.querySelectorAll("a").length;
      // Must be at least 100 chars, max 3 links, not starting with numbered bullet, and MUST end with sentence punctuation
      if (text.length >= 100 && linkCount <= 3 && !/^\d+[\.\)]\s+/.test(text) && /[.!?]["']?\s*$/.test(text)) {
        paragraphs.push({ text, linkCount });
      }
    });
    return paragraphs;
  } catch (err) {
    console.log(`[SEGMENT] Error: ${err.message}`);
    return [];
  }
}

const NOISE_PATTERNS = [
  /subscribe|newsletter|sign[\s-]?up/i,
  /click here|buy now|get started|free trial|book a demo/i,
  /limited time|exclusive offer|don't miss/i,
  /follow us|share this|leave a comment/i,
  /cookie|privacy policy|terms of service|all rights reserved/i,
  /written by|posted by|about the author|you might also like|read next/i,
  /table of contents|in this article|jump to section|skip to|table of content|toc\b/i,
];

function hasTextCorruption(text) {
  // Detect suspicious mid-word capital letter breaks like "mach Eine" 
  // (lowercase word, space, then a capitalized fragment that isn't starting a new sentence)
  const midWordBreakPattern = /\b[a-z]{2,}\s[A-Z][a-z]{1,4}\b(?!\.|,|\?|!)/g;
  const matches = text.match(midWordBreakPattern) || [];
  
  // Filter out legitimate cases
  const suspiciousMatches = matches.filter(m => {
    const parts = m.split(/\s/);
    return parts[1].length <= 4 && !/^(AI|US|UK|EU|IT|HR|CEO|CTO|API)$/i.test(parts[1]);
  });
  
  return suspiciousMatches.length > 0;
}

function logCorruptionInstance(data) {
  try {
    fs.appendFileSync(path.join(__dirname, "corruption_log.jsonl"), JSON.stringify(data) + "\n");
  } catch(e) {
    console.error("[LOGGING] Failed to log corruption", e);
  }
}

function isQualityParagraph(text, linkCount, isToolTarget = false, domain = "unknown", currentUrl = "unknown") {
  if (text.length < 100) return false;
  if (linkCount > 0) return false; // STAGE A.2: Zero hyperlinks already
  if (!/[.!?]["']?\s*$/.test(text)) return false; // Must be complete sentence(s) ending in punctuation
  if (/^\d+[\.\)]\s+[A-Z]/.test(text) && text.length < 150) return false; // Reject numbered headings / TOC entries
  for (const pattern of NOISE_PATTERNS) { if (pattern.test(text)) return false; } // STAGE A.4: Not promotional/noise
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.25) return false; // STAGE A.6: Not all-caps/heading noise
  if (mentionstool(text)) return false;

  if (hasTextCorruption(text)) {
    console.log(`[CORRUPTION DETECTED] Rejected paragraph due to suspected text extraction error: "${text.slice(0, 100)}..."`);
    logCorruptionInstance({ 
      domain, 
      url: currentUrl, 
      corrupted_snippet: text.slice(0, 150), 
      timestamp: new Date().toISOString() 
    });
    return false;
  }

  return true;
}

function computeTfIdfScore(text, keywords) {
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;
  const freq = {};
  for (const word of lower.split(/\s+/)) { if (word.length > 2) freq[word] = (freq[word] || 0) + 1; }
  let score = 0;
  for (const kw of keywords) {
    if (kw.length < 3) continue;
    const kwFreq = freq[kw] || 0;
    if (kwFreq > 0) { const specificity = Math.min(kw.length / 5, 2.5); score += specificity * (1 + Math.log(kwFreq)); }
  }
  return Math.min(30, (score / Math.sqrt(Math.max(wordCount, 1))) * 15); // STAGE B: Topic relevance (0-30)
}

function scoreParagraph(text, anchor, keywords, isBranded = false) {
  const lower = text.toLowerCase();
  const anchorLower = anchor.toLowerCase();
  let score = 0;

  if (!isBranded) {
    if (lower.includes(anchorLower)) score += 60; // STAGE B: +60 Exact anchor phrase
    else {
      const anchorWords = anchorLower.split(/\s+/).filter((w) => w.length > 3);
      if (anchorWords.length >= 2) {
        const bigrams = [];
        for (let i = 0; i < anchorWords.length - 1; i++) {
          bigrams.push(`${anchorWords[i]} ${anchorWords[i + 1]}`);
        }
        for (const bg of bigrams) {
          if (lower.includes(bg)) score += 20; // STAGE B: +20 Partial/bigram match
        }
      }
    }
  } else {
    score += 40; 
  }

  score += computeTfIdfScore(text, keywords); // STAGE B: +X Topic relevance (0-30)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const wordCount = text.split(/\s+/).length;
  if (sentences.length >= 3 && wordCount >= 80 && wordCount <= 300) score += 15; // STAGE B: +15 Ideal length
  else if (sentences.length >= 2 && wordCount >= 50) score += 8;
  if (wordCount < 40) score -= 15; // STAGE B: -15 Too short under 40 words
  const promoRe = /\b(buy|sale|discount|offer|deal|click|subscribe|download now|sign up|free trial|book a demo)\b/gi;
  score -= (text.match(promoRe) || []).length * 15; // STAGE B: -15 Contains promotional words
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio < 0.1) score += 8;
  else if (capsRatio > 0.2) score -= 10;
  return Math.max(0, score);
}

function rerankWithContext(allParagraphsByUrl, anchor, keywords) {
  const anchorLower = anchor.toLowerCase();
  const result = [];
  for (const [url, paragraphs] of Object.entries(allParagraphsByUrl)) {
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const prevP = paragraphs[i - 1];
      const nextP = paragraphs[i + 1];
      const neighbors = [prevP, nextP].filter(Boolean);
      let contextBonus = 0;
      let neighborRelates = false;
      for (const n of neighbors) {
        if (n.text.toLowerCase().includes(anchorLower)) neighborRelates = true;
        const kwHits = keywords.filter((k) => k.length > 4 && n.text.toLowerCase().includes(k)).length;
        if (kwHits >= 1) neighborRelates = true;
      }
      if (neighborRelates) contextBonus += 10;
      
      const enrichedP = { 
        ...p, 
        score: p.score + contextBonus, 
        url,
        prevText: prevP ? prevP.text : null,
        nextText: nextP ? nextP.text : null 
      };
      result.push(enrichedP);
    }
  }
  return result;
}

function findBestMatch(aiParagraph, allScoredParagraphs) {
  if (!aiParagraph) return null;
  const normAi = aiParagraph.toLowerCase().replace(/\s+/g, " ").trim();
  const exact = allScoredParagraphs.find((p) => p.text.toLowerCase().replace(/\s+/g, " ").trim() === normAi);
  if (exact) return exact;
  const contained = allScoredParagraphs.find((p) => {
    const pNorm = p.text.toLowerCase().replace(/\s+/g, " ").trim();
    return pNorm.includes(normAi.slice(0, 80)) || normAi.includes(pNorm.slice(0, 80));
  });
  if (contained) return contained;
  const aiWords = new Set(normAi.split(/\s+/).filter((w) => w.length > 5));
  let best = { score: 0, p: null };
  for (const p of allScoredParagraphs) {
    const pWords = p.text.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
    const overlap = pWords.filter((w) => aiWords.has(w)).length;
    const ratio = overlap / Math.max(aiWords.size, 1);
    if (ratio > best.score) best = { score: ratio, p };
  }
  if (best.score >= 0.3) return best.p;
  return null;
}

async function analyzeWithAI(paragraphs, anchor, linkto, linktoInfo, isBranded = false) {
  // If linkto is a tool page, skip paragraphs that already mention a tool
  const pool = linktoInfo?.isToolPage
    ? paragraphs.filter((p) => !mentionstool(p.text))
    : paragraphs;

  const finalPool = (pool.length >= 4 ? pool : paragraphs).slice(0, 8); // ✅ PERF: reduced from 12 to 8 — smaller AI input = faster response

  const getTierLabel = (score) => {
    if (score >= 45) return "TIER 1 (STRONG match)";
    if (score >= 25) return "TIER 2 (MODERATE match)";
    return "TIER 3 (LAST RESORT related domain)";
  };

  // ✅ FIX: include previous/next paragraph snippets so Haiku understands 
  // the surrounding narrative flow, not just an isolated paragraph
  const formatParagraphForAI = (p, idx) => {
    const prevSnippet = p.prevText ? p.prevText.slice(0, 80) : "(none)";
    const nextSnippet = p.nextText ? p.nextText.slice(0, 80) : "(none)"; // ✅ PERF: shorter context snippets
    return `[${idx}] (Article: ${p.url}, Score: ${p.score ? p.score.toFixed(1) : 0} — ${getTierLabel(p.score || 0)})
Previous context: "...${prevSnippet}"
PARAGRAPH: ${p.text}
Next context: "${nextSnippet}..."`;
  };

  const paragraphText = finalPool.map((p, i) => formatParagraphForAI(p, i + 1)).join("\n\n---\n\n");

  const linktoBrief = linktoInfo?.title
    ? `Destination page topic: "${linktoInfo.title.slice(0, 100)}"`
    : `Destination URL: ${linkto}`;

  const brandedRule = isBranded
    ? "\n- BRANDED ANCHOR: The anchor is a brand/company name. Evaluate Destination page topic. If no paragraph perfectly matches, find the most related paragraph and APPEND or EDIT a sentence to seamlessly introduce the brand and its relevance to the topic."
    : "";

  const systemPrompt = `You are an expert SEO editor placing contextual internal links in blog articles.
Your goal is to seamlessly insert an anchor link into a paragraph so that it reads 100% naturally, as if written by the original author.
Never force a link into an irrelevant context. If the paragraph is only slightly related, creatively edit the text or add a bridging sentence.
Respond ONLY with valid JSON. No markdown, no backticks, no explanation outside JSON.`;

  const userPrompt = `Anchor text to place: "${anchor}"
${linktoBrief}

Analyze the paragraphs below. Pick the TWO best paragraphs where the anchor link can be placed organically (preferring different articles when possible).

═══════════════════════════════════════
STAGE C — TIERED SELECTION LADDER
═══════════════════════════════════════
ALWAYS pick from the highest tier that has candidate paragraphs available in the list below:
- TIER 1 (score ≥ 45): STRONG match. Use natural fit or light creative edit. High confidence placement.
- TIER 2 (score 25–44): MODERATE match — topic is adjacent/related but not a perfect overlap. Use creative edit to bridge the connection. This is normal and expected, NOT a failure state. Write the bridging sentence so it reads as a natural, helpful addition (e.g., "for readers who want to go deeper into X, [anchor] covers...").
- TIER 3 (score < 25): LAST RESORT tier — paragraph discusses a genuinely related broad domain (same industry/skill/technology family) but not a close match. Use creative edit to bridge. Frame the link as a helpful related resource/next-step rather than claiming direct topical overlap (e.g., "on a related note," "for those looking to build this skill further,"). Only use if Tier 1 and Tier 2 have zero candidates.
ONLY return failure if literally nothing touches the target URL's broad subject area at all (e.g., a cooking recipe for an AI software target).

═══════════════════════════════════════
STAGE D — PLACEMENT & EDITING RULES (CRITICAL)
═══════════════════════════════════════
1. NATURAL FIT FIRST: if anchor phrase already fits an existing sentence without changing meaning, use minimal edit.
1a) MEANING PRESERVATION CHECK (critical): When replacing an existing word/phrase with the anchor text (natural fit), you must verify the replaced word was actually referring to the SAME kind of entity as the anchor. Specifically:
  - Do NOT replace a generic/indefinite reference (e.g., 'a person', 'users', 'someone', 'the system', 'an application') with a specific professional role anchor (e.g., 'a machine learning engineer', 'a developer') UNLESS the sentence is genuinely describing an action that a professional in that role would perform themselves.
  - Before finalizing a natural-fit replacement, ask: 'Does this sentence, after my edit, still accurately describe who/what is performing this action?' If the original sentence was describing automated/software behavior (e.g., 'the algorithm detects X', 'the app can identify Y'), and your edit reassigns that action to a human professional role, this is a meaning-distortion — REJECT this natural-fit approach and instead use the Creative Edit (bridging sentence) approach, which adds context without altering the original claim's subject/actor.
  - Example of what NOT to do: replacing 'a person can define age and sex within an application' with 'a machine learning engineer can define age and sex within an application' — this incorrectly suggests manual human action instead of automated software capability.
  - Correct alternative for this case would be a bridging sentence instead, e.g.: keep the original sentence intact, and append: 'Building these kinds of automated recognition features typically requires the expertise of a [[machine learning engineer]].'
2. MINIMAL EDIT GUARDRAIL: Do NOT rewrite the entire paragraph. You may only modify a maximum of 5 to 7 words, or append a single short bridging sentence. The original author's voice, tone, and intent must remain 100% intact.
3. CONTEXT-AWARE FLOW: You have been provided with "Previous context" and "Next context". Your edit MUST flow logically from the previous sentence and into the next sentence. If your edit breaks the narrative connection between paragraphs, REJECT the candidate entirely.
4. VALIDATION CHECK:
   a) The bridging sentence must NOT introduce any concept, entity, or claim that isn't already implied by the paragraph itself. Do not invent new scenarios (e.g., 'agile teams,' 'remote talent') that have no basis in the paragraph's actual content.
   b) The bridging sentence must NOT contradict or work against the article's own argument or title.
   c) If you cannot write a bridge that passes these checks and the minimal edit rule, REJECT this paragraph entirely and move to the next candidate. Do not soften or water down a bad bridge — discard it.
5. ABSOLUTE NON-IRRELEVANCE RULE: Do not place a link where the paragraph's broad subject domain has NO reasonable relation at all to the target URL (e.g., team lunch traditions linking to Python course).
6. JUSTIFICATION FIELD (always required in "reason"): One sentence explaining the connection — for Tier 1 direct, for Tier 2/3 say honestly "adjacent topic, bridged via [reason]".
7. Prefer suggestions from DIFFERENT articles when at least two articles have genuinely strong (Tier 1 or Tier 2) candidate paragraphs. However, relevance ALWAYS takes priority over diversity: if only ONE article has a Tier 1/2 quality match and no other article rises above Tier 3, it is completely acceptable to return 2 different paragraphs from that SAME article. Never sacrifice relevance quality or bridge validity just to satisfy article diversity.${brandedRule}

Paragraphs:
${paragraphText}
Return this exact JSON with two suggestions:
{
  "suggestions": [
    {
      "paragraph": "full original paragraph text here",
      "suggested_sentence": "original sentence before edit",
      "suggested_edit": "edited sentence with [[ANCHOR]] placed naturally",
      "reason": "one sentence explaining connection (e.g. Tier 2 adjacent topic, bridged via X)",
      "relevance_score": 85,
      "naturalness_score": 90
    },
    {
      "paragraph": "full original paragraph text here",
      "suggested_sentence": "original sentence before edit",
      "suggested_edit": "edited sentence with [[ANCHOR]] placed naturally",
      "reason": "one sentence explaining connection",
      "relevance_score": 78,
      "naturalness_score": 82
    }
  ]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1800, // ✅ PERF: reduced from 2500 — 2 placements don't need 2500 tokens
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`Anthropic API error: ${data.error.message}`);
  const rawText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const cleaned = rawText.trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) throw new Error("AI response was not valid JSON");
  const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  if (!parsed.suggestions || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
    throw new Error("AI response missing suggestions array");
  }
  for (const s of parsed.suggestions) {
    for (const field of ["paragraph", "suggested_edit", "relevance_score"]) {
      if (!s[field]) throw new Error(`AI response missing required field: ${field}`);
    }
  }
  return parsed.suggestions;
}

function mentionstool(text) {
  const toolPatterns = [
    /\b(using|use|with|via|through|powered by|built (on|with)|integrate[sd]? with)\b.{0,40}\b(tool|software|platform|app|service|api)\b/i,
    /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s(?:tool|software|platform|app)\b/,
    /\b(monday\.com|hubspot|salesforce|zapier|ahrefs|semrush|moz|screaming frog|google analytics|mixpanel|amplitude)\b/i,
  ];
  const matchCount = toolPatterns.filter((re) => re.test(text)).length;
  // ✅ FIX: if 2+ patterns match, this paragraph is almost certainly a 
  // dedicated tool-spotlight, not a passing mention — reject with higher confidence
  return matchCount >= 2;
}

async function scrapeAndScore(url, anchor, keywords, isBranded = false, isToolTarget = false) {
  console.log(`[SCRAPE] Fetching ${url}`);
  try {
    const { html, status } = await fetchWithRetry(url, 2, 30000);
    console.log(`[SCRAPE-DEBUG] ${url} → HTTP ${status}, HTML length: ${html?.length || 0} chars`);
    if (isBlockedPage(html, status)) { console.log(`[SCRAPE] ${url} is blocked or captcha`); return "BLOCKED"; }
    const article = extractArticleContent(html, url);
    if (!article) { console.log(`[SCRAPE] No readable content at ${url}`); return []; }
    
    // RULE 2: Reject if the blog is a tool review or roundup
    const toolReviewPatterns = /\b(review|top 10|top \d+|best|vs|alternative|alternatives|pricing|software|app|platform)\b/i;
    if (article.title && toolReviewPatterns.test(article.title)) {
      console.log(`[SCRAPE] Rejected tool review page: ${article.title}`);
      return [];
    }
    const urlSlug = new URL(url).pathname.split('/').filter(Boolean).pop() || "";
    if (toolReviewPatterns.test(urlSlug.replace(/-/g, " "))) {
      console.log(`[SCRAPE] Rejected tool review url: ${url}`);
      return [];
    }

    const rawParagraphs = segmentParagraphs(article.content);
    // ✅ FIX: lowered threshold from 6 to 4, and added a minimum fallback 
    // for very short articles (2-3 paragraphs) so first/last are never candidates
    let eligibleParagraphs = rawParagraphs;
    if (rawParagraphs.length >= 4) {
      const excludeCount = Math.max(1, Math.floor(rawParagraphs.length * 0.15));
      eligibleParagraphs = rawParagraphs.slice(excludeCount, rawParagraphs.length - excludeCount);
    } else if (rawParagraphs.length >= 2) {
      eligibleParagraphs = rawParagraphs.slice(1, -1);
    } else {
      eligibleParagraphs = []; // too short an article to safely place anything
    }
    const scored = [];
    const seen = new Set();
    for (let i = 0; i < eligibleParagraphs.length; i++) {
      const { text, linkCount } = eligibleParagraphs[i];
      if (seen.has(text)) continue;
      if (!isQualityParagraph(text, linkCount, isToolTarget, new URL(url).hostname, url)) continue;
      seen.add(text);
      const id = crypto.createHash('md5').update(url + text).digest('hex').slice(0, 10);
      const prevText = eligibleParagraphs[i - 1] ? eligibleParagraphs[i - 1].text : null;
      const nextText = eligibleParagraphs[i + 1] ? eligibleParagraphs[i + 1].text : null;
      scored.push({ id, text, score: scoreParagraph(text, anchor, keywords, isBranded), url, prevText, nextText });
    }
    console.log(`[SCRAPE] ${scored.length} quality paragraphs from ${url}`);
    return scored;
  } catch (err) {
    console.log(`[SCRAPE] Failed ${url}: ${err.message}`);
    return [];
  }
}

// In-memory store for scraped paragraph pools (for regenerate without re-scraping)
const paragraphPoolCache = new NodeCache({ stdTTL: 1800, checkperiod: 300, maxKeys: 200 });

async function runAnalysis(domain, anchor, linkto, excludedParagraphs = [], isBranded = false, excludedArticleUrls = []) {
  console.log(`[ANALYZE] domain=${domain}, anchor="${anchor}", excluded=${excludedParagraphs.length}, excludedUrls=${excludedArticleUrls.length}, isBranded=${isBranded}`);

  const poolKey = `pool::${domain}::${anchor.toLowerCase().trim()}::${linkto.toLowerCase().trim()}::${isBranded}::${excludedArticleUrls.length}`;

  let topParagraphs, allScored, filteredUrls, linktoInfo;

  const cachedPool = paragraphPoolCache.get(poolKey);

  if (cachedPool) {
    // Regenerate — reuse scraped data, skip SerpAPI + scraping
    console.log(`[POOL] Reusing cached paragraph pool (${cachedPool.topParagraphs.length} paragraphs)`);
    ({ topParagraphs, allScored, filteredUrls, linktoInfo } = cachedPool);
  } else {
    // Fresh run — full pipeline

    // STEP 1: Linkto page analysis -> AI keyword generation (sequential so AI gets context)
    const targetPageInfo = await analyzeLinktoPage(linkto);
    linktoInfo = targetPageInfo;
    const keywords = await generateKeywordsWithAI(anchor, linkto, linktoInfo, isBranded);
    console.log(`[LINKTO] isToolPage=${linktoInfo.isToolPage}, keywords=${linktoInfo.keywords.slice(0, 5).join(", ")}`);

    // Prioritize target-derived keywords over generic anchor words for query building
    const searchKeywords = [...new Set([...(linktoInfo.aiKeywords || []), ...keywords, ...linktoInfo.keywords])];

    // STEP 2: Search
    const searchResult = await searchArticles(domain, anchor, searchKeywords, isBranded);
    const urls = searchResult.urls;
    const searchTelemetry = searchResult.telemetry;
    if (!urls.length) {
      const noUrlErr = new Error("No articles found. Try a different domain or anchor text.");
      noUrlErr.searchTelemetry = searchTelemetry; // attach real telemetry to the error
      throw noUrlErr;
    }

    let linktoDomain = "";
    let cleanDomain = domain.replace(/^www\./, "").split("/")[0].toLowerCase();
    try { linktoDomain = new URL(linkto).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
    
    // Allow INTERNAL LINKING when domain matches destination hostname
    if (cleanDomain === linktoDomain || linktoDomain.includes(cleanDomain) || cleanDomain.includes(linktoDomain)) {
      filteredUrls = urls.filter((url) => {
        try { return new URL(url).pathname !== new URL(linkto).pathname; } catch { return url !== linkto; }
      });
      if (!filteredUrls.length) throw new Error("No other articles found on this domain to place an internal link.");
    } else {
      filteredUrls = urls.filter((url) => !url.includes(linktoDomain));
      if (!filteredUrls.length) throw new Error("All found URLs belong to the destination domain.");
    }

    console.log(`[SEARCH] Using ${filteredUrls.length} articles: ${filteredUrls.join(", ")}`);

    // STEP 3: Parallel scrape
    const isToolTarget = linktoInfo?.isToolPage || false;
    const scrapeResults = await Promise.allSettled(filteredUrls.map((url) => scrapeAndScore(url, anchor, searchKeywords, isBranded, isToolTarget)));
    const paragraphsByUrl = {};
    let totalQuality = 0;
    let blockedCount = 0;
    for (const [i, result] of scrapeResults.entries()) {
      if (result.status === "fulfilled") {
        if (result.value === "BLOCKED") {
          blockedCount++;
        } else if (result.value.length > 0) {
          paragraphsByUrl[filteredUrls[i]] = result.value;
          totalQuality += result.value.length;
        }
      }
    }
    if (!Object.keys(paragraphsByUrl).length) {
      if (blockedCount > 0) {
        throw new Error(`The target website (${domain}) is blocking our scraper (Cloudflare/Bot protection). Out of ${filteredUrls.length} URLs, ${blockedCount} were blocked. We cannot scrape this site.`);
      }
      const scrapeErr = new Error(`No suitable paragraphs found (urls: ${filteredUrls.length}, scraped quality paras: ${totalQuality}). The articles might have no text, or all paragraphs contain existing links (which we skip). Try a different domain.`);
      // ✅ FIX: attach diagnostic info so fallback can give honest message
      scrapeErr.scrapeFailureInfo = {
        urlsFound: filteredUrls.length,
        qualityParagraphs: totalQuality,
        urls: filteredUrls
      };
      throw scrapeErr;
    }

    // STEP 4: Context re-ranking — keep larger pool for regenerate
    allScored = rerankWithContext(paragraphsByUrl, anchor, searchKeywords);
    allScored.sort((a, b) => b.score - a.score);
    console.log(`[RANK] Top 5 scores: ${allScored.slice(0, 5).map((p) => p.score.toFixed(1)).join(", ")}`);

    // STAGE C: Tiered Selection — keep top 30 without discarding lower tier scores
    topParagraphs = allScored.slice(0, 30);
    console.log(`[POOL] Storing ${topParagraphs.length} paragraphs for potential regenerate`);

    // Cache the pool for regenerate
    paragraphPoolCache.set(poolKey, { topParagraphs, allScored, filteredUrls, linktoInfo });
  }

  // STEP 5: AI placement — exclude already-seen paragraphs and excluded article URLs
  let available = topParagraphs.filter((p) => !excludedParagraphs.includes(p.id) && !excludedArticleUrls.includes(p.url));
  if (available.length < 2) {
    available = allScored.filter((p) => !excludedParagraphs.includes(p.id) && !excludedArticleUrls.includes(p.url));
  }
  console.log(`[RANK] Pool: ${topParagraphs.length}, available after exclusion: ${available.length}`);

  // If too few left, fall back to topParagraphs without URL exclusions so we don't return empty
  const poolToUse = available.length >= 2 ? available : topParagraphs.filter((p) => !excludedParagraphs.includes(p.id));

  // Group by URL to ensure diversity
  const grouped = {};
  for (const p of poolToUse) {
    if (!grouped[p.url]) grouped[p.url] = [];
    grouped[p.url].push(p);
  }
  
  const diversePool = [];
  for (const url in grouped) {
    diversePool.push(...grouped[url].slice(0, 2));
  }
  diversePool.sort((a, b) => b.score - a.score);

  const sendToAI = diversePool.slice(0, 8); // ✅ PERF: reduced from 12 to 8
  console.log(`[RANK] Sending ${sendToAI.length} paragraphs to AI (from ${Object.keys(grouped).length} distinct URLs, Branded Mode: ${isBranded})`);

  const aiSuggestions = await analyzeWithAI(sendToAI, anchor, linkto, linktoInfo, isBranded);

  const results = aiSuggestions.map((aiResult) => {
    const match = findBestMatch(aiResult.paragraph, allScored);
    return {
      id: match ? match.id : null,
      article_url: match ? match.url : filteredUrls[0],
      paragraph: aiResult.paragraph,
      suggested_sentence: aiResult.suggested_sentence || null,
      suggested_edit: aiResult.suggested_edit,
      reason: aiResult.reason || "",
      relevance_score: aiResult.relevance_score,
      naturalness_score: aiResult.naturalness_score || null,
      natural_fit: aiResult.relevance_score >= 80 ? "high" : aiResult.relevance_score >= 55 ? "medium" : "low",
    };
  });

  return results;
}

// ─── /api/find-anchor — Zero-cost anchor finder (no external APIs) ──────────
// Crawls a website's sitemap/RSS to find all articles mentioning an anchor text
app.post("/api/find-anchor", async (req, res) => {
  const { websiteUrl, anchorText, urlOffset = 0, limit = 20 } = req.body;

  if (!websiteUrl || !anchorText) {
    return res.status(400).json({ error: "websiteUrl and anchorText are required" });
  }
  if (anchorText.length < 2) return res.status(400).json({ error: "anchorText too short" });

  let baseUrl = "";
  try {
    const parsed = new URL(websiteUrl.startsWith("http") ? websiteUrl : "https://" + websiteUrl);
    baseUrl = `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return res.status(400).json({ error: "Invalid website URL" });
  }

  const anchorLower = anchorText.toLowerCase().trim();
  const foundArticles = [];

  // Helper: fetch a URL silently
  async function silentFetch(url, timeoutMs = 12000) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const r = await fetch(url, { headers: DEFAULT_HEADERS, signal: controller.signal, redirect: "follow" });
      clearTimeout(timer);
      return { html: await r.text(), ok: r.ok };
    } catch { return { html: "", ok: false }; }
  }

  // Step 1: Try to get URLs from sitemap.xml or sitemap_index.xml or robots.txt
  const sitemapUrls = [];
  const sitemapCandidates = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap-posts.xml`,
    `${baseUrl}/blog-sitemap.xml`,
    `${baseUrl}/post-sitemap.xml`,
    `${baseUrl}/rss.xml`,
    `${baseUrl}/feed`,
    `${baseUrl}/feed.xml`,
  ];

  for (const sitemapUrl of sitemapCandidates) {
    if (sitemapUrls.length >= 200) break;
    const { html, ok } = await silentFetch(sitemapUrl, 10000);
    if (!ok || !html) continue;

    // Parse XML sitemap
    if (html.includes("<url>") || html.includes("<loc>")) {
      const locMatches = html.match(/<loc>(.*?)<\/loc>/g) || [];
      for (const m of locMatches) {
        const url = m.replace(/<\/?loc>/g, "").trim();
        if (url && url.startsWith("http") && isContentUrl(url)) {
          sitemapUrls.push(url);
        }
        // Nested sitemap index
        if (url && url.includes("sitemap") && url.endsWith(".xml") && sitemapUrls.length < 200) {
          const nested = await silentFetch(url, 8000);
          if (nested.ok) {
            const nestedLocs = nested.html.match(/<loc>(.*?)<\/loc>/g) || [];
            for (const nl of nestedLocs) {
              const nUrl = nl.replace(/<\/?loc>/g, "").trim();
              if (nUrl && nUrl.startsWith("http") && isContentUrl(nUrl)) sitemapUrls.push(nUrl);
            }
          }
        }
      }
      if (sitemapUrls.length > 0) break;
    }

    // Parse RSS feed
    if (html.includes("<item>") || html.includes("<entry>")) {
      const linkMatches = html.match(/<link>(.*?)<\/link>/g) || [];
      const guidMatches = html.match(/<guid[^>]*>(.*?)<\/guid>/g) || [];
      const atomLinks = html.match(/href="([^"]+)"/g) || [];
      for (const m of [...linkMatches, ...guidMatches]) {
        const url = m.replace(/<[^>]+>/g, "").trim();
        if (url && url.startsWith("http") && isContentUrl(url)) sitemapUrls.push(url);
      }
      if (sitemapUrls.length > 0) break;
    }
  }

  // Step 2: If sitemap failed, try crawling the homepage for article links
  if (sitemapUrls.length === 0) {
    const { html: homeHtml } = await silentFetch(baseUrl, 10000);
    if (homeHtml) {
      const hrefMatches = homeHtml.match(/href="([^"#?]+)"/g) || [];
      for (const m of hrefMatches) {
        const href = m.replace(/href="|"/g, "").trim();
        let fullUrl = href;
        if (href.startsWith("/")) fullUrl = baseUrl + href;
        if (!fullUrl.startsWith("http")) continue;
        if (isContentUrl(fullUrl)) sitemapUrls.push(fullUrl);
      }
    }
  }

  if (sitemapUrls.length === 0) {
    return res.status(404).json({ error: "Could not find any articles on this website. Make sure the URL is correct and the site has a sitemap or RSS feed." });
  }

  // Deduplicate
  const uniqueUrls = [...new Set(sitemapUrls)];
  
  // Step 3: Fast deterministic scanning with pagination
  let currentIndex = parseInt(urlOffset, 10) || 0;
  const BATCH_SIZE = 25; // Increased for speed
  let scannedThisRound = 0;

  console.log(`[FIND-ANCHOR] Checking URLs starting at ${currentIndex} (Total: ${uniqueUrls.length}) for anchor: "${anchorText}"`);

  while (currentIndex < uniqueUrls.length && foundArticles.length < limit && scannedThisRound < 100) {
    const batch = uniqueUrls.slice(currentIndex, currentIndex + BATCH_SIZE);
    scannedThisRound += batch.length;
    
    const results = await Promise.allSettled(batch.map(async (url) => {
      const { html, ok } = await silentFetch(url, 10000);
      if (!ok || !html) return null;
      
      // HUGE SPEEDUP: Skip JSDOM parsing completely if the word isn't even in the raw HTML
      const fastRegex = new RegExp(`\\b${escapeRegExp(anchorText)}\\b`, "i");
      if (!fastRegex.test(html)) return null;

      try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();
        if (!article || !article.textContent) return null;
        
        const match = article.textContent.match(fastRegex);
        if (match) {
          const idx = match.index;
          const start = Math.max(0, idx - 80);
          const end = Math.min(article.textContent.length, idx + anchorText.length + 80);
          const context = "..." + article.textContent.slice(start, end).replace(/\s+/g, " ").trim() + "...";
          return { url, title: article.title || url, context };
        }
      } catch { return null; }
      return null;
    }));

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled" && results[i].value) {
        if (foundArticles.length < limit) {
          foundArticles.push(results[i].value);
        }
      }
    }
    
    currentIndex += BATCH_SIZE;
  }

  const hasMore = currentIndex < uniqueUrls.length;

  console.log(`[FIND-ANCHOR] Found ${foundArticles.length} matches. Next offset: ${currentIndex}`);

  return res.status(200).json({
    anchorText,
    websiteUrl: baseUrl,
    totalFound: foundArticles.length,
    scannedThisRound,
    hasMore,
    nextOffset: currentIndex,
    articles: foundArticles,
  });
});

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

async function generateMismatchDiagnosis(domain, anchorList, targetPageInfo, sampleDomainParagraphs) {
  const prompt = `You are analyzing why a link placement search failed.
  
  Domain being searched: ${domain}
  Anchor variations tried (all failed): ${anchorList.join(", ")}
  Target URL topic: ${targetPageInfo?.summary || targetPageInfo?.title || "Unknown"}
  
  Sample content actually found on this domain (a few paragraph excerpts):
  ${sampleDomainParagraphs.slice(0, 5).map(p => p.text.slice(0, 150)).join("\n---\n")}
  
  Based on this, provide a JSON response:
  {
    "domain_content_summary": "1-2 sentence summary of what this domain's content actually focuses on, based on the sample paragraphs",
    "target_url_topic": "1 sentence summary of what the target URL is about",
    "likely_reason": "topic_mismatch",
    "suggestion": "1-2 sentence actionable suggestion — e.g. recommend a different domain category, or a different anchor angle that might fit this domain's actual content"
  }
  
  Return ONLY valid JSON, no markdown, no explanation outside the JSON.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await response.json();
    let text = data.content[0].text;
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch (err) {
    return {
      domain_content_summary: "Could not generate summary.",
      target_url_topic: "Could not analyze target.",
      likely_reason: "topic_mismatch",
      suggestion: "Try a different domain or anchor text."
    };
  }
}

async function runAnalysisWithFallback(domain, anchorList, linkto, excludedParagraphs, excludedArticleUrls, isBranded) {
  const attemptLog = [];
  const allSearchTelemetry = []; // track SERP telemetry across all anchor attempts
  const allScrapeFailures = [];  // track scraping failures across all anchor attempts

  for (let i = 0; i < anchorList.length; i++) {
    const currentAnchor = anchorList[i];
    try {
      console.log(`[FALLBACK] Attempting analysis with anchor #${i + 1}/${anchorList.length}: "${currentAnchor}"`);
      const result = await runAnalysis(domain, currentAnchor, linkto, excludedParagraphs, isBranded, excludedArticleUrls);
      if (result && result.length > 0) {
        return {
          suggestions: result,
          anchor_used: currentAnchor,
          was_fallback: i > 0,
          original_anchor_requested: anchorList[0],
          anchors_tried_before_success: anchorList.slice(0, i),
          attempt_log: attemptLog
        };
      }
      attemptLog.push({ anchor: currentAnchor, result: "no_placement_found" });
    } catch (err) {
      attemptLog.push({ anchor: currentAnchor, result: "error", message: err.message });
      // Collect real search telemetry from each failed attempt
      if (err.searchTelemetry) {
        allSearchTelemetry.push({ anchor: currentAnchor, telemetry: err.searchTelemetry });
      }
      // Collect scraping failure info (URLs found but content extraction failed)
      if (err.scrapeFailureInfo) {
        allScrapeFailures.push({ anchor: currentAnchor, ...err.scrapeFailureInfo });
      }
      console.log(`[FALLBACK] Anchor "${currentAnchor}" failed: ${err.message}. Trying next anchor...`);
    }
  }

  // All anchors failed — try to generate a diagnosis from cached paragraph pool first
  let diagnosis = null;
  try {
    let cachedPool = null;
    for (const a of anchorList) {
      const poolKey = `pool::${domain}::${a.toLowerCase().trim()}::${linkto.toLowerCase().trim()}::${isBranded}::${excludedArticleUrls.length}`;
      cachedPool = paragraphPoolCache.get(poolKey);
      if (cachedPool && cachedPool.topParagraphs && cachedPool.topParagraphs.length > 0) {
        break;
      }
    }
    if (cachedPool && cachedPool.topParagraphs && cachedPool.topParagraphs.length > 0) {
      diagnosis = await generateMismatchDiagnosis(domain, anchorList, cachedPool.linktoInfo, cachedPool.topParagraphs.slice(0, 5));
    }
  } catch (e) {
    console.log("[FALLBACK] Failed to generate diagnosis: " + e.message);
  }

  const err = new Error(`None of the ${anchorList.length} anchor variations found a suitable placement on this domain.`);
  err.code = "no_valid_placement_any_anchor";
  err.anchors_tried = anchorList;

  if (diagnosis) {
    // Best case: use AI-generated mismatch diagnosis from real paragraph data
    err.domain_content_summary = diagnosis.domain_content_summary;
    err.target_url_topic = diagnosis.target_url_topic;
    err.likely_reason = diagnosis.likely_reason;
    err.suggestion = diagnosis.suggestion;
  } else if (allScrapeFailures.length > 0) {
    // ✅ FIX: Search found URLs but scraping yielded 0 paragraphs — likely a timeout/cold-start issue
    const totalUrls = allScrapeFailures.reduce((s, f) => s + f.urlsFound, 0);
    console.log(`[FALLBACK] Scrape failure detected: ${totalUrls} URLs found but 0 paragraphs extracted`);
    err.domain_content_summary = `Found ${totalUrls} candidate articles on this domain, but was unable to extract readable content from any of them.`;
    err.target_url_topic = "Content related to your destination URL and anchors.";
    err.likely_reason = `Search successfully found ${totalUrls} candidate articles across ${anchorList.length} anchor variation(s), but content scraping returned 0 usable paragraphs. This commonly indicates a timeout issue (e.g. slow-starting server instance) rather than a genuine content mismatch.`;
    err.suggestion = "This looks like a temporary infrastructure/timeout issue rather than a content problem. Try running the search again — a warm server instance responds much faster. If you consistently see this error, the domain may be blocking scrapers (Cloudflare/bot protection).";
  } else {
    // ✅ FIX: build an HONEST reason from actual telemetry, distinguishing zero-results from API errors
    const totalQueries = allSearchTelemetry.reduce((sum, a) => sum + a.telemetry.length, 0);
    const totalRawResults = allSearchTelemetry.reduce((sum, a) =>
      sum + a.telemetry.reduce((s, t) => s + (t.rawResultCount || 0), 0), 0);
    // Only treat entries with .error AND isZeroResults===false as real API errors
    const apiErrors = allSearchTelemetry.flatMap(a => a.telemetry.filter(t => t.error && !t.isZeroResults)).map(t => t.error);
    const zeroResultQueries = allSearchTelemetry.flatMap(a => a.telemetry.filter(t => t.isZeroResults));

    console.log(`[FALLBACK] Telemetry summary — queries: ${totalQueries}, raw results: ${totalRawResults}, api errors: ${apiErrors.length}, zero-result queries: ${zeroResultQueries.length}`);

    err.domain_content_summary = "Could not fetch any relevant paragraphs from this domain matching your anchors.";
    err.target_url_topic = "Content related to your destination URL and anchors.";

    if (apiErrors.length > 0) {
      const uniqueErrors = [...new Set(apiErrors)];
      err.likely_reason = `Search API errors occurred: ${uniqueErrors.join("; ")}. ${totalQueries} queries attempted across ${anchorList.length} anchor(s).`;
      err.suggestion = "This looks like a SerpAPI issue (rate limit, quota, or invalid key) rather than a content mismatch. Check your SerpAPI account status before retrying.";
    } else if (totalQueries === 0) {
      err.likely_reason = "Search was never reached — all anchors may have failed before the search step.";
      err.suggestion = "Check server logs for errors in earlier pipeline steps (keyword generation or linkto analysis).";
    } else if (zeroResultQueries.length > 0 && totalRawResults === 0) {
      // All queries returned zero results — likely over-restrictive query construction, not missing content
      err.likely_reason = `All ${totalQueries} search queries across ${anchorList.length} anchor variation(s) returned zero Google results. This usually means the queries were too specific (combining too many keywords), not that the domain lacks relevant content.`;
      err.suggestion = "Try shorter, broader anchor phrases (2-3 words max), or manually verify the domain has relevant content on this topic.";
    } else if (totalRawResults === 0) {
      err.likely_reason = `Ran ${totalQueries} search queries across ${anchorList.length} anchor variation(s) — Google returned 0 raw results for all of them.`;
      err.suggestion = "Try a different domain that covers this topic more broadly, or use a much more generic anchor text.";
    } else {
      err.likely_reason = `Search queries returned ${totalRawResults} raw results total across ${totalQueries} queries, but none passed the URL/content filters (isArticleUrl or paragraph quality checks).`;
      err.suggestion = "The domain has some matching search presence but the URL or content filters may be too strict for this domain's structure. Try a different article-heavy subdomain or a different anchor.";
    }
  }
  throw err;
}

app.post("/api/analyze", async (req, res) => {
  const rawDomain = req.body.domain || "";
  const domain = rawDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const { anchor, altAnchor, linkto, isBranded } = req.body;
  const excludedParagraphs = Array.isArray(req.body.excludedParagraphs) ? req.body.excludedParagraphs : [];
  const excludedArticleUrls = Array.isArray(req.body.excludedArticleUrls) ? req.body.excludedArticleUrls : [];

  const validationError = validateInputs(domain, anchor, linkto);
  if (validationError) return res.status(400).json({ error: validationError });

  const excludeHash = (excludedParagraphs.length > 0 || excludedArticleUrls.length > 0)
    ? crypto.createHash("md5").update([...excludedParagraphs, ...excludedArticleUrls].join("|")).digest("hex").slice(0, 16)
    : "0";

  let anchorList = [];
  if (Array.isArray(req.body.anchors) && req.body.anchors.length > 0) {
    anchorList = req.body.anchors.filter(Boolean);
  } else if (Array.isArray(req.body.selectedAnchors) && req.body.selectedAnchors.length > 0) {
    anchorList = req.body.selectedAnchors.filter(Boolean);
  } else {
    anchorList = [anchor, altAnchor].filter(Boolean);
  }

  const cacheKey = `${domain}::${anchorList.join("||").toLowerCase().trim()}::${linkto.toLowerCase().trim()}::${excludeHash}::${isBranded}`;

  const useCache = excludedParagraphs.length === 0 && excludedArticleUrls.length === 0;
  const cached = useCache ? cache.get(cacheKey) : null;
  if (cached) { console.log(`[CACHE] Hit: ${cacheKey}`); return res.status(200).json({ ...cached, cached: true }); }
  if (inFlight.has(cacheKey)) {
    try { const result = await inFlight.get(cacheKey); return res.status(200).json({ ...result, cached: true }); }
    catch { return res.status(500).json({ error: "Analysis failed. Please try again." }); }
  }

  const attemptAnalysis = async () => {
    return await runAnalysisWithFallback(domain, anchorList, linkto, excludedParagraphs, excludedArticleUrls, isBranded);
  };

  const promise = attemptAnalysis().finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, promise);
  try {
    const results = await promise;
    const response = { ...results, cached: false };
    cache.set(cacheKey, response);
    return res.status(200).json(response);
  } catch (err) {
    console.error(`[ERROR] ${err.stack || err.message}`);
    if (err.code === "no_valid_placement_any_anchor" || err.message?.includes("No valid placement found across any")) {
      return res.status(404).json({
        error: "no_valid_placement_any_anchor",
        message: "None of the provided anchor variations found a suitable placement on this domain.",
        anchors_tried: err.anchors_tried || anchorList,
        suggestion: err.suggestion || "Try a different domain, or generate a fresh set of anchor variations.",
        domain_content_summary: err.domain_content_summary,
        target_url_topic: err.target_url_topic,
        likely_reason: err.likely_reason
      });
    }
    const userFacing = err.message?.includes("No articles") || err.message?.includes("No suitable") || err.message?.includes("All found URLs")
      ? err.message : "Analysis failed. Please try again or use a different domain/anchor.";
    return res.status(500).json({ error: userFacing });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace v3 running on port ${PORT}`));

module.exports = { app, runAnalysis, searchArticles, scrapeAndScore, generateAnchorVariations, analyzeLinktoPage, runAnalysisWithFallback };
