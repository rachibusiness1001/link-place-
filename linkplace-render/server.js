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

function getCacheKey(domain, anchor) {
  return `${domain}::${anchor.toLowerCase().trim()}`;
}

// ─── Step 1: Google Custom Search (NO AI) ──────────────────────────────────────
async function searchArticles(domain, anchor) {
  const query = `site:${domain} ${anchor}`;
  console.log(`[SEARCH] Query: ${query}`);

  const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
    params: {
      key: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_CSE_ID,
      q: query,
      num: 5,
    },
    timeout: 10000,
  });

  const items = response.data.items || [];
  const urls = items.slice(0, 3).map((r) => r.link).filter(Boolean);
  console.log(`[SEARCH] Found URLs: ${urls.join(", ")}`);
  return urls;
}

// ─── Step 2: Scrape Paragraphs via Cheerio (NO AI) ─────────────────────────────
async function scrapeParagraphs(url, anchor) {
  console.log(`[SCRAPE] Fetching: ${url}`);
  try {
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const $ = cheerio.load(response.data);
    const seen = new Set();
    const paragraphs = [];

    $("p").each((_, el) => {
      const text = $(el).text().trim();
      const hasLink = $(el).find("a").length > 0;

      if (text.length < 80) return;        // too short
      if (hasLink) return;                  // already has link
      if (seen.has(text)) return;           // duplicate

      // Skip intro/conclusion
      const lower = text.toLowerCase();
      const skipKeywords = ["in conclusion", "in summary", "to summarize", "in this article", "we will cover", "table of contents", "in this guide", "in this post"];
      if (skipKeywords.some((kw) => lower.startsWith(kw))) return;

      // Basic relevance check
      const anchorWords = anchor.toLowerCase().split(" ");
      const hasRelevance = anchorWords.some((word) => word.length > 3 && lower.includes(word));
      if (!hasRelevance) return;

      seen.add(text);
      paragraphs.push(text);
    });

    const limited = paragraphs.slice(0, 8);
    console.log(`[SCRAPE] ${limited.length} paragraphs found after filtering`);
    return limited;
  } catch (err) {
    console.log(`[SCRAPE] Failed: ${err.message}`);
    return [];
  }
}

// ─── Step 3: Claude Haiku — Only paragraph selection (LOW COST) ────────────────
async function analyzeWithAI(paragraphs, anchor, linkto) {
  const paragraphText = paragraphs.map((p, i) => `[${i + 1}] ${p}`).join("\n\n");
  console.log(`[AI] Input: ${paragraphText.length} chars, ${paragraphs.length} paragraphs`);

  const prompt = `Pick the best paragraph to insert anchor "${anchor}" as a hyperlink to ${linkto}.
Rules: positive tone, natural fit, do not rewrite — minimal edit only, use [[ANCHOR]] as placeholder.

Paragraphs:
${paragraphText}

Return ONLY JSON:
{"paragraph":"","suggested_edit":"","relevance_score":0}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const text = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse AI response");

  return JSON.parse(match[0]);
}

// ─── Main API Route ─────────────────────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { domain, anchor, linkto } = req.body;

  if (!domain || !anchor || !linkto) {
    return res.status(400).json({ error: "domain, anchor, and linkto are required" });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  if (!process.env.GOOGLE_API_KEY) return res.status(500).json({ error: "GOOGLE_API_KEY not configured" });
  if (!process.env.GOOGLE_CSE_ID) return res.status(500).json({ error: "GOOGLE_CSE_ID not configured" });

  // Cache check
  const cacheKey = getCacheKey(domain, anchor);
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
    // Step 1: Search
    const urls = await searchArticles(domain, anchor);
    if (!urls.length) return res.status(404).json({ error: "No articles found for this domain and anchor." });

    // Filter own domain
    const filteredUrls = urls.filter((url) => !url.includes(linktoDomain));

    // Step 2: Scrape
    let allParagraphs = [];
    let articleUrl = "";

    for (const url of filteredUrls) {
      const paragraphs = await scrapeParagraphs(url, anchor);
      if (paragraphs.length > 0) {
        allParagraphs = paragraphs;
        articleUrl = url;
        break;
      }
    }

    if (!allParagraphs.length) return res.status(404).json({ error: "No suitable paragraphs found. Try a different anchor or domain." });

    // Step 3: AI
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
