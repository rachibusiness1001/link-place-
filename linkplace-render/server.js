/**
 * LinkPlace v2 — Optimized Contextual Link Placement Engine
 */
"use strict";
const express = require("express");
const path = require("path");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const NodeCache = require("node-cache");
const rateLimit = require("express-rate-limit");

const app = express();
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
});
app.use("/api/analyze", limiter);

// ─── Cache ─────────────────────────────────────────────────────────────────────
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 500 });

// ─── In-flight dedup ───────────────────────────────────────────────────────────
const inFlight = new Map();

// ─── Input Validation ──────────────────────────────────────────────────────────
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})+$/;
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

// ─── URL Quality Filter ────────────────────────────────────────────────────────
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
    return true;
  } catch {
    return false;
  }
}

// ─── Keyword Extraction ────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "can", "how", "what", "why", "when", "where", "which",
  "that", "this", "these", "those", "it", "its", "use", "using", "used",
  "get", "got", "make", "made", "also", "just", "more", "most", "some",
  "all", "any", "each", "both", "few", "very", "so", "than", "then", "too",
]);

function extractKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return { keywords: [...new Set(words)], phrase: text.toLowerCase().trim() };
}

// ─── Blocked Page Detection ────────────────────────────────────────────────────
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

// ─── HTTP Fetch with Retry ─────────────────────────────────────────────────────
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

async function fetchWithRetry(url, maxAttempts = 2, timeoutMs = 18000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      const html = await res.text();
      return { html, status: res.status };
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`[FETCH] Attempt ${attempt} failed for ${url}: ${err.message}. Retrying...`);
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
}

// ─── SerpAPI Search ────────────────────────────────────────────────────────────
async function searchArticles(domain, anchor) {
  const { keywords, phrase } = extractKeywords(anchor);
  const kwStr = keywords.slice(0, 5).join(" ");

  // FIX: inurl:guide removed — causes irrelevant landing page results
  const queries = [
    `site:${domain} "${phrase}"`,
    `site:${domain} ${kwStr}`,
    `site:${domain} inurl:blog ${kwStr}`,
    `site:${domain}`,
  ];

  const allUrls = new Set();
  for (const query of queries) {
    if (allUrls.size >= 6) break;
    console.log(`[SEARCH] Query: ${query}`);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const res = await fetch(
        `https://serpapi.com/search?${new URLSearchParams({
          q: query,
          api_key: process.env.SERPAPI_KEY,
          engine: "google",
          num: "10",
        })}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) {
        console.log(`[SEARCH] SerpAPI ${res.status} for: ${query}`);
        continue;
      }
      const data = await res.json();
      for (const r of (data?.organic_results || [])) {
        if (r.link && r.link.includes(domain) && isArticleUrl(r.link)) {
          allUrls.add(r.link);
        }
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

// ─── Content Extraction via Readability ───────────────────────────────────────
function extractArticleContent(html, url) {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document, {
      keepClasses: false,
      nbTopCandidates: 5,
      charThreshold: 300,
    });
    const article = reader.parse();
    if (!article || !article.textContent || article.textContent.length < 200) {
      console.log(`[EXTRACT] Readability returned nothing for ${url}`);
      return null;
    }
    console.log(`[EXTRACT] ${article.textContent.length} chars extracted, title: "${article.title?.slice(0, 60)}"`);
    return article;
  } catch (err) {
    console.log(`[EXTRACT] Readability error for ${url}: ${err.message}`);
    return null;
  }
}

// ─── Paragraph Segmentation ────────────────────────────────────────────────────
function segmentParagraphs(articleHtml) {
  if (!articleHtml) return [];
  try {
    const dom = new JSDOM(articleHtml);
    const doc = dom.window.document;
    const paragraphs = [];
    doc.querySelectorAll("p, li, blockquote").forEach((el) => {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      const linkCount = el.querySelectorAll("a").length;
      if (text.length >= 120 && linkCount <= 3) {
        paragraphs.push({ text, linkCount });
      }
    });
    return paragraphs;
  } catch (err) {
    console.log(`[SEGMENT] Error: ${err.message}`);
    return [];
  }
}

// ─── Quality Filter ────────────────────────────────────────────────────────────
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
  if (linkCount > 3) return false;
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(text)) return false;
  }
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  if (sentences.length < 2) return false;
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.25) return false;
  return true;
}

// ─── TF-IDF Style Scoring ──────────────────────────────────────────────────────
function computeTfIdfScore(text, keywords) {
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).length;
  const freq = {};
  for (const word of lower.split(/\s+/)) {
    if (word.length > 2) freq[word] = (freq[word] || 0) + 1;
  }
  let score = 0;
  for (const kw of keywords) {
    if (kw.length < 3) continue;
    const kwFreq = freq[kw] || 0;
    if (kwFreq > 0) {
      const specificity = Math.min(kw.length / 5, 2.5);
      score += specificity * (1 + Math.log(kwFreq));
    }
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
  const promoHits = (text.match(promoRe) || []).length;
  score -= promoHits * 15;

  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio < 0.1) score += 8;
  else if (capsRatio > 0.2) score -= 10;

  return Math.max(0, score);
}

// ─── Context Window Re-ranking ─────────────────────────────────────────────────
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
        const nLower = n.text.toLowerCase();
        const kwHits = keywords.filter((k) => k.length > 4 && nLower.includes(k)).length;
        contextBonus += Math.min(kwHits * 2, 12);
      }
      result.push({ ...p, score: p.score + contextBonus, url });
    }
  }
  return result;
}

// ─── Fuzzy URL Matcher ─────────────────────────────────────────────────────────
function findBestUrlMatch(aiParagraph, allScoredParagraphs, fallbackUrl) {
  if (!aiParagraph) return fallbackUrl;
  const normAi = aiParagraph.toLowerCase().replace(/\s+/g, " ").trim();

  const exact = allScoredParagraphs.find(
    (p) => p.text.toLowerCase().replace(/\s+/g, " ").trim() === normAi
  );
  if (exact) return exact.url;

  const contained = allScoredParagraphs.find((p) => {
    const pNorm = p.text.toLowerCase().replace(/\s+/g, " ").trim();
    return pNorm.includes(normAi.slice(0, 80)) || normAi.includes(pNorm.slice(0, 80));
  });
  if (contained) return contained.url;

  const aiWords = new Set(normAi.split(/\s+/).filter((w) => w.length > 5));
  let best = { score: 0, url: fallbackUrl };
  for (const p of allScoredParagraphs) {
    const pWords = p.text.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
    const overlap = pWords.filter((w) => aiWords.has(w)).length;
    const ratio = overlap / Math.max(aiWords.size, 1);
    if (ratio > best.score) best = { score: ratio, url: p.url };
  }

  if (best.score >= 0.3) {
    console.log(`[MATCH] Fuzzy match confidence: ${best.score.toFixed(2)} → ${best.url}`);
    return best.url;
  }
  console.log(`[MATCH] Low confidence (${best.score.toFixed(2)}) — using fallback URL`);
  return fallbackUrl;
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────
async function analyzeWithAI(paragraphs, anchor, linkto) {
  const paragraphText = paragraphs
    .map((p, i) => `[${i + 1}]\n${p.text.slice(0, 1000)}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a senior SEO editor placing contextual internal links in blog articles.
Your placements must read as if written by the original author. Never force links.
Respond ONLY with valid JSON. No markdown, no backticks, no explanation outside JSON.`;

  const userPrompt = `Anchor text to place: "${anchor}"
Link destination: ${linkto}
Below are top candidate paragraphs from real articles. Pick the SINGLE best paragraph where inserting the anchor link feels completely natural.
Rules:
- Choose paragraph where topic MOST directly relates to the anchor text concept
- Pick a sentence where "${anchor}" as a hyperlink improves reader experience
- Edit ONLY that sentence — rest stays identical
- Use [[ANCHOR]] as placeholder where anchor text goes
- Do NOT rewrite the paragraph
- If no paragraph is truly relevant, pick best and set relevance_score below 50
Paragraphs:
${paragraphText}
Return this exact JSON (use FULL paragraph text in "paragraph" field, not the index number):
{
  "paragraph": "full original paragraph text here",
  "suggested_sentence": "original sentence before edit",
  "suggested_edit": "edited sentence with [[ANCHOR]] placed naturally",
  "reason": "one sentence explaining why this paragraph and placement works",
  "relevance_score": 85,
  "naturalness_score": 90
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Anthropic API error: ${data.error.message}`);

  const rawText = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI response was not valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  for (const field of ["paragraph", "suggested_edit", "relevance_score"]) {
    if (!parsed[field]) throw new Error(`AI response missing required field: ${field}`);
  }
  return parsed;
}

// ─── Scrape + Extract + Score ──────────────────────────────────────────────────
async function scrapeAndScore(url, anchor, keywords) {
  console.log(`[SCRAPE] Fetching: ${url}`);
  try {
    const { html, status } = await fetchWithRetry(url);
    if (isBlockedPage(html, status)) {
      console.log(`[SCRAPE] Blocked: ${url} (status ${status})`);
      return [];
    }
    const article = extractArticleContent(html, url);
    if (!article) return [];
    const rawParagraphs = segmentParagraphs(article.content);
    console.log(`[SCRAPE] ${rawParagraphs.length} raw paragraphs from ${url}`);
    const seen = new Set();
    const scored = [];
    for (const { text, linkCount } of rawParagraphs) {
      if (seen.has(text)) continue;
      if (!isQualityParagraph(text, linkCount)) continue;
      seen.add(text);
      const score = scoreParagraph(text, anchor, keywords);
      scored.push({ text, score, url });
    }
    console.log(`[SCRAPE] ${scored.length} quality paragraphs scored from ${url}`);
    return scored;
  } catch (err) {
    console.log(`[SCRAPE] Failed for ${url}: ${err.message}`);
    return [];
  }
}

// ─── Core Analysis Logic ───────────────────────────────────────────────────────
async function runAnalysis(domain, anchor, linkto) {
  const { keywords } = extractKeywords(anchor);
  console.log(`[ANALYZE] domain=${domain}, anchor="${anchor}", keywords=${keywords.join(", ")}`);

  const urls = await searchArticles(domain, anchor);
  if (!urls.length) {
    throw new Error("No articles found. Try a different domain or anchor text.");
  }

  let linktoDomain = "";
  try { linktoDomain = new URL(linkto).hostname.replace(/^www\./, ""); } catch {}
  const filteredUrls = urls.filter((url) => !url.includes(linktoDomain));
  if (!filteredUrls.length) {
    throw new Error("All found URLs belong to the linkto domain. Use a different target domain.");
  }

  const scrapeResults = await Promise.allSettled(
    filteredUrls.map((url) => scrapeAndScore(url, anchor, keywords))
  );

  const paragraphsByUrl = {};
  for (const [i, result] of scrapeResults.entries()) {
    if (result.status === "fulfilled" && result.value.length > 0) {
      paragraphsByUrl[filteredUrls[i]] = result.value;
    } else if (result.status === "rejected") {
      console.log(`[SCRAPE] Rejected for ${filteredUrls[i]}: ${result.reason?.message}`);
    }
  }

  if (!Object.keys(paragraphsByUrl).length) {
    throw new Error(
      "No suitable paragraphs found. The site may block scraping or use JavaScript rendering. Try a different domain."
    );
  }

  let allScored = rerankWithContext(paragraphsByUrl, anchor, keywords);
  allScored.sort((a, b) => b.score - a.score);
  console.log(`[RANK] Top 5 scores: ${allScored.slice(0, 5).map((p) => p.score.toFixed(1)).join(", ")}`);

  const MIN_SCORE = 15;
  const qualified = allScored.filter((p) => p.score >= MIN_SCORE);
  const topParagraphs = (qualified.length >= 3 ? qualified : allScored).slice(0, 8);
  console.log(`[RANK] Sending ${topParagraphs.length} paragraphs to AI`);

  const aiResult = await analyzeWithAI(topParagraphs, anchor, linkto);
  const articleUrl = findBestUrlMatch(aiResult.paragraph, allScored, filteredUrls[0]);

  return {
    article_url: articleUrl,
    paragraph: aiResult.paragraph,
    suggested_sentence: aiResult.suggested_sentence || null,
    suggested_edit: aiResult.suggested_edit,
    reason: aiResult.reason || "",
    relevance_score: aiResult.relevance_score,
    naturalness_score: aiResult.naturalness_score || null,
    natural_fit:
      aiResult.relevance_score >= 80 ? "high"
      : aiResult.relevance_score >= 55 ? "medium"
      : "low",
  };
}

// ─── Main API Route ────────────────────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }
  if (!process.env.SERPAPI_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const rawDomain = req.body.domain || "";
  const domain = rawDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const { anchor, linkto } = req.body;

  const validationError = validateInputs(domain, anchor, linkto);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const cacheKey = `${domain}::${anchor.toLowerCase().trim()}::${linkto.toLowerCase().trim()}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[CACHE] Hit: ${cacheKey}`);
    return res.status(200).json({ ...cached, cached: true });
  }

  if (inFlight.has(cacheKey)) {
    console.log(`[INFLIGHT] Waiting on existing request: ${cacheKey}`);
    try {
      const result = await inFlight.get(cacheKey);
      return res.status(200).json({ ...result, cached: true });
    } catch {
      return res.status(500).json({ error: "Analysis failed. Please try again." });
    }
  }

  // FIX: finally guarantees inFlight cleanup even on crash
  const promise = runAnalysis(domain, anchor, linkto).finally(() => {
    inFlight.delete(cacheKey);
  });
  inFlight.set(cacheKey, promise);

  try {
    const result = await promise;
    cache.set(cacheKey, result);
    return res.status(200).json({ ...result, cached: false });
  } catch (err) {
    console.error(`[ERROR] ${err.stack || err.message}`);
    const userFacing =
      err.message?.includes("No articles") ||
      err.message?.includes("No suitable") ||
      err.message?.includes("All found URLs")
        ? err.message
        : "Analysis failed. Please try again or use a different domain/anchor.";
    return res.status(500).json({ error: userFacing });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace v2 running on port ${PORT}`));
