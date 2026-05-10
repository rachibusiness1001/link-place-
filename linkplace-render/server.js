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

// ─── Retry Helper ──────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 2, delay = 1000) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      console.log(`[RETRY] Attempt ${i + 1} failed: ${err.message}. Retrying...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// ─── Decode DuckDuckGo Redirect URLs ──────────────────────────────────────────
function decodeDDGUrl(href) {
  if (!href) return null;
  if (href.includes("uddg=")) {
    try {
      const url = new URL("https://duckduckgo.com" + href);
      const uddg = url.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);
    } catch (e) {}
  }
  if (href.startsWith("http")) return href;
  return null;
}

// ─── Step 1: DuckDuckGo Search (FREE) ──────────────────────────────────────────
async function searchArticles(domain, anchor) {
  // Broad query — not exact anchor match
  const query = `site:${domain} blog`;
  console.log(`[SEARCH] Query: ${query}`);

  return withRetry(async () => {
    const response = await axios.post(
      "https://html.duckduckgo.com/html/",
      `q=${encodeURIComponent(query)}&b=&kl=&df=`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Origin": "https://duckduckgo.com",
          "Referer": "https://duckduckgo.com/",
        },
        timeout: 20000,
        maxRedirects: 5,
      }
    );

    const $ = cheerio.load(response.data);
    const urls = [];

    // Primary selectors
    const selectors = ["a.result__a", ".result__a", "a.result-link", ".result h2 a", "h2 a"];
    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const decoded = decodeDDGUrl($(el).attr("href"));
        if (decoded && decoded.includes(domain)) urls.push(decoded);
      });
      if (urls.length > 0) break;
    }

    // Fallback: all links
    if (urls.length === 0) {
      $("a").each((_, el) => {
        const decoded = decodeDDGUrl($(el).attr("href"));
        if (decoded && decoded.includes(domain)) urls.push(decoded);
      });
    }

    // Regex fallback
    if (urls.length === 0) {
      const regex = new RegExp(`https?://[\\w./%-]*${domain.replace(".", "\\.")}[\\w./%-]*`, "g");
      const matches = response.data.match(regex) || [];
      urls.push(...matches);
    }

    const unique = [...new Set(urls)].slice(0, 3);
    console.log(`[SEARCH] Found ${unique.length} URLs: ${unique.join(", ")}`);
    return unique;
  });
}

// ─── Lightweight Semantic Scorer ───────────────────────────────────────────────
function scoreParapraph(text, anchor) {
  let score = 0;
  const lower = text.toLowerCase();
  const anchorWords = anchor.toLowerCase().split(" ").filter((w) => w.length > 3);

  // Topical overlap
  anchorWords.forEach((word) => {
    if (lower.includes(word)) score += 10;
  });

  // Sentence richness — longer paragraphs score higher
  if (text.length > 200) score += 5;
  if (text.length > 350) score += 5;

  // Readability — not too many special chars
  const specialChars = (text.match(/[^a-zA-Z0-9\s.,!?]/g) || []).length;
  if (specialChars < 10) score += 3;

  // Penalize if starts with list-like patterns
  if (/^[\d\-\*\•]/.test(text.trim())) score -= 5;

  return score;
}

// ─── Step 2: Scrape Paragraphs (NO AI) ─────────────────────────────────────────
async function scrapeParagraphs(url, anchor) {
  console.log(`[SCRAPE] Fetching: ${url}`);
  return withRetry(async () => {
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
      },
    });

    const $ = cheerio.load(response.data);

    // Clean up noise
    $("script, style, noscript").remove();

    const seen = new Set();
    const scored = [];

    $("p").each((_, el) => {
      const text = $(el).text().trim();
      const linkCount = $(el).find("a").length;

      if (text.length < 80) return;
      if (linkCount > 2) return;   // only reject heavily linked
      if (seen.has(text)) return;

      const lower = text.toLowerCase();
      const skipKeywords = [
        "in conclusion", "in summary", "to summarize",
        "in this article", "we will cover", "table of contents",
        "in this guide", "in this post", "in this tutorial",
      ];
      if (skipKeywords.some((kw) => lower.startsWith(kw))) return;

      seen.add(text);
      scored.push({ text, score: scoreParapraph(text, anchor) });
    });

    // Sort by score and take top 6
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 6).map((p) => p.text);

    console.log(`[SCRAPE] ${top.length} quality paragraphs selected from ${scored.length} total`);
    return top;
  }, 2, 1500);
}

// ─── Step 3: Claude Haiku — Paragraph Selection Only ───────────────────────────
async function analyzeWithAI(paragraphs, anchor, linkto) {
  const paragraphText = paragraphs.map((p, i) => `[${i + 1}] ${p}`).join("\n\n");
  console.log(`[AI] Sending ${paragraphs.length} paragraphs, ${paragraphText.length} chars`);

  const prompt = `Pick the best paragraph to insert anchor "${anchor}" linking to ${linkto}.
Rules: positive tone only, natural fit, minimal edit, use [[ANCHOR]] placeholder.

${paragraphText}

Return ONLY JSON: {"paragraph":"","suggested_edit":"","relevance_score":0}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 200,
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

// ─── Main API Route ─────────────────────────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { domain, anchor, linkto } = req.body;

  if (!domain || !anchor || !linkto) {
    return res.status(400).json({ error: "domain, anchor, and linkto are required" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

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
    if (!urls.length) {
      return res.status(404).json({ error: "No articles found. Try a different domain or anchor." });
    }

    const filteredUrls = urls.filter((url) => !url.includes(linktoDomain));

    // Step 2: Parallel scraping
    const scrapeResults = await Promise.allSettled(
      filteredUrls.map((url) => scrapeParagraphs(url, anchor))
    );

    let allParagraphs = [];
    let articleUrl = "";

    for (let i = 0; i < scrapeResults.length; i++) {
      const result = scrapeResults[i];
      if (result.status === "fulfilled" && result.value.length > 0) {
        allParagraphs = result.value;
        articleUrl = filteredUrls[i];
        break;
      }
    }

    if (!allParagraphs.length) {
      return res.status(404).json({ error: "No suitable paragraphs found. Try a different anchor or domain." });
    }

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
