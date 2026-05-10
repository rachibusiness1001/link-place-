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

// FIX 8: Cache key now includes linkto
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

// ─── Step 1: SerpApi Google Search ────────────────────────────────────────────
async function searchArticles(domain, anchor) {
  // FIX 2: Exact match support with quoted anchor
  const queries = [
    `site:${domain} "${anchor}"`,
    `site:${domain} ${anchor}`,
    `site:${domain} blog ${anchor}`,
    `site:${domain}`,
  ];

  for (const query of queries) {
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
      const urls = results
        .map((r) => r.link)
        .filter((url) => url && url.includes(domain))
        .slice(0, 5);

      console.log(`[SEARCH] Found ${urls.length} URLs: ${urls.join(", ")}`);
      if (urls.length > 0) return urls;
    } catch (err) {
      console.log(`[SEARCH] Query failed: ${err.message}`);
    }
  }

  return [];
}

// ─── HTML Cleanup ──────────────────────────────────────────────────────────────
function cleanHtml($) {
  $("script, style, noscript, iframe, nav, footer, header, aside").remove();
  return $;
}

// ─── FIX 3: Detect Cloudflare / Bot Protection ────────────────────────────────
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

// ─── Lightweight Semantic Scoring ─────────────────────────────────────────────
function scoreParagraph(text, anchor) {
  let score = 0;
  const lower = text.toLowerCase();
  // FIX 1: Allow shorter technical words like ai, llm, 403
  const anchorWords = anchor.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);

  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 50 && wordCount <= 200) score += 20;
  else if (wordCount >= 30) score += 10;

  if (sentences.length >= 2) score += 15;
  if (sentences.length >= 3) score += 10;

  const anchorMatchCount = anchorWords.filter((word) => lower.includes(word)).length;
  score += anchorMatchCount * 15;

  const anchorPhrase = anchor.toLowerCase();
  if (lower.includes(anchorPhrase)) score += 30;

  // FIX 1: Bonus for partial technical phrase match
  const anchorParts = anchorPhrase.split(/\s+/);
  const partialMatch = anchorParts.filter((w) => w.length > 2 && lower.includes(w)).length;
  if (partialMatch >= Math.ceil(anchorParts.length / 2)) score += 15;

  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio < 0.15) score += 10;

  if (wordCount < 30) score -= 20;
  if (wordCount > 300) score -= 10;

  return score;
}

// ─── Step 2: Scrape Paragraphs ─────────────────────────────────────────────────
async function scrapeParagraphs(url, anchor) {
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

      // FIX 3: Detect and skip blocked pages
      if (isBlockedPage(response.data)) {
        console.log(`[SCRAPE] Blocked page detected (Cloudflare/bot protection): ${url}`);
        return [];
      }

      let $ = cheerio.load(response.data);
      $ = cleanHtml($);

      const seen = new Set();
      const scoredParagraphs = [];

      $("p").each((_, el) => {
        const text = $(el).text().trim();
        const linkCount = $(el).find("a").length;

        if (text.length < 80) return;
        if (linkCount > 2) return;
        if (seen.has(text)) return;

        seen.add(text);

        const score = scoreParagraph(text, anchor);
        scoredParagraphs.push({ text, score });
      });

      // FIX 4: Filter weak paragraphs before sending to AI
      // FIX 5: Trim long paragraphs to reduce token usage
      const top = scoredParagraphs
        .filter((p) => p.score > 15)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((p) => p.text.slice(0, 1200));

      console.log(`[SCRAPE] ${scoredParagraphs.length} total, ${top.length} quality paragraphs sending to AI`);
      return top;
    });
  } catch (err) {
    console.log(`[SCRAPE] Failed for ${url}: ${err.message}`);
    return [];
  }
}

// ─── Step 3: Claude Haiku — Paragraph Selection Only ──────────────────────────
async function analyzeWithAI(paragraphs, anchor, linkto) {
  const paragraphText = paragraphs.map((p, i) => `[${i + 1}] ${p}`).join("\n\n");
  console.log(`[AI] Sending ${paragraphs.length} paragraphs, ${paragraphText.length} chars`);

  const prompt = `Pick the best paragraph to insert anchor "${anchor}" linking to ${linkto}.
Rules: positive tone only, natural fit, minimal edit, use [[ANCHOR]] placeholder.

${paragraphText}

Return ONLY JSON: {"paragraph":"","suggested_edit":"","relevance_score":0}`;

  // FIX 7: AbortSignal timeout to prevent hanging requests
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    // FIX 7
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
      // FIX 6: Stable temperature for consistent JSON output
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const text = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("");
  console.log(`[AI] Raw response: ${text}`);

  const match = text.match(/\{[\s\S]*\}/);
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

  // FIX 8: Cache key includes linkto
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
    const urls = await searchArticles(domain, anchor);
    if (!urls.length) {
      return res.status(404).json({ error: "No articles found. Try a different domain or anchor." });
    }

    const filteredUrls = urls.filter((url) => !url.includes(linktoDomain));

    const scrapeResults = await Promise.allSettled(
      filteredUrls.map((url) =>
        scrapeParagraphs(url, anchor).then((paragraphs) => ({ url, paragraphs }))
      )
    );

    let allParagraphs = [];
    let articleUrl = "";

    for (const result of scrapeResults) {
      if (result.status === "fulfilled" && result.value.paragraphs.length > 0) {
        allParagraphs = result.value.paragraphs;
        articleUrl = result.value.url;
        break;
      }
    }

    if (!allParagraphs.length) {
      return res.status(404).json({ error: "No suitable paragraphs found. Try a different anchor or domain." });
    }

    const aiResult = await analyzeWithAI(allParagraphs, anchor, linkto);

    const finalResult = {
      article_url: articleUrl,
      paragraph: aiResult.paragraph,
      suggested_edit: aiResult.suggested_edit,
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
