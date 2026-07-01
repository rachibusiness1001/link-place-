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

if (!process.env.ANTHROPIC_API_KEY || !process.env.SERPAPI_KEY) {
  console.error("CRITICAL: Missing ANTHROPIC_API_KEY or SERPAPI_KEY in environment");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);
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
    // Must be a blog/article path — not a landing page
    const lowerPath = urlPath.toLowerCase();
    const isBlogPath = BLOG_PATH_INDICATORS.some((indicator) => lowerPath.includes(indicator));
    // Reject index/listing pages — must have a meaningful slug after the blog segment
    // e.g. /blogs/ alone or /blogs/blog*home*2 are index pages
    const blogSegIdx = segments.findIndex((s) =>
      ["blog", "blogs", "article", "articles", "post", "posts", "news", "insights",
       "resources", "learn", "guide", "guides", "tips", "tutorial", "tutorials"].includes(s.toLowerCase())
    );
    if (blogSegIdx !== -1) {
      const afterBlog = segments.slice(blogSegIdx + 1).filter(Boolean);
      if (afterBlog.length === 0) return false; // /blogs/ with nothing after = index
      const slug = afterBlog[afterBlog.length - 1];
      // Reject slugs that look like pagination or junk (contain * or are just numbers)
      if (/\*/.test(slug)) return false;
      if (/^\d+$/.test(slug)) return false;
      // Slug must be reasonably long and word-like
      if (slug.length < 5) return false;
    } else {
      const slug = segments[segments.length - 1];
      if (/\*/.test(slug) || /^\d+$/.test(slug) || slug.length < 5) return false;
    }
    return true;
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
async function generateKeywordsWithAI(anchor, linkto) {
  console.log(`[KEYWORDS] Generating AI keywords for anchor="${anchor}" linkto="${linkto}"`);
  try {
    // Extract slug from linkto URL for extra context
    let urlContext = "";
    try {
      const slug = new URL(linkto).pathname.replace(/\//g, " ").replace(/-/g, " ").trim();
      urlContext = slug ? `URL context: ${slug}` : "";
    } catch {}

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
${urlContext}
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

// ─── Extract topic/type from linkto URL ──────────────────────────────────────
async function analyzeLinktoPage(linkto) {
  console.log(`[LINKTO] Analyzing destination URL: ${linkto}`);
  try {
    const { html, status } = await fetchWithRetry(linkto, 1, 10000);
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
    return { title, snippet, isToolPage, keywords: extractKeywordsLocal(title + " " + snippet).slice(0, 15) };
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
    return { title: slug, snippet: slug, isToolPage, keywords: extractKeywordsLocal(slug).slice(0, 10) };
  } catch { return { title: "", snippet: "", isToolPage: false, keywords: [] }; }
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

async function fetchWithRetry(url, maxAttempts = 2, timeoutMs = 18000) {
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

async function searchArticles(domain, anchor, keywords) {
  const phrase = anchor.toLowerCase().trim();
  const queries = [
    `site:${domain} "${phrase}"`,
    `site:${domain} ${phrase}`,
    `site:${domain} ${keywords.slice(0, 2).join(" ")}`,
    `site:${domain} ${keywords[0] || "blog"}`,
  ];

  const allUrls = new Set();
  for (const query of queries) {
    if (allUrls.size >= 6) break;
    console.log(`[SEARCH] Query: ${query}`);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const res = await fetch(
        `https://serpapi.com/search?${new URLSearchParams({ q: query, api_key: process.env.SERPAPI_KEY, engine: "google", num: "10" })}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) { console.log(`[SEARCH] SerpAPI ${res.status}`); continue; }
      const data = await res.json();
      for (const r of (data?.organic_results || [])) {
        if (r.link && r.link.includes(domain) && isArticleUrl(r.link)) allUrls.add(r.link);
      }
      console.log(`[SEARCH] Total valid URLs so far: ${allUrls.size}`);
      if (allUrls.size >= 4) break;
    } catch (err) {
      console.log(`[SEARCH] Query failed: ${err.message}`);
    }
  }

  const urls = [...allUrls].slice(0, 6);
  console.log(`[SEARCH] Final URLs: ${urls.join(", ")}`);
  return urls;
}

function extractArticleContent(html, url) {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, { keepClasses: false, nbTopCandidates: 5, charThreshold: 300 });
    const article = reader.parse();
    if (!article || !article.textContent || article.textContent.length < 200) return null;
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
    doc.querySelectorAll("p, li, blockquote").forEach((el) => {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      const linkCount = el.querySelectorAll("a").length;
      if (text.length >= 120 && linkCount <= 3) paragraphs.push({ text, linkCount });
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
  /table of contents|in this article|jump to section|skip to/i,
];

function isQualityParagraph(text, linkCount) {
  if (text.length < 120) return false;
  if (linkCount > 0) return false; // Skip paragraphs that already have any link
  for (const pattern of NOISE_PATTERNS) { if (pattern.test(text)) return false; }
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  if (sentences.length < 2) return false;
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.25) return false;
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
  return (score / Math.sqrt(Math.max(wordCount, 1))) * 10;
}

function scoreParagraph(text, anchor, keywords) {
  const lower = text.toLowerCase();
  const anchorLower = anchor.toLowerCase();
  let score = 0;
  if (lower.includes(anchorLower)) {
    score += 60;
  } else {
    const anchorWords = anchorLower.split(/\s+/).filter((w) => w.length > 2);
    let bigramHits = 0;
    for (let i = 0; i < anchorWords.length - 1; i++) {
      if (lower.includes(`${anchorWords[i]} ${anchorWords[i + 1]}`)) bigramHits++;
    }
    if (bigramHits > 0) score += 20 + bigramHits * 8;
  }
  score += computeTfIdfScore(text, keywords);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const wordCount = text.split(/\s+/).length;
  if (sentences.length >= 3) score += 15;
  else if (sentences.length >= 2) score += 8;
  if (wordCount >= 80 && wordCount <= 300) score += 12;
  else if (wordCount >= 50) score += 5;
  else if (wordCount < 40) score -= 15;
  const promoRe = /\b(buy|sale|discount|offer|deal|click|subscribe|download now|sign up|free trial|book a demo)\b/gi;
  score -= (text.match(promoRe) || []).length * 15;
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
      const neighbors = [paragraphs[i - 1], paragraphs[i + 1]].filter(Boolean);
      let contextBonus = 0;
      for (const n of neighbors) {
        if (n.text.toLowerCase().includes(anchorLower)) contextBonus += 10;
        const kwHits = keywords.filter((k) => k.length > 4 && n.text.toLowerCase().includes(k)).length;
        contextBonus += Math.min(kwHits * 2, 12);
      }
      result.push({ ...p, score: p.score + contextBonus, url });
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

async function analyzeWithAI(paragraphs, anchor, linkto, linktoInfo) {
  // If linkto is a tool page, skip paragraphs that already mention a tool
  const pool = linktoInfo?.isToolPage
    ? paragraphs.filter((p) => !mentionstool(p.text))
    : paragraphs;

  const finalPool = (pool.length >= 4 ? pool : paragraphs).slice(0, 12);

  const paragraphText = finalPool.map((p, i) => `[${i + 1}] (Article: ${p.url})\n${p.text.slice(0, 1000)}`).join("\n\n---\n\n");

  const linktoBrief = linktoInfo?.title
    ? `Destination page topic: "${linktoInfo.title.slice(0, 100)}"`
    : `Destination URL: ${linkto}`;

  const systemPrompt = `You are a senior SEO editor placing contextual internal links in blog articles. Your placements must read as if written by the original author. Never force links. Respond ONLY with valid JSON. No markdown, no backticks, no explanation outside JSON.`;

  const userPrompt = `Anchor text to place: "${anchor}"
${linktoBrief}
Pick the TWO best paragraphs where inserting the anchor link feels completely natural.
Rules:
- Choose paragraphs where topic MOST directly relates to the anchor text AND destination page topic
- Edit ONLY one sentence per paragraph — use [[ANCHOR]] placeholder
- If the exact anchor doesn't perfectly fit the existing text, creatively rewrite or add to a sentence so the anchor fits seamlessly.
- You MUST ALWAYS return exactly 2 suggestions. Do NOT fail or return empty.
- Suggestions MUST be from DIFFERENT articles (different URLs)
Paragraphs:
${paragraphText}
Return this exact JSON with two suggestions:
{
  "suggestions": [
    {
      "paragraph": "full original paragraph text here",
      "suggested_sentence": "original sentence before edit",
      "suggested_edit": "edited sentence with [[ANCHOR]] placed naturally",
      "reason": "one sentence explaining why",
      "relevance_score": 85,
      "naturalness_score": 90
    },
    {
      "paragraph": "full original paragraph text here",
      "suggested_sentence": "original sentence before edit",
      "suggested_edit": "edited sentence with [[ANCHOR]] placed naturally",
      "reason": "one sentence explaining why",
      "relevance_score": 78,
      "naturalness_score": 82
    }
  ]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
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
  // Check if paragraph already mentions a competing tool/software
  const toolPatterns = [
    /\b(using|use|with|via|through|powered by|built (on|with)|integrate[sd]? with)\b.{0,40}\b(tool|software|platform|app|service|api)\b/i,
    /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s(?:tool|software|platform|app)\b/,
    /\b(monday\.com|hubspot|salesforce|zapier|ahrefs|semrush|moz|screaming frog|google analytics|mixpanel|amplitude)\b/i,
  ];
  return toolPatterns.some((re) => re.test(text));
}

async function scrapeAndScore(url, anchor, keywords) {
  console.log(`[SCRAPE] Fetching: ${url}`);
  try {
    const { html, status } = await fetchWithRetry(url);
    if (isBlockedPage(html, status)) { console.log(`[SCRAPE] Blocked: ${url}`); return []; }
    const article = extractArticleContent(html, url);
    if (!article) return [];
    const rawParagraphs = segmentParagraphs(article.content);
    const seen = new Set();
    const scored = [];
    for (const { text, linkCount } of rawParagraphs) {
      if (seen.has(text)) continue;
      if (!isQualityParagraph(text, linkCount)) continue;
      seen.add(text);
      const id = crypto.createHash('md5').update(url + text).digest('hex').slice(0, 10);
      scored.push({ id, text, score: scoreParagraph(text, anchor, keywords), url });
    }
    console.log(`[SCRAPE] ${scored.length} quality paragraphs from ${url}`);
    return scored;
  } catch (err) {
    console.log(`[SCRAPE] Failed for ${url}: ${err.message}`);
    return [];
  }
}

// In-memory store for scraped paragraph pools (for regenerate without re-scraping)
const paragraphPoolCache = new NodeCache({ stdTTL: 1800, checkperiod: 300, maxKeys: 200 });

async function runAnalysis(domain, anchor, linkto, excludedParagraphs = []) {
  console.log(`[ANALYZE] domain=${domain}, anchor="${anchor}", excluded=${excludedParagraphs.length}`);

  const poolKey = `pool::${domain}::${anchor.toLowerCase().trim()}::${linkto.toLowerCase().trim()}`;

  let topParagraphs, allScored, filteredUrls, linktoInfo;

  const cachedPool = paragraphPoolCache.get(poolKey);

  if (cachedPool) {
    // Regenerate — reuse scraped data, skip SerpAPI + scraping
    console.log(`[POOL] Reusing cached paragraph pool (${cachedPool.topParagraphs.length} paragraphs)`);
    ({ topParagraphs, allScored, filteredUrls, linktoInfo } = cachedPool);
  } else {
    // Fresh run — full pipeline

    // STEP 1: AI keyword generation + linkto page analysis (parallel)
    const [keywords, lt] = await Promise.all([
      generateKeywordsWithAI(anchor, linkto),
      analyzeLinktoPage(linkto),
    ]);
    linktoInfo = lt;
    console.log(`[LINKTO] isToolPage=${linktoInfo.isToolPage}, keywords=${linktoInfo.keywords.slice(0, 5).join(", ")}`);

    const mergedKeywords = [...new Set([...keywords, ...linktoInfo.keywords])];

    // STEP 2: Search
    const urls = await searchArticles(domain, anchor, mergedKeywords);
    if (!urls.length) throw new Error("No articles found. Try a different domain or anchor text.");

    let linktoDomain = "";
    try { linktoDomain = new URL(linkto).hostname.replace(/^www\./, ""); } catch {}
    filteredUrls = urls.filter((url) => !url.includes(linktoDomain));
    if (!filteredUrls.length) throw new Error("All found URLs belong to the linkto domain.");

    console.log(`[SEARCH] Using ${filteredUrls.length} articles: ${filteredUrls.join(", ")}`);

    // STEP 3: Parallel scrape
    const scrapeResults = await Promise.allSettled(filteredUrls.map((url) => scrapeAndScore(url, anchor, mergedKeywords)));
    const paragraphsByUrl = {};
    for (const [i, result] of scrapeResults.entries()) {
      if (result.status === "fulfilled" && result.value.length > 0) paragraphsByUrl[filteredUrls[i]] = result.value;
    }
    if (!Object.keys(paragraphsByUrl).length) throw new Error("No suitable paragraphs found. Try a different domain.");

    // STEP 4: Context re-ranking — keep larger pool for regenerate
    allScored = rerankWithContext(paragraphsByUrl, anchor, mergedKeywords);
    allScored.sort((a, b) => b.score - a.score);
    console.log(`[RANK] Top 5 scores: ${allScored.slice(0, 5).map((p) => p.score.toFixed(1)).join(", ")}`);

    const qualified = allScored.filter((p) => p.score >= 5);
    // Keep up to 30 paragraphs in pool so regenerate has fresh ones
    topParagraphs = (qualified.length >= 3 ? qualified : allScored).slice(0, 30);
    console.log(`[POOL] Storing ${topParagraphs.length} paragraphs for potential regenerate`);

    // Cache the pool for regenerate
    paragraphPoolCache.set(poolKey, { topParagraphs, allScored, filteredUrls, linktoInfo });
  }

  // STEP 5: AI placement — exclude already-seen paragraphs
  const available = topParagraphs.filter((p) => !excludedParagraphs.includes(p.id));

  console.log(`[RANK] Pool: ${topParagraphs.length}, available after exclusion: ${available.length}`);

  // If too few left, fall back to topParagraphs but still try to diversify
  const poolToUse = available.length >= 2 ? available : topParagraphs;

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

  const sendToAI = diversePool.slice(0, 12);
  console.log(`[RANK] Sending ${sendToAI.length} paragraphs to AI (from ${Object.keys(grouped).length} distinct URLs)`);

  const aiSuggestions = await analyzeWithAI(sendToAI, anchor, linkto, linktoInfo);

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

app.post("/api/analyze", async (req, res) => {
  const rawDomain = req.body.domain || "";
  const domain = rawDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const { anchor, linkto } = req.body;
  const excludedParagraphs = Array.isArray(req.body.excludedParagraphs) ? req.body.excludedParagraphs : [];

  const validationError = validateInputs(domain, anchor, linkto);
  if (validationError) return res.status(400).json({ error: validationError });

  // Use a secure hash to prevent cache collisions
  const excludeHash = excludedParagraphs.length > 0
    ? crypto.createHash("md5").update(excludedParagraphs.join("|")).digest("hex").slice(0, 16)
    : "0";
  const cacheKey = `${domain}::${anchor.toLowerCase().trim()}::${linkto.toLowerCase().trim()}::${excludeHash}`;

  // Only use cache for fresh requests (no exclusions) — regenerate always runs fresh
  const useCache = excludedParagraphs.length === 0;
  const cached = useCache ? cache.get(cacheKey) : null;
  if (cached) { console.log(`[CACHE] Hit: ${cacheKey}`); return res.status(200).json({ ...cached, cached: true }); }
  if (inFlight.has(cacheKey)) {
    try { const result = await inFlight.get(cacheKey); return res.status(200).json({ ...result, cached: true }); }
    catch { return res.status(500).json({ error: "Analysis failed. Please try again." }); }
  }
  const promise = runAnalysis(domain, anchor, linkto, excludedParagraphs).finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, promise);
  try {
    const results = await promise;
    const response = { suggestions: results, cached: false };
    cache.set(cacheKey, response);
    return res.status(200).json(response);
  } catch (err) {
    console.error(`[ERROR] ${err.stack || err.message}`);
    const userFacing = err.message?.includes("No articles") || err.message?.includes("No suitable") || err.message?.includes("All found URLs")
      ? err.message : "Analysis failed. Please try again or use a different domain/anchor.";
    return res.status(500).json({ error: userFacing });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace v3 running on port ${PORT}`));
