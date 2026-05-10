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

// ─── Decode DuckDuckGo Redirect URLs ──────────────────────────────────────────
function decodeDuckDuckGoUrl(href) {
  if (!href) return null;
  try {
    if (href.includes("uddg=")) {
      const match = href.match(/uddg=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    if (href.startsWith("http")) return href;
    return null;
  } catch {
    return null;
  }
}

// ─── Step 1: DuckDuckGo Search (FREE) ──────────────────────────────────────────
async function searchArticles(domain, anchor) {
  // FIX 1: anchor is now actually used in queries for topical relevance
  const anchorTopic = anchor.split(/\s+/).slice(0, 3).join(" ");
  const queries = [
    `site:${domain} ${anchorTopic}`,
    `site:${domain} blog ${anchorTopic}`,
    `site:${domain} blog`,
    `site:${domain}`,
  ];

  for (const query of queries) {
    console.log(`[SEARCH] Query: ${query}`);
    try {
      const urls = await withRetry(async () => {
        const response = await axios.post(
          "https://html.duckduckgo.com/html/",
          `q=${encodeURIComponent(query)}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Referer": "https://duckduckgo.com/",
            },
            timeout: 20000,
            maxRedirects: 5,
          }
        );

        const $ = cheerio.load(response.data);
        const urls = [];

        // Multiple selectors with fallback
        const selectors = ["a.result__a", ".result__title a", "h2.result__title a", ".results .result a"];
        for (const selector of selectors) {
          $(selector).each((_, el) => {
            const href = $(el).attr("href");
            const decoded = decodeDuckDuckGoUrl(href);
            if (decoded && decoded.includes(domain)) {
              urls.push(decoded);
            }
          });
          if (urls.length > 0) break;
        }

        // Fallback: result__url text
        if (urls.length === 0) {
          $(".result__url").each((_, el) => {
            let url = $(el).text().trim();
            if (url && url.includes(domain)) {
              if (!url.startsWith("http")) url = "https://" + url;
              urls.push(url);
            }
          });
        }

        // FIX 2: Removed dead `regex` variable, only domainRegex is used
        if (urls.length === 0) {
          const rawHtml = response.data;
          const domainEscaped = domain.replace(/\./g, "\\.");
          const domainRegex = new RegExp(`https?:\\/\\/[^\\s"'<>]*${domainEscaped}[^\\s"'<>]*`, "g");
          const matches = rawHtml.match(domainRegex) || [];
          urls.push(...matches.map((u) => decodeURIComponent(u)));
        }

        return [...new Set(urls)].slice(0, 5);
      });

      if (urls.length > 0) {
        console.log(`[SEARCH] Found ${urls.length} URLs: ${urls.join(", ")}`);
        return urls;
      }
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

// ─── Lightweight Semantic Scoring ─────────────────────────────────────────────
function scoreparagraph(text, anchor) {
  let score = 0;
  const lower = text.toLowerCase();
  const anchorWords = anchor.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
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

        const score = scoreparagraph(text, anchor);
        scoredParagraphs.push({ text, score });
      });

      const top = scoredParagraphs
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((p) => p.text);

      console.log(`[SCRAPE] ${scoredParagraphs.length} paragraphs found, sending top ${top.length} to AI`);
      return top;
    });
  } catch (err) {
    console.log(`[SCRAPE] Failed for ${url}: ${err.message}`);
    return [];
  }
}

// ─── Step 3: Claude Haiku — Paragraph Selection Only (LOW COST) ────────────────
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
    const urls = await searchArticles(domain, anchor);
    if (!urls.length) {
      return res.status(404).json({ error: "No articles found. Try a different domain or anchor." });
    }

    const filteredUrls = urls.filter((url) => !url.includes(linktoDomain));

    const scrapeResults = await Promise.allSettled(
      filteredUrls.map((url) => scrapeParagraphs(url, anchor).then((paragraphs) => ({ url, paragraphs })))
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
