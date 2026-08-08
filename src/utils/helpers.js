"use strict";

const crypto = require("crypto");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

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
    const lowerPath = urlPath.toLowerCase();
    const isBlogPath = BLOG_PATH_INDICATORS.some((indicator) => lowerPath.includes(indicator));
    if (!isBlogPath) return false;

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
    } finally {
      clearTimeout(timer);
    }
  }
}

function isBlockedPage(html, statusCode) {
  if (statusCode === 403 || statusCode === 429) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes("cf-challenge-running") ||
    lower.includes("cf-turnstile") ||
    lower.includes("enable javascript and cookies to continue") ||
    lower.includes("ddos-guard") ||
    lower.includes("please enable cookies")
  );
}

function extractLinktoFromSlug(linkto) {
  try {
    const slug = new URL(linkto).pathname.replace(/\//g, " ").replace(/-/g, " ").trim();
    const toolIndicators = [/\b(tool|software|platform|app|saas)\b/i];
    const isToolPage = toolIndicators.some((re) => re.test(slug));
    return { title: slug, snippet: slug, isToolPage, keywords: extractKeywordsLocal(slug).slice(0, 10) };
  } catch { return { title: "", snippet: "", isToolPage: false, keywords: [] }; }
}

function extractArticleContent(html, url) {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    return reader.parse();
  } catch {
    return null;
  }
}

async function analyzeLinktoPage(linkto) {
  try {
    const { html, status } = await fetchWithRetry(linkto, 1, 10000);
    if (isBlockedPage(html, status)) return extractLinktoFromSlug(linkto);
    const article = extractArticleContent(html, linkto);
    if (!article) return extractLinktoFromSlug(linkto);

    const snippet = article.textContent.slice(0, 1500).replace(/\s+/g, " ").trim();
    const title = article.title || "";

    const toolIndicators = [
      /\b(free trial|start free|get started|sign up|pricing|plans?|features?)\b/i,
      /\b(dashboard|login|register|download|install|api key)\b/i,
      /\b(software|platform|saas|tool|app)\b/i,
    ];
    const isToolPage = toolIndicators.some((re) => re.test(snippet) || re.test(title));

    return { title, snippet, isToolPage, keywords: extractKeywordsLocal(title + " " + snippet).slice(0, 15) };
  } catch (err) {
    return extractLinktoFromSlug(linkto);
  }
}

module.exports = {
  validateInputs,
  isArticleUrl,
  extractKeywordsLocal,
  DEFAULT_HEADERS,
  fetchWithRetry,
  isBlockedPage,
  analyzeLinktoPage,
  extractArticleContent
};
