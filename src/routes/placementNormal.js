const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const NodeCache = require("node-cache");
const fs = require("fs");
const path = require("path");

const {
  validateInputs,
  isArticleUrl,
  extractKeywordsLocal,
  DEFAULT_HEADERS,
  fetchWithRetry,
  isBlockedPage,
  analyzeLinktoPage,
  extractArticleContent
} = require("../utils/helpers");

const cache = new NodeCache({ stdTTL: 7200, checkperiod: 600 });
const inFlight = new Map();
const paragraphPoolCache = new NodeCache({ stdTTL: 1800, checkperiod: 300, maxKeys: 200 });

async function searchArticles(domain, anchor, keywords) {
  const phrase = anchor.toLowerCase().trim();
  const queries = [
    `site:${domain} ${keywords.slice(0, 3).join(" ")}`,
    `site:${domain} ${keywords[0] || ""} ${keywords[1] || ""}`,
    `site:${domain} ${keywords[0] || "blog"}`,
    `site:${domain} "${phrase}"`,
  ];

  const allUrls = new Set();
  for (const query of queries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const res = await fetch(
        `https://serpapi.com/search?${new URLSearchParams({ q: query, api_key: process.env.SERPAPI_KEY, engine: "google", num: "10" })}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of (data?.organic_results || [])) {
        if (r.link && r.link.includes(domain) && isArticleUrl(r.link)) allUrls.add(r.link);
      }
    } catch (err) {}
  }
  return [...allUrls].slice(0, 6);
}

function segmentParagraphs(articleHtml) {
  if (!articleHtml) return [];
  try {
    const dom = new JSDOM(articleHtml);
    const doc = dom.window.document;
    const paragraphs = [];
    doc.querySelectorAll("p, blockquote").forEach((el) => {
      if (el.closest("nav, aside, header, footer, ul, ol, li, [class*='toc' i], [id*='toc' i], [class*='table-of-content' i], [id*='table-of-content' i], [class*='content-list' i], [id*='content-list' i], [class*='sidebar' i], [id*='sidebar' i], [class*='menu' i], [id*='menu' i], [class*='widget' i], [id*='widget' i], [class*='index' i], [id*='index' i], [role='doc-toc' i], [role='navigation' i]")) {
        return;
      }
      const text = el.textContent.replace(/\s+/g, " ").trim();
      const linkCount = el.querySelectorAll("a").length;
      if (text.length >= 100 && linkCount <= 3 && !/^\d+[\.\)]\s+/.test(text) && /[.!?]["']?\s*$/.test(text)) {
        paragraphs.push({ text, linkCount });
      }
    });
    return paragraphs;
  } catch (err) {
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
  const midWordBreakPattern = /\b[a-z]{2,}\s[A-Z][a-z]{1,4}\b(?!\.|,|\?|!)/g;
  const matches = text.match(midWordBreakPattern) || [];
  const suspiciousMatches = matches.filter(m => {
    const parts = m.split(/\s/);
    return parts[1].length <= 4 && !/^(AI|US|UK|EU|IT|HR|CEO|CTO|API)$/i.test(parts[1]);
  });
  return suspiciousMatches.length > 0;
}

function mentionstool(text) {
  const toolPatterns = [
    /\b(using|use|with|via|through|powered by|built (on|with)|integrate[sd]? with)\b.{0,40}\b(tool|software|platform|app|service|api)\b/i,
    /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s(?:tool|software|platform|app)\b/,
    /\b(monday\.com|hubspot|salesforce|zapier|ahrefs|semrush|moz|screaming frog|google analytics|mixpanel|amplitude)\b/i,
  ];
  return toolPatterns.filter((re) => re.test(text)).length >= 2;
}

function isQualityParagraph(text, linkCount, isToolTarget = false, domain = "unknown", currentUrl = "unknown") {
  if (text.length < 100) return false;
  if (linkCount > 0) return false;
  if (!/[.!?]["']?\s*$/.test(text)) return false; 
  if (/^\d+[\.\)]\s+[A-Z]/.test(text) && text.length < 150) return false;
  for (const pattern of NOISE_PATTERNS) { if (pattern.test(text)) return false; } 
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.25) return false; 
  if (mentionstool(text)) return false;
  if (hasTextCorruption(text)) return false;
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
  return Math.min(30, (score / Math.sqrt(Math.max(wordCount, 1))) * 15);
}

function scoreParagraph(text, anchor, keywords) {
  const lower = text.toLowerCase();
  const anchorLower = anchor.toLowerCase();
  let score = 0;

  if (lower.includes(anchorLower)) score += 60; 
  else {
    const anchorWords = anchorLower.split(/\s+/).filter((w) => w.length > 3);
    if (anchorWords.length >= 2) {
      const bigrams = [];
      for (let i = 0; i < anchorWords.length - 1; i++) {
        bigrams.push(`${anchorWords[i]} ${anchorWords[i + 1]}`);
      }
      for (const bg of bigrams) {
        if (lower.includes(bg)) score += 20;
      }
    }
  }

  score += computeTfIdfScore(text, keywords); 
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const wordCount = text.split(/\s+/).length;
  if (sentences.length >= 3 && wordCount >= 80 && wordCount <= 300) score += 15;
  else if (sentences.length >= 2 && wordCount >= 50) score += 8;
  if (wordCount < 40) score -= 15; 
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

async function analyzeWithAI(paragraphs, anchor, linkto, linktoInfo) {
  const pool = linktoInfo?.isToolPage
    ? paragraphs.filter((p) => !mentionstool(p.text))
    : paragraphs;

  const finalPool = (pool.length >= 4 ? pool : paragraphs).slice(0, 12);

  const getTierLabel = (score) => {
    if (score >= 45) return "TIER 1 (STRONG match)";
    if (score >= 25) return "TIER 2 (MODERATE match)";
    return "TIER 3 (LAST RESORT related domain)";
  };

  const formatParagraphForAI = (p, idx) => {
    const prevSnippet = p.prevText ? p.prevText.slice(0, 120) : "(none)";
    const nextSnippet = p.nextText ? p.nextText.slice(0, 120) : "(none)";
    return `[${idx}] (Article: ${p.url}, Score: ${p.score ? p.score.toFixed(1) : 0} — ${getTierLabel(p.score || 0)})\nPrevious context: "...${prevSnippet}"\nPARAGRAPH: ${p.text}\nNext context: "${nextSnippet}..."`;
  };

  const paragraphText = finalPool.map((p, i) => formatParagraphForAI(p, i + 1)).join("\n\n---\n\n");
  const linktoBrief = linktoInfo?.title ? `Destination page topic: "${linktoInfo.title.slice(0, 100)}"` : `Destination URL: ${linkto}`;

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
- TIER 2 (score 25–44): MODERATE match — topic is adjacent/related but not a perfect overlap. Use creative edit to bridge the connection. 
- TIER 3 (score < 25): LAST RESORT tier — paragraph discusses a genuinely related broad domain.

═══════════════════════════════════════
STAGE D — PLACEMENT & EDITING RULES (CRITICAL)
═══════════════════════════════════════
1. NATURAL FIT FIRST: if anchor phrase already fits an existing sentence without changing meaning, use minimal edit.
2. MINIMAL EDIT GUARDRAIL: Do NOT rewrite the entire paragraph. You may only modify a maximum of 5 to 7 words, or append a single short bridging sentence.
3. CONTEXT-AWARE FLOW: Your edit MUST flow logically from the previous sentence and into the next sentence.
4. VALIDATION CHECK: The bridging sentence must NOT introduce any concept that isn't already implied.
5. ABSOLUTE NON-IRRELEVANCE RULE: Do not place a link where the paragraph's broad subject domain has NO reasonable relation at all to the target URL.
6. JUSTIFICATION FIELD (always required in "reason"): One sentence explaining the connection.
7. Prefer suggestions from DIFFERENT articles when at least two articles have genuinely strong matches.

Paragraphs:
${paragraphText}
Return this exact JSON with two suggestions:
{
  "suggestions": [
    {
      "paragraph": "full original paragraph text here",
      "suggested_sentence": "original sentence before edit",
      "suggested_edit": "edited sentence with [[ANCHOR]] placed naturally",
      "reason": "one sentence explaining connection",
      "relevance_score": 85,
      "naturalness_score": 90
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
  return parsed.suggestions;
}

async function scrapeAndScore(url, anchor, keywords, isToolTarget = false) {
  try {
    const { html, status } = await fetchWithRetry(url, 2, 18000);
    if (isBlockedPage(html, status)) return "BLOCKED";
    const article = extractArticleContent(html, url);
    if (!article) return [];
    
    const toolReviewPatterns = /\b(review|top 10|top \d+|best|vs|alternative|alternatives|pricing|software|app|platform)\b/i;
    if (article.title && toolReviewPatterns.test(article.title)) return [];
    const urlSlug = new URL(url).pathname.split('/').filter(Boolean).pop() || "";
    if (toolReviewPatterns.test(urlSlug.replace(/-/g, " "))) return [];

    const rawParagraphs = segmentParagraphs(article.content);
    let eligibleParagraphs = rawParagraphs;
    if (rawParagraphs.length >= 4) {
      const excludeCount = Math.max(1, Math.floor(rawParagraphs.length * 0.15));
      eligibleParagraphs = rawParagraphs.slice(excludeCount, rawParagraphs.length - excludeCount);
    } else if (rawParagraphs.length >= 2) {
      eligibleParagraphs = rawParagraphs.slice(1, -1);
    } else {
      eligibleParagraphs = []; 
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
      scored.push({ id, text, score: scoreParagraph(text, anchor, keywords), url, prevText, nextText });
    }
    return scored;
  } catch (err) {
    return [];
  }
}

async function generateKeywordsWithAI(anchor, linkto, linktoInfo) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 150,
        messages: [{
          role: "user",
          content: `Return a JSON array of 4 short, distinct topic keywords related to this anchor text: "${anchor}" and topic: "${linktoInfo.title || linkto}". No explanation, just ["word1", "word2", "word3", "word4"].`
        }],
      }),
    });
    const data = await response.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    const cleanJson = text.replace(/^```json\s*|```\s*$/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    return [];
  }
}

async function runAnalysis(domain, anchor, linkto, excludedParagraphs = [], excludedArticleUrls = []) {
  const poolKey = `pool::${domain}::${anchor.toLowerCase().trim()}::${linkto.toLowerCase().trim()}::false::${excludedArticleUrls.length}`;
  let topParagraphs, allScored, filteredUrls, linktoInfo;
  const cachedPool = paragraphPoolCache.get(poolKey);

  if (cachedPool) {
    ({ topParagraphs, allScored, filteredUrls, linktoInfo } = cachedPool);
  } else {
    const targetPageInfo = await analyzeLinktoPage(linkto);
    linktoInfo = targetPageInfo;
    const keywords = await generateKeywordsWithAI(anchor, linkto, linktoInfo);
    const searchKeywords = [...new Set([...(linktoInfo.aiKeywords || []), ...keywords, ...linktoInfo.keywords])];

    const urls = await searchArticles(domain, anchor, searchKeywords);
    if (!urls.length) throw new Error("No articles found. Try a different domain or anchor text.");

    let linktoDomain = "";
    let cleanDomain = domain.replace(/^www\./, "").split("/")[0].toLowerCase();
    try { linktoDomain = new URL(linkto).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
    
    if (cleanDomain === linktoDomain || linktoDomain.includes(cleanDomain) || cleanDomain.includes(linktoDomain)) {
      filteredUrls = urls.filter((url) => {
        try { return new URL(url).pathname !== new URL(linkto).pathname; } catch { return url !== linkto; }
      });
      if (!filteredUrls.length) throw new Error("No other articles found on this domain to place an internal link.");
    } else {
      filteredUrls = urls.filter((url) => !url.includes(linktoDomain));
      if (!filteredUrls.length) throw new Error("All found URLs belong to the destination domain.");
    }

    const isToolTarget = linktoInfo?.isToolPage || false;
    const scrapeResults = await Promise.allSettled(filteredUrls.map((url) => scrapeAndScore(url, anchor, searchKeywords, isToolTarget)));
    const paragraphsByUrl = {};
    let blockedCount = 0;
    for (const [i, result] of scrapeResults.entries()) {
      if (result.status === "fulfilled") {
        if (result.value === "BLOCKED") blockedCount++;
        else if (result.value.length > 0) paragraphsByUrl[filteredUrls[i]] = result.value;
      }
    }
    if (!Object.keys(paragraphsByUrl).length) {
      if (blockedCount > 0) throw new Error(`The target website (${domain}) is blocking our scraper. We cannot scrape this site.`);
      throw new Error(`No suitable paragraphs found. Try a different domain.`);
    }

    allScored = rerankWithContext(paragraphsByUrl, anchor, searchKeywords);
    allScored.sort((a, b) => b.score - a.score);
    topParagraphs = allScored.slice(0, 30);
    paragraphPoolCache.set(poolKey, { topParagraphs, allScored, filteredUrls, linktoInfo });
  }

  let available = topParagraphs.filter((p) => !excludedParagraphs.includes(p.id) && !excludedArticleUrls.includes(p.url));
  if (available.length < 2) {
    available = allScored.filter((p) => !excludedParagraphs.includes(p.id) && !excludedArticleUrls.includes(p.url));
  }
  const poolToUse = available.length >= 2 ? available : topParagraphs.filter((p) => !excludedParagraphs.includes(p.id));

  const grouped = {};
  for (const p of poolToUse) {
    if (!grouped[p.url]) grouped[p.url] = [];
    grouped[p.url].push(p);
  }
  
  const diversePool = [];
  for (const url in grouped) diversePool.push(...grouped[url].slice(0, 2));
  diversePool.sort((a, b) => b.score - a.score);
  const sendToAI = diversePool.slice(0, 12);

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

async function runAnalysisWithFallback(domain, anchorList, linkto, excludedParagraphs, excludedArticleUrls) {
  for (let i = 0; i < anchorList.length; i++) {
    const currentAnchor = anchorList[i];
    try {
      const result = await runAnalysis(domain, currentAnchor, linkto, excludedParagraphs, excludedArticleUrls);
      if (result && result.length > 0) {
        return {
          suggestions: result,
          anchor_used: currentAnchor,
          was_fallback: i > 0,
          original_anchor_requested: anchorList[0],
          anchors_tried_before_success: anchorList.slice(0, i),
        };
      }
    } catch (err) {}
  }
  const err = new Error(`None of the ${anchorList.length} anchor variations found a suitable placement on this domain.`);
  err.code = "no_valid_placement_any_anchor";
  err.anchors_tried = anchorList;
  throw err;
}

router.post("/", async (req, res) => {
  const rawDomain = req.body.domain || "";
  const domain = rawDomain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const { anchor, altAnchor, linkto } = req.body;
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

  const cacheKey = `${domain}::${anchorList.join("||").toLowerCase().trim()}::${linkto.toLowerCase().trim()}::${excludeHash}::false`;

  const useCache = excludedParagraphs.length === 0 && excludedArticleUrls.length === 0;
  const cached = useCache ? cache.get(cacheKey) : null;
  if (cached) return res.status(200).json({ ...cached, cached: true });
  if (inFlight.has(cacheKey)) {
    try { const result = await inFlight.get(cacheKey); return res.status(200).json({ ...result, cached: true }); }
    catch { return res.status(500).json({ error: "Analysis failed. Please try again." }); }
  }

  const attemptAnalysis = async () => {
    return await runAnalysisWithFallback(domain, anchorList, linkto, excludedParagraphs, excludedArticleUrls);
  };

  const promise = attemptAnalysis().finally(() => inFlight.delete(cacheKey));
  inFlight.set(cacheKey, promise);
  try {
    const results = await promise;
    const response = { ...results, cached: false };
    cache.set(cacheKey, response);
    return res.status(200).json(response);
  } catch (err) {
    if (err.code === "no_valid_placement_any_anchor") {
      return res.status(404).json({
        error: "no_valid_placement_any_anchor",
        message: err.message,
        anchors_tried: err.anchors_tried || anchorList
      });
    }
    const userFacing = err.message?.includes("No articles") || err.message?.includes("No suitable") || err.message?.includes("All found URLs")
      ? err.message : "Analysis failed. Please try again or use a different domain/anchor.";
    return res.status(500).json({ error: userFacing });
  }
});

module.exports = router;
