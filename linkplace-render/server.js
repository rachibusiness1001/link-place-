const express = require("express");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── In-Memory Cache (1 hour) ──────────────────────────────────────────────────
const cache = {};
const CACHE_TTL = 60 * 60 * 1000;

function getCacheKey(domain, anchor, linkto) {
  return `${domain}::${anchor.toLowerCase().trim()}::${linkto.toLowerCase().trim()}`;
}

// ─── Retry Helper ──────────────────────────────────────────────────────────────
async function withRetry(fn, maxAttempts = 2, delay = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.log(`[RETRY] Attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

// ─── URL Filtering ─────────────────────────────────────────────────────────────
// These are exact path segments that indicate index/listing pages — not articles
const INDEX_SEGMENTS = new Set([
  "blog", "blogs", "category", "categories", "tag", "tags",
  "author", "authors", "news", "resources", "topics", "archive",
  "page", "feed", "rss", "sitemap", "search",
]);

// These path prefixes indicate non-article pages
const SKIP_PATH_PREFIXES = [
  "/pricing", "/about", "/contact", "/login", "/signup", "/register",
  "/cart", "/checkout", "/account", "/terms", "/privacy", "/faq",
  "/support", "/demo", "/features", "/product", "/plans", "/free-trial",
  "/alternatives", "/404", "/cdn-cgi", "/wp-admin", "/wp-login",
];

function isArticleUrl(url) {
  try {
    const parsed = new URL(url);
    const urlPath = parsed.pathname.replace(/\/$/, "");

    // Reject homepage
    if (urlPath === "" || urlPath === "/") {
      console.log(`[URL REJECT] Homepage: ${url}`);
      return false;
    }

    // Reject non-article prefixes
    if (SKIP_PATH_PREFIXES.some((kw) => urlPath.toLowerCase().startsWith(kw))) {
      console.log(`[URL REJECT] Non-article prefix: ${url}`);
      return false;
    }

    const segments = urlPath.split("/").filter(Boolean);

    // If only 1 segment — allow ONLY if it's not a known index segment
    if (segments.length === 1) {
      if (INDEX_SEGMENTS.has(segments[0].toLowerCase())) {
        console.log(`[URL REJECT] Index-only path: ${url}`);
        return false;
      }
      // e.g. /seo-guide or /best-email-tools — these are valid article slugs
      return true;
    }

    // If 2+ segments — reject if LAST segment is a pure number (pagination)
    const lastSegment = segments[segments.length - 1];
    if (/^\d+$/.test(lastSegment)) {
      console.log(`[URL REJECT] Pagination URL: ${url}`);
      return false;
    }

    // If all segments are index segments — reject
    // e.g. /blog/category or /news/tag
    const nonIndexSegments = segments.filter(s => !INDEX_SEGMENTS.has(s.toLowerCase()));
    if (nonIndexSegments.length === 0) {
      console.log(`[URL REJECT] All index segments: ${url}`);
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// ─── AI Topic Extractor (~$0.00004 per call) ───────────────────────────────────
async function extractTopics(anchor, linkto) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 30,
        messages: [{
          role: "user",
          content: `Give 3 short search keywords for: anchor="${anchor}" url="${linkto}". Return ONLY comma-separated keywords, nothing else.`
        }],
      }),
    });
    const data = await response.json();
    const text = (data.content || []).map(i => i.type === "text" ? i.text : "").join("").trim();
    console.log(`[TOPICS] Extracted: ${text}`);
    return text;
  } catch (err) {
    console.log(`[TOPICS] Failed: ${err.message}`);
    return anchor;
  }
}

// ─── Step 1: SerpAPI Search ────────────────────────────────────────────────────
async function searchArticles(domain, anchor, topics) {
  const searchTerm = topics || anchor;

  const queries = [
    `site:${domain} "${anchor}"`,
    `site:${domain} inurl:blog "${anchor}"`,
    `site:${domain} ${searchTerm}`,
    `site:${domain} inurl:blog ${searchTerm}`,
    `site:${domain} inurl:guide ${searchTerm}`,
    `site:${domain} inurl:resources ${searchTerm}`,
  ];

  const allUrls = new Set();

  for (const query of queries) {
    if (allUrls.size >= 5) break;
    console.log(`[SEARCH] Query: ${query}`);
    try {
      const response = await withRetry(() =>
        axios.get("https://serpapi.com/search", {
          params: {
            q: query,
            api_key: process.env.SERPAPI_KEY,
            engine: "google",
            num: 10,
          },
          timeout: 20000,
        })
      );

      const results = response.data?.organic_results || [];
      for (const r of results) {
        if (r.link && r.link.includes(domain) && isArticleUrl(r.link)) {
          allUrls.add(r.link);
        }
      }

      console.log(`[SEARCH] Total valid article URLs so far: ${allUrls.size}`);
      if (allUrls.size >= 3) break;
    } catch (err) {
      console.log(`[SEARCH] Query failed: ${err.message}`);
    }
  }

  const urls = [...allUrls].slice(0, 5);
  console.log(`[SEARCH] Final article URLs: ${urls.join(", ")}`);
  return urls;
}

// ─── HTML Cleanup ──────────────────────────────────────────────────────────────
function cleanHtml($) {
  $("script, style, noscript, iframe, nav, footer, header, aside, form").remove();
  $("[class*='sidebar'], [class*='widget'], [class*='related'], [class*='newsletter'], [id*='sidebar']").remove();
  return $;
}

// ─── Cloudflare Detection ──────────────────────────────────────────────────────
function isBlockedPage(html) {
  const lower = html.toLowerCase();
  return (
    lower.includes("cf-browser-verification") ||
    lower.includes("cloudflare") ||
    lower.includes("attention required") ||
    lower.includes("enable javascript and cookies") ||
    lower.includes("please enable cookies") ||
    lower.includes("ddos protection")
  );
}

// ─── Paragraph Quality Filter ──────────────────────────────────────────────────
const REJECT_PARAGRAPH_KEYWORDS = [
  "subscribe", "newsletter", "sign up", "sign-up", "related posts",
  "read more", "click here", "buy now", "get started", "free trial",
  "limited time", "exclusive offer", "follow us", "share this",
  "leave a comment", "cookie", "privacy policy", "terms of service",
  "all rights reserved", "copyright",
];

function isQualityParagraph(text, linkCount) {
  if (text.length < 80) {
    console.log(`[PARA REJECT] Too short (${text.length} chars): ${text.slice(0, 60)}...`);
    return false;
  }
  if (linkCount > 2) {
    console.log(`[PARA REJECT] Too many links (${linkCount}): ${text.slice(0, 60)}...`);
    return false;
  }
  const lower = text.toLowerCase();
  for (const kw of REJECT_PARAGRAPH_KEYWORDS) {
    if (lower.includes(kw)) {
      console.log(`[PARA REJECT] Contains "${kw}": ${text.slice(0, 60)}...`);
      return false;
    }
  }
  return true;
}

// ─── Semantic Scorer ──────────────────────────────────────────────────────────
function scoreParagraph(text, anchor, topics) {
  let score = 0;
  const lower = text.toLowerCase();
  const anchorWords = anchor.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const topicWords = (topics || "").toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const wordCount = text.split(/\s+/).length;

  // Word count scoring
  if (wordCount >= 50 && wordCount <= 250) score += 20;
  else if (wordCount >= 30) score += 10;

  // Sentence richness
  if (sentences.length >= 2) score += 15;
  if (sentences.length >= 3) score += 10;

  // Anchor word matches
  const anchorMatchCount = anchorWords.filter((word) => lower.includes(word)).length;
  score += anchorMatchCount * 15;

  // Full anchor phrase match
  if (lower.includes(anchor.toLowerCase())) score += 30;

  // Partial anchor match
  const anchorParts = anchor.toLowerCase().split(/\s+/);
  const partialMatch = anchorParts.filter((w) => w.length > 2 && lower.includes(w)).length;
  if (partialMatch >= Math.ceil(anchorParts.length / 2)) score += 15;

  // Topic word matches (from AI extracted topics)
  const topicMatchCount = topicWords.filter((word) => lower.includes(word)).length;
  score += topicMatchCount * 10;

  // Informational tone — penalize promotional
  const promoWords = ["buy", "sale", "discount", "offer", "deal", "free", "click", "subscribe"];
  const promoCount = promoWords.filter(w => lower.includes(w)).length;
  score -= promoCount * 10;

  // Caps ratio — penalize all-caps heavy text
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio < 0.15) score += 10;

  // Penalize very short or very long
  if (wordCount < 30) score -= 20;
  if (wordCount > 400) score -= 5;

  console.log(`[PARA SCORE] ${score} pts: ${text.slice(0, 80)}...`);
  return score;
}

// ─── Step 2: Scrape Paragraphs ─────────────────────────────────────────────────
async function scrapeParagraphs(url, anchor, topics) {
  console.log(`[SCRAPE] Fetching: ${url}`);
  try {
    return await withRetry(async () => {
      const response = await axios.get(url, {
        timeout: 20000,
        maxRedirects: 5,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Connection": "keep-alive",
        },
      });

      if (isBlockedPage(response.data)) {
        console.log(`[SCRAPE] Blocked page detected: ${url}`);
        return [];
      }

      let $ = cheerio.load(response.data);
      $ = cleanHtml($);

      const seen = new Set();
      const scoredParagraphs = [];

      $("p").each((_, el) => {
        const text = $(el).text().trim();
        const linkCount = $(el).find("a").length;

        if (seen.has(text)) return;
        if (!isQualityParagraph(text, linkCount)) return;

        seen.add(text);
        const score = scoreParagraph(text, anchor, topics);
        scoredParagraphs.push({ text, score, url });
      });

      console.log(`[SCRAPE] ${scoredParagraphs.length} quality paragraphs from ${url}`);
      return scoredParagraphs;
    });
  } catch (err) {
    console.log(`[SCRAPE] Failed for ${url}: ${err.message}`);
    return [];
  }
}

// ─── Step 3: Claude Haiku ──────────────────────────────────────────────────────
async function analyzeWithAI(paragraphs, anchor, linkto) {
  const paragraphText = paragraphs.map((p, i) => `[${i + 1}] ${p.text}`).join("\n\n");
  console.log(`[AI] Sending ${paragraphs.length} paragraphs, ${paragraphText.length} chars`);

  const prompt = `Pick the best paragraph to insert anchor "${anchor}" linking to ${linkto}.
Rules: positive tone only, natural fit, minimal edit, use [[ANCHOR]] placeholder.

${paragraphText}

Return ONLY this JSON, no markdown, no backticks. Use the FULL paragraph text in "paragraph" field, NOT the index number:
{"paragraph":"full paragraph text here","suggested_sentence":"original sentence being edited","suggested_edit":"edited sentence with [[ANCHOR]]","reason":"1 sentence why this is best spot","relevance_score":80}`;

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
      max_tokens: 500,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const text = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("");
  console.log(`[AI] Raw response: ${text}`);

  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse AI response");

  return JSON.parse(match[0]);
}

// ─── Main API Route ────────────────────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { domain, anchor, linkto } = req.body;

  if (!domain || !anchor || !linkto) {
    return res.status(400).json({ error: "domain, anchor, and linkto are required" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }
  if (!process.env.SERPAPI_KEY) {
    return res.status(500).json({ error: "SERPAPI_KEY not configured" });
  }

  const cacheKey = getCacheKey(domain, anchor, linkto);
  if (cache[cacheKey] && Date.now() - cache[cacheKey].time < CACHE_TTL) {
    console.log(`[CACHE] Hit for ${cacheKey}`);
    return res.status(200).json({ ...cache[cacheKey].data, cached: true });
  }

  let linktoDomain = "";
  try {
    linktoDomain = new URL(linkto).hostname.replace(/^www\./, "");
  } catch (e) {
    linktoDomain = linkto;
  }

  try {
    // Step 0: Extract topics via AI (~$0.00004)
    const topics = await extractTopics(anchor, linkto);

    // Step 1: Search
    const urls = await searchArticles(domain, anchor, topics);
    if (!urls.length) {
      return res.status(404).json({ error: "No articles found. Try a different domain or anchor." });
    }

    const filteredUrls = urls.filter((url) => !url.includes(linktoDomain));

    // Step 2: Scrape ALL urls in parallel — combine all paragraphs
    const scrapeResults = await Promise.allSettled(
      filteredUrls.map((url) => scrapeParagraphs(url, anchor, topics))
    );

    // Combine all paragraphs from all URLs and rank globally
    let allScoredParagraphs = [];
    let urlForBestParagraph = filteredUrls[0];

    for (let i = 0; i < scrapeResults.length; i++) {
      const result = scrapeResults[i];
      if (result.status === "fulfilled" && result.value.length > 0) {
        allScoredParagraphs.push(...result.value);
      }
    }

    if (!allScoredParagraphs.length) {
      return res.status(404).json({ error: "No suitable paragraphs found. Try a different anchor or domain." });
    }

    // Global rank — pick top 6 paragraphs across all URLs
    allScoredParagraphs.sort((a, b) => b.score - a.score);
    const topParagraphs = allScoredParagraphs.slice(0, 6);
    urlForBestParagraph = topParagraphs[0].url;

    console.log(`[RANK] Top ${topParagraphs.length} paragraphs selected globally from ${filteredUrls.length} URLs`);

    // Step 3: AI picks best
    const aiResult = await analyzeWithAI(topParagraphs, anchor, linkto);

    // Find which URL the AI selected paragraph came from
    const matchedPara = allScoredParagraphs.find(p => p.text === aiResult.paragraph);
    const articleUrl = matchedPara ? matchedPara.url : urlForBestParagraph;

    const finalResult = {
      article_url: articleUrl,
      paragraph: aiResult.paragraph,
      suggested_sentence: aiResult.suggested_sentence || null,
      suggested_edit: aiResult.suggested_edit,
      reason: aiResult.reason || "",
      relevance_score: aiResult.relevance_score,
      natural_fit: aiResult.relevance_score >= 80 ? "high" : aiResult.relevance_score >= 60 ? "medium" : "low",
      cached: false,
    };

    cache[cacheKey] = { data: finalResult, time: Date.now() };
    return res.status(200).json(finalResult);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    return res.status(500).json({ error: err.message || "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LinkPlace running on port ${PORT}`));
