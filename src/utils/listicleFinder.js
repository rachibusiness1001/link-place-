"use strict";

/**
 * Listicle Finder Utility Module
 * Handles SSRF protection, URL normalization, robots.txt parsing,
 * sitemap/RSS/HTML crawling, regex first-pass filtering, and DeepSeek AI verification.
 */

const dns = require("dns");
const net = require("net");
const { JSDOM } = require("jsdom");
const NodeCache = require("node-cache");

// Cache AI classification results per URL for 24 hours so repeated scans never re-call DeepSeek
const urlAiCache = new NodeCache({ stdTTL: 86400, checkperiod: 1800, maxKeys: 5000 });
// Cache full domain scan results for 1 hour
const domainScanCache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 500 });

const TARGET_LISTICLE_COUNT = 10;
const MAX_URLS_TO_SCAN = 500;
const MAX_AI_CALLS_PER_SCAN = 25;
const MAX_NESTED_SITEMAPS = 15;
const BATCH_DELAY_MS = 180;

const BOT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; LinkPlaceListicleBot/1.0)";

const DEFAULT_HEADERS = {
  "User-Agent": BOT_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8",
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "msclkid",
  "twclid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "ref",
  "source",
  "share",
  "hsCtaTracking",
]);

// ─── 1. SSRF Protection & URL Validation ───────────────────────────────────────

/**
 * Checks whether an IPv4 or IPv6 address belongs to a private, loopback,
 * link-local, or reserved range to prevent Server-Side Request Forgery (SSRF).
 */
function isPrivateOrReservedIp(ip) {
  if (!ip) return true;
  const cleanIp = ip.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    cleanIp === "localhost" ||
    cleanIp === "127.0.0.1" ||
    cleanIp === "0.0.0.0" ||
    cleanIp === "::1" ||
    cleanIp === "::"
  ) {
    return true;
  }

  // IPv6 mapped IPv4 (e.g. ::ffff:127.0.0.1)
  if (cleanIp.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(cleanIp.slice(7));
  }

  // IPv6 private / link-local ranges (fc00::/7, fe80::/10)
  if (cleanIp.includes(":")) {
    if (
      cleanIp.startsWith("fc") ||
      cleanIp.startsWith("fd") ||
      cleanIp.startsWith("fe8") ||
      cleanIp.startsWith("fe9") ||
      cleanIp.startsWith("fea") ||
      cleanIp.startsWith("feb")
    ) {
      return true;
    }
    return false;
  }

  // IPv4 numeric checks
  const parts = cleanIp.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // Multicast & reserved

  return false;
}

/**
 * Validates and normalizes the user-provided website URL, blocking internal/private hosts and IPs.
 */
async function validateAndNormalizeWebsiteUrl(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    return { valid: false, error: "Please enter a website URL." };
  }

  let trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: "Please enter a website URL." };
  }
  if (trimmed.length > 300) {
    return { valid: false, error: "Website URL is too long (max 300 characters)." };
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "https://" + trimmed;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format. Example: https://example.com" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http:// and https:// URLs are supported." };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, internal TLDs, and single-word hosts
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".arpa") ||
    !hostname.includes(".")
  ) {
    return {
      valid: false,
      error: "Internal, local, or private network URLs are not allowed.",
    };
  }

  // If the hostname is an IP literal, validate it directly
  if (net.isIP(hostname.replace(/^\[|\]$/g, ""))) {
    if (isPrivateOrReservedIp(hostname)) {
      return {
        valid: false,
        error: "Private or internal IP addresses are blocked for security (SSRF protection).",
      };
    }
  } else {
    // Resolve DNS to verify the domain does not point to a private/loopback IP
    try {
      const records = await dns.promises.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        return { valid: false, error: `Could not resolve domain "${hostname}". Please check the spelling.` };
      }
      for (const rec of records) {
        if (isPrivateOrReservedIp(rec.address)) {
          return {
            valid: false,
            error: "This domain resolves to a private/internal IP address and is blocked for security.",
          };
        }
      }
    } catch {
      return {
        valid: false,
        error: `Could not reach domain "${hostname}". Please verify the website URL is active.`,
      };
    }
  }

  const baseUrl = `${parsed.protocol}//${hostname}`;
  return {
    valid: true,
    baseUrl,
    hostname,
    rootDomain: hostname.replace(/^www\./i, ""),
    normalizedUrl: baseUrl,
  };
}

/**
 * Normalizes a candidate article URL, strips tracking parameters and fragments,
 * removes trailing slash, and verifies it belongs to the target website.
 */
function normalizeArticleUrl(rawUrl, baseUrl, rootDomain) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const cleaned = rawUrl
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .trim();
  if (!cleaned || cleaned.startsWith("mailto:") || cleaned.startsWith("tel:") || cleaned.startsWith("javascript:")) {
    return null;
  }

  try {
    const parsed = new URL(cleaned, baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const urlRootDomain = parsed.hostname.toLowerCase().replace(/^www\./i, "");
    if (urlRootDomain !== rootDomain) return null;

    parsed.hash = "";

    // Strip tracking parameters
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }

    // Normalize pathname (remove trailing slash except root)
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

// ─── 2. Polite HTTP Fetching & Robots.txt ──────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBotBlocked(html, status) {
  if (status === 403 || status === 429 || status === 503) {
    const lower = (html || "").toLowerCase();
    if (
      lower.includes("cf-challenge") ||
      lower.includes("cf-turnstile") ||
      lower.includes("cloudflare") ||
      lower.includes("ddos-guard") ||
      lower.includes("access denied") ||
      lower.includes("attention required") ||
      lower.includes("enable javascript and cookies") ||
      status === 429
    ) {
      return true;
    }
  }
  return false;
}

async function fetchUrlSafe(url, timeoutMs = 9000, maxAttempts = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timer);

      // SSRF check on final redirected URL
      if (res.url) {
        try {
          const finalHost = new URL(res.url).hostname;
          if (net.isIP(finalHost) && isPrivateOrReservedIp(finalHost)) {
            return { ok: false, status: 403, text: "", error: "Redirected to private IP" };
          }
        } catch {}
      }

      const text = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        text,
        finalUrl: res.url || url,
        blocked: isBotBlocked(text, res.status),
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < maxAttempts) {
        await sleep(250 * attempt);
      }
    }
  }
  return {
    ok: false,
    status: 0,
    text: "",
    blocked: false,
    error: lastError ? lastError.message : "Request timed out",
  };
}

/**
 * Fetches and parses /robots.txt to extract Sitemap URLs and Disallow rules.
 */
async function fetchRobotsTxt(baseUrl) {
  const sitemaps = [];
  const disallowRules = [];

  const res = await fetchUrlSafe(`${baseUrl}/robots.txt`, 6000, 1);
  if (res.ok && res.text && !res.text.trim().startsWith("<")) {
    const lines = res.text.split(/\r?\n/);
    let appliesToUs = false;

    for (const rawLine of lines) {
      const line = rawLine.split("#")[0].trim();
      if (!line) continue;

      const sitemapMatch = line.match(/^Sitemap:\s*(.+)$/i);
      if (sitemapMatch && sitemapMatch[1]) {
        const smUrl = sitemapMatch[1].trim();
        if (smUrl.startsWith("http")) sitemaps.push(smUrl);
        continue;
      }

      const uaMatch = line.match(/^User-agent:\s*(.+)$/i);
      if (uaMatch) {
        const agent = uaMatch[1].trim().toLowerCase();
        appliesToUs = agent === "*" || agent.includes("linkplace");
        continue;
      }

      if (appliesToUs) {
        const disallowMatch = line.match(/^Disallow:\s*(.*)$/i);
        if (disallowMatch && disallowMatch[1]) {
          const rule = disallowMatch[1].trim();
          if (rule && rule !== "/") {
            disallowRules.push(rule);
          } else if (rule === "/") {
            disallowRules.push("/");
          }
        }
      }
    }
  }

  function isAllowed(urlStr) {
    try {
      const pathname = new URL(urlStr).pathname;
      for (const rule of disallowRules) {
        if (rule === "/") return false;
        const cleanRule = rule.replace(/\*.*$/, "");
        if (cleanRule && pathname.startsWith(cleanRule)) return false;
      }
      return true;
    } catch {
      return true;
    }
  }

  return { sitemaps: [...new Set(sitemaps)], disallowRules, isAllowed };
}

// ─── 3. Step 1: Fetch URLs (Sitemap -> Sitemap Index -> Robots -> RSS -> Crawl) ──

function shouldSkipChildSitemap(sitemapUrl) {
  const lower = sitemapUrl.toLowerCase();
  return (
    lower.includes("category-sitemap") ||
    lower.includes("tag-sitemap") ||
    lower.includes("post_tag-sitemap") ||
    lower.includes("author-sitemap") ||
    lower.includes("attachment-sitemap") ||
    lower.includes("product-sitemap") ||
    lower.includes("product_cat") ||
    lower.includes("video-sitemap") ||
    lower.includes("image-sitemap") ||
    lower.endsWith(".gz")
  );
}

function scoreChildSitemapPriority(sitemapUrl) {
  const lower = sitemapUrl.toLowerCase();
  if (lower.includes("post-sitemap") || lower.includes("blog-sitemap") || lower.includes("article-sitemap")) return 10;
  if (lower.includes("post") || lower.includes("blog") || lower.includes("article") || lower.includes("news")) return 7;
  if (lower.includes("page-sitemap")) return 2;
  return 5;
}

/**
 * Parses an XML string (sitemap or sitemap index) into child sitemap URLs and page URLs.
 */
function parseSitemapXml(xmlText, baseUrl, rootDomain) {
  const childSitemaps = [];
  const pageItems = [];

  if (!xmlText || typeof xmlText !== "string") return { childSitemaps, pageItems };

  // Extract <sitemap><loc>...</loc></sitemap> blocks
  const sitemapBlocks = xmlText.match(/<sitemap[\s>][\s\S]*?<\/sitemap>/gi) || [];
  for (const block of sitemapBlocks) {
    const locMatch = block.match(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/i);
    if (locMatch && locMatch[1]) {
      const loc = locMatch[1].replace(/&amp;/g, "&").trim();
      if (loc.startsWith("http") && !shouldSkipChildSitemap(loc)) {
        childSitemaps.push(loc);
      }
    }
  }

  // Extract <url><loc>...</loc></url> blocks
  const urlBlocks = xmlText.match(/<url[\s>][\s\S]*?<\/url>/gi) || [];
  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/i);
    if (!locMatch || !locMatch[1]) continue;
    const rawLoc = locMatch[1].trim();
    const normUrl = normalizeArticleUrl(rawLoc, baseUrl, rootDomain);
    if (!normUrl) continue;

    if (/\.xml$/i.test(new URL(normUrl).pathname)) {
      if (!shouldSkipChildSitemap(normUrl)) childSitemaps.push(normUrl);
    } else {
      pageItems.push({ url: normUrl, titleHint: "" });
    }
  }

  // Fallback if XML uses non-standard <loc> tags without <url> or <sitemap> wrappers
  if (childSitemaps.length === 0 && pageItems.length === 0) {
    const rawLocs = xmlText.match(/<loc>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*<\/loc>/gi) || [];
    for (const tag of rawLocs) {
      const rawLoc = tag.replace(/<\/?loc>/gi, "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      const normUrl = normalizeArticleUrl(rawLoc, baseUrl, rootDomain);
      if (!normUrl) continue;
      if (/\.xml$/i.test(new URL(normUrl).pathname)) {
        if (!shouldSkipChildSitemap(normUrl)) childSitemaps.push(normUrl);
      } else {
        pageItems.push({ url: normUrl, titleHint: "" });
      }
    }
  }

  return { childSitemaps, pageItems };
}

/**
 * Parses an RSS or Atom feed into article items with both URL and titleHint.
 */
function parseRssOrAtomFeed(feedXml, baseUrl, rootDomain) {
  const items = [];
  if (!feedXml || typeof feedXml !== "string") return items;

  // RSS <item> blocks
  const rssItems = feedXml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems) {
    const titleMatch = block.match(/<title[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/title>/i);
    const linkMatch =
      block.match(/<link[^>]*>\s*(?:<!\[CDATA\[)?(https?:\/\/[^\s<]+?)(?:\]\]>)?\s*<\/link>/i) ||
      block.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>\s*(https?:\/\/[^\s<]+?)\s*<\/guid>/i);

    if (linkMatch && linkMatch[1]) {
      const norm = normalizeArticleUrl(linkMatch[1], baseUrl, rootDomain);
      if (norm) {
        const titleHint = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        items.push({ url: norm, titleHint });
      }
    }
  }

  // Atom <entry> blocks
  const atomEntries = feedXml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const block of atomEntries) {
    const titleMatch = block.match(/<title[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/title>/i);
    const hrefMatch =
      block.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) ||
      block.match(/<link[^>]+href=["']([^"']+)["']/i);

    if (hrefMatch && hrefMatch[1]) {
      const norm = normalizeArticleUrl(hrefMatch[1], baseUrl, rootDomain);
      if (norm) {
        const titleHint = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        items.push({ url: norm, titleHint });
      }
    }
  }

  return items;
}

/**
 * Extracts article links and pagination links from an HTML page.
 */
function extractLinksFromHtmlPage(html, pageUrl, baseUrl, rootDomain) {
  const items = [];
  const paginationUrls = [];
  if (!html) return { items, paginationUrls };

  try {
    const dom = new JSDOM(html, { url: pageUrl });
    const doc = dom.window.document;
    const anchors = doc.querySelectorAll("a[href]");

    anchors.forEach((a) => {
      const rawHref = a.getAttribute("href");
      const norm = normalizeArticleUrl(rawHref, baseUrl, rootDomain);
      if (!norm) return;

      const text = (a.textContent || "").replace(/\s+/g, " ").trim();
      const headingEl = a.querySelector("h1, h2, h3, h4") || a.closest("h1, h2, h3, h4");
      const headingText = headingEl ? (headingEl.textContent || "").replace(/\s+/g, " ").trim() : "";
      const titleHint = headingText || (text.length >= 12 && text.length <= 180 ? text : "");

      // Check if this is a pagination link (e.g. /blog/page/2 or ?page=2)
      if (/\/page\/\d+\/?$/i.test(norm) || /[?&]page=\d+/i.test(norm)) {
        paginationUrls.push(norm);
      } else {
        items.push({ url: norm, titleHint });
      }
    });
  } catch {}

  return { items, paginationUrls };
}

/**
 * Step 1: Discovers URLs from Sitemap -> Sitemap Index -> Robots.txt -> RSS Feed -> HTML Crawl.
 */
async function discoverWebsiteUrls(baseUrl, rootDomain, robotsInfo) {
  const discoveredMap = new Map(); // url -> { url, titleHint }
  let sourceUsed = "sitemap";
  let wasBlocked = false;

  const addDiscovered = (item) => {
    if (!item || !item.url) return;
    if (robotsInfo && !robotsInfo.isAllowed(item.url)) return;
    const existing = discoveredMap.get(item.url);
    if (!existing || (!existing.titleHint && item.titleHint)) {
      discoveredMap.set(item.url, {
        url: item.url,
        titleHint: item.titleHint || (existing ? existing.titleHint : ""),
      });
    }
  };

  // 1A. Sitemap candidates: /sitemap.xml first, then /sitemap_index.xml & robots.txt sitemaps
  const initialSitemaps = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/post-sitemap.xml`,
    `${baseUrl}/blog-sitemap.xml`,
    ...(robotsInfo?.sitemaps || []),
  ];
  const visitedSitemaps = new Set();
  const sitemapQueue = [...new Set(initialSitemaps)];

  while (
    sitemapQueue.length > 0 &&
    visitedSitemaps.size < MAX_NESTED_SITEMAPS &&
    discoveredMap.size < MAX_URLS_TO_SCAN * 3
  ) {
    const currentSitemap = sitemapQueue.shift();
    if (!currentSitemap || visitedSitemaps.has(currentSitemap)) continue;
    visitedSitemaps.add(currentSitemap);

    const res = await fetchUrlSafe(currentSitemap, 8000, 1);
    if (res.blocked) wasBlocked = true;
    if (!res.ok || !res.text) continue;

    // Verify it looks like XML or contains <loc>
    if (!res.text.includes("<loc>") && !res.text.includes("<sitemap") && !res.text.includes("<urlset")) {
      continue;
    }

    const { childSitemaps, pageItems } = parseSitemapXml(res.text, baseUrl, rootDomain);
    for (const item of pageItems) {
      addDiscovered(item);
    }

    if (childSitemaps.length > 0) {
      // Sort child sitemaps so post/blog sitemaps are fetched first
      childSitemaps.sort((a, b) => scoreChildSitemapPriority(b) - scoreChildSitemapPriority(a));
      for (const child of childSitemaps) {
        if (!visitedSitemaps.has(child)) {
          sitemapQueue.push(child);
        }
      }
    }

    // If /sitemap.xml already gave us plenty of URLs and no child sitemaps remain from it, no need to probe fallback root sitemaps
    if (discoveredMap.size >= 150 && sitemapQueue.every((u) => initialSitemaps.includes(u))) {
      break;
    }

    await sleep(100);
  }

  // 1B. Fallback to RSS / Atom feeds if sitemap yielded no article URLs
  if (discoveredMap.size === 0) {
    sourceUsed = "rss";
    const feedPaths = ["/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/blog/feed", "/blog/rss.xml"];
    for (const feedPath of feedPaths) {
      const feedUrl = `${baseUrl}${feedPath}`;
      const res = await fetchUrlSafe(feedUrl, 7000, 1);
      if (res.blocked) wasBlocked = true;
      if (!res.ok || !res.text) continue;

      if (res.text.includes("<rss") || res.text.includes("<feed") || res.text.includes("<item")) {
        const feedItems = parseRssOrAtomFeed(res.text, baseUrl, rootDomain);
        for (const item of feedItems) addDiscovered(item);
        if (discoveredMap.size > 0) break;
      }
    }
  }

  // 1C. Fallback to crawling /blog, /articles, /resources, homepage, and pagination
  if (discoveredMap.size < 15) {
    if (discoveredMap.size === 0) sourceUsed = "crawl";
    const sectionSeeds = [
      `${baseUrl}/blog`,
      `${baseUrl}/articles`,
      `${baseUrl}/resources`,
      `${baseUrl}/guides`,
      `${baseUrl}`,
    ];
    const visitedPages = new Set();
    const paginationQueue = [];

    for (const seedUrl of sectionSeeds) {
      if (visitedPages.has(seedUrl) || discoveredMap.size >= MAX_URLS_TO_SCAN) continue;
      visitedPages.add(seedUrl);

      const res = await fetchUrlSafe(seedUrl, 8000, 1);
      if (res.blocked) wasBlocked = true;
      if (!res.ok || !res.text) continue;

      const { items, paginationUrls } = extractLinksFromHtmlPage(res.text, seedUrl, baseUrl, rootDomain);
      for (const item of items) addDiscovered(item);
      for (const pUrl of paginationUrls) {
        if (!visitedPages.has(pUrl) && paginationQueue.length < 6) {
          paginationQueue.push(pUrl);
        }
      }
      await sleep(120);
    }

    // Crawl up to 4 pagination pages if needed
    let paginatedCount = 0;
    while (paginationQueue.length > 0 && paginatedCount < 4 && discoveredMap.size < MAX_URLS_TO_SCAN) {
      const pageUrl = paginationQueue.shift();
      if (!pageUrl || visitedPages.has(pageUrl)) continue;
      visitedPages.add(pageUrl);
      paginatedCount++;

      const res = await fetchUrlSafe(pageUrl, 7000, 1);
      if (res.ok && res.text) {
        const { items } = extractLinksFromHtmlPage(res.text, pageUrl, baseUrl, rootDomain);
        for (const item of items) addDiscovered(item);
      }
      await sleep(150);
    }
  }

  return {
    items: [...discoveredMap.values()],
    source: sourceUsed,
    blocked: wasBlocked && discoveredMap.size === 0,
  };
}

// ─── 4. Step 2: First Filter (Free Regex on URL Slug & Title) ─────────────────

const NON_ARTICLE_PREFIXES = [
  "/tag/",
  "/tags/",
  "/category/",
  "/categories/",
  "/author/",
  "/authors/",
  "/page/",
  "/search/",
  "/topics/",
  "/topic/",
  "/cart",
  "/checkout",
  "/login",
  "/signin",
  "/signup",
  "/register",
  "/account",
  "/my-account",
  "/contact",
  "/about",
  "/privacy",
  "/terms",
  "/cookie",
  "/legal",
  "/disclaimer",
  "/pricing",
  "/plans",
  "/demo",
  "/book-demo",
  "/free-trial",
  "/wp-admin",
  "/wp-login",
  "/wp-content",
  "/wp-includes",
  "/cdn-cgi",
  "/feed",
  "/rss",
  "/sitemap",
  "/careers",
  "/jobs",
  "/press",
  "/podcasts",
  "/webinars",
  "/events",
  "/customers",
  "/case-studies",
  "/glossary",
  "/dictionary",
  "/integrations",
  "/changelog",
  "/status",
  "/support",
  "/help",
  "/faq",
  "/shop/",
  "/store/",
  "/product/",
  "/products/",
];

const NON_ARTICLE_EXACT_SEGMENTS = new Set([
  "blog",
  "blogs",
  "articles",
  "article",
  "resources",
  "resource",
  "news",
  "guides",
  "guide",
  "learn",
  "insights",
  "stories",
  "tutorials",
  "tips",
  "tools",
  "alternatives",
  "about",
  "about-us",
  "contact",
  "contact-us",
  "pricing",
  "login",
  "signup",
  "register",
  "cart",
  "checkout",
  "privacy",
  "privacy-policy",
  "terms",
  "terms-of-service",
  "terms-and-conditions",
  "cookie-policy",
  "sitemap",
  "feed",
  "rss",
  "search",
  "home",
  "index",
  "faq",
  "support",
  "features",
  "solutions",
  "services",
  "products",
  "company",
  "team",
  "careers",
  "press",
  "partners",
  "affiliates",
  "testimonials",
  "reviews",
]);

/**
 * Determines whether a URL is an obvious non-article (homepage, category, tag, author, utility page, or asset).
 */
function isObviousNonArticleUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "") return true; // Homepage

    const lowerPath = (pathname + "/").toLowerCase();

    // Asset extensions
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|rar|css|js|xml|json|txt|mp3|mp4|avi|mov|woff|woff2|ttf|eot)$/i.test(pathname)) {
      return true;
    }

    // Match non-article prefixes
    for (const prefix of NON_ARTICLE_PREFIXES) {
      if (lowerPath.startsWith(prefix) || lowerPath.includes(prefix)) {
        // Exception: "/alternatives/" or "/tools/" might be a valid subfolder if there's a descriptive article slug after it
        if (prefix === "/alternatives/" || prefix === "/tools/") continue;
        return true;
      }
    }

    // Pagination paths
    if (/\/page\/\d+$/i.test(pathname) || /[?&](page|paged)=\d+/i.test(parsed.search)) {
      return true;
    }

    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return true;

    // Single-segment index or utility pages (e.g. /blog, /about-us, /contact)
    if (segments.length === 1 && NON_ARTICLE_EXACT_SEGMENTS.has(segments[0].toLowerCase())) {
      return true;
    }

    // Two-segment archive/index pages like /blog/marketing or /resources/guides where last segment is a single generic word
    const lastSlug = segments[segments.length - 1].toLowerCase().replace(/\.(html?|php|aspx?)$/i, "");
    if (NON_ARTICLE_EXACT_SEGMENTS.has(lastSlug)) {
      return true;
    }

    // Pure numeric slug (e.g. /2024 or /12345)
    if (/^\d+$/.test(lastSlug)) {
      return true;
    }

    // Very short single-word slug without hyphens (e.g. /enterprise, /security)
    if (!lastSlug.includes("-") && lastSlug.length < 12) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Determines the human-readable Listicle Type from a slug or title.
 */
function inferListicleType(text) {
  const lower = (text || "").toLowerCase();
  if (/\b(alternatives?|replacements?|competitors?)\b/.test(lower)) return "Alternatives";
  if (/\b(best)\b/.test(lower)) return "Best of";
  if (/\b(top)\b/.test(lower)) return "Top N";
  if (/\b(ways?|methods?|steps?|strategies|approaches|how-to)\b/.test(lower)) return "Ways";
  if (/\b(reasons?|why)\b/.test(lower)) return "Reasons";
  if (/\b(tips?|tricks?|hacks?|advice)\b/.test(lower)) return "Tips";
  if (/\b(tools?|software|apps?|platforms?|plugins?)\b/.test(lower)) return "Tools";
  if (/\b(examples?|samples?|templates?|case-studies|inspirations?)\b/.test(lower)) return "Examples";
  if (/\b(ideas?)\b/.test(lower)) return "Ideas";
  if (/\b(vs|versus|comparison)\b/.test(lower)) return "Comparison / Vs";
  if (/^\d+\b/.test(lower.trim())) return "Numbered List";
  return "Best of";
}

/**
 * Normalizes any AI-returned listicle type into a clean badge label.
 */
function normalizeListicleType(rawType, fallbackTitleOrSlug = "") {
  if (!rawType || typeof rawType !== "string") {
    return inferListicleType(fallbackTitleOrSlug);
  }
  const lower = rawType.toLowerCase().trim();
  if (lower.includes("best")) return "Best of";
  if (lower.includes("top")) return "Top N";
  if (lower.includes("way") || lower.includes("step") || lower.includes("method")) return "Ways";
  if (lower.includes("alternative") || lower.includes("competitor")) return "Alternatives";
  if (lower.includes("reason")) return "Reasons";
  if (lower.includes("tip") || lower.includes("hack")) return "Tips";
  if (lower.includes("tool") || lower.includes("software") || lower.includes("app")) return "Tools";
  if (lower.includes("example") || lower.includes("template")) return "Examples";
  if (lower.includes("idea")) return "Ideas";
  if (lower.includes("vs") || lower.includes("compar")) return "Comparison / Vs";
  if (lower.includes("number") || lower.includes("list") || lower.includes("roundup")) {
    return inferListicleType(fallbackTitleOrSlug);
  }
  return inferListicleType(rawType + " " + fallbackTitleOrSlug);
}

/**
 * Converts a URL slug into a readable fallback title if the page title cannot be fetched.
 */
function formatTitleFromSlug(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = (segments[segments.length - 1] || "")
      .replace(/\.(html?|php|aspx?)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (!last) return urlStr;
    return last.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return urlStr;
  }
}

/**
 * Step 2: FIRST FILTER (free, no AI).
 * Uses regex on the URL slug and optional titleHint to classify URLs into:
 * - "clear": High-confidence listicle from URL/title pattern alone
 * - "doubtful": Matches listicle keywords (best, top, ways, reasons, tips, ideas, tools, alternatives, examples, vs)
 *               but needs DeepSeek AI / page inspection to confirm it is truly a listicle
 * - "reserve": Valid article URL without listicle keywords in slug (kept only if <10 found from clear+doubtful)
 * - "reject": Non-article URL
 */
function firstFilterRegex(urlStr, titleHint = "") {
  if (isObviousNonArticleUrl(urlStr)) {
    return { status: "reject" };
  }

  let slug = "";
  try {
    const pathname = new URL(urlStr).pathname.replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);
    slug = (segments[segments.length - 1] || "").toLowerCase().replace(/\.(html?|php|aspx?)$/i, "");
  } catch {
    return { status: "reject" };
  }

  const slugWords = slug.replace(/[-_]+/g, " ").trim();
  const combinedText = `${slugWords} ${(titleHint || "").toLowerCase()}`.trim();

  // Check if slug starts with a number that isn't a standalone year (e.g. 2020-2030 unless followed by list words)
  const startsWithNumMatch = slug.match(/^(\d+)-(.+)$/);
  let startsWithValidListNumber = false;
  if (startsWithNumMatch) {
    const num = parseInt(startsWithNumMatch[1], 10);
    const rest = startsWithNumMatch[2];
    const isYear = num >= 1990 && num <= 2035;
    if (
      (num >= 2 && num <= 500 && !isYear) ||
      (isYear && /^(best|top|ways|reasons|tips|ideas|tools|alternatives|examples)\b/i.test(rest))
    ) {
      startsWithValidListNumber = true;
    }
  }

  // Check if titleHint starts with a valid listicle number (e.g. "10 Best...", "7 Ways...")
  const titleStartsWithNumber = /^\s*\d{1,3}\s+(best|top|ways|reasons|tips|ideas|tools|alternatives|examples|steps|things|strategies|mistakes|signs|habits|apps|software|platforms|books|courses|templates|plugins)\b/i.test(
    titleHint || ""
  );

  // Strong listicle regex (number + listicle keyword, or "top 10", "10 best", etc.)
  const strongSlugPattern =
    /(?:^|-)(\d+-(?:best|top|ways|reasons|tips|ideas|tools|alternatives|examples|steps|strategies|methods|things|signs|mistakes|questions|habits|books|apps|platforms|software|plugins|templates|tactics|hacks)|(?:top|best)-\d+)(?:-|$)/i;

  const strongTitlePattern =
    /\b(\d{1,3}\s+(?:best|top|ways|reasons|tips|ideas|tools|alternatives|examples|steps|strategies|things|mistakes|signs|apps|software|platforms)|(?:top|best)\s+\d{1,3})\b/i;

  // Keyword patterns from prompt: best-, top-, -ways-to-, -reasons-, -tips-, -ideas-, -tools-, -alternatives-, -examples-, -vs-
  const slugKeywordPattern =
    /(?:^|-)(best|top|ways-to|ways|reasons|tips|ideas|tools|alternatives|alternative-to|examples|vs|versus)(?:-|$)/i;

  const titleKeywordPattern =
    /\b(best|top|ways\s+to|ways|reasons|tips|ideas|tools|alternatives|examples|vs\.?|versus)\b/i;

  if (strongSlugPattern.test(slug) || titleStartsWithNumber || strongTitlePattern.test(titleHint || "")) {
    return {
      status: "clear",
      type: inferListicleType(titleHint || slugWords),
      confidence: "High",
      matchReason: "strong_regex",
    };
  }

  if (startsWithValidListNumber) {
    // Starts with a number like "12-marketing-metrics" or "7-email-subject-lines" -> high likelihood listicle
    return {
      status: "clear",
      type: inferListicleType(titleHint || slugWords),
      confidence: "High",
      matchReason: "starts_with_number",
    };
  }

  if (slugKeywordPattern.test(slug) || titleKeywordPattern.test(titleHint || "")) {
    // Has listicle keyword (e.g. best-crm-software, hubspot-alternatives, seo-tips, ahrefs-vs-semrush)
    // Mark as "doubtful" so Second Filter (DeepSeek AI) checks the actual article content!
    return {
      status: "doubtful",
      type: inferListicleType(titleHint || slugWords),
      confidence: "Medium",
      matchReason: "keyword_regex",
    };
  }

  // Otherwise, if it's a multi-word descriptive slug, keep as reserve candidate in case site uses short evergreen slugs
  const wordCount = slug.split("-").filter(Boolean).length;
  if (wordCount >= 3) {
    return {
      status: "reserve",
      type: "Best of",
      confidence: "Medium",
    };
  }

  return { status: "reject" };
}

// ─── 5. Page Content Extraction & Step 3: Second Filter (DeepSeek API) ─────────

/**
 * Fetches an article page and extracts its Title, H1, subheadings (H2/H3), and first ~500 words.
 */
async function fetchArticlePageDetails(url) {
  const res = await fetchUrlSafe(url, 8500, 1);
  if (!res.ok || !res.text) {
    return { ok: false, status: res.status, blocked: res.blocked };
  }

  try {
    const dom = new JSDOM(res.text, { url });
    const doc = dom.window.document;

    // Remove scripts, styles, nav, footer, noscript
    doc.querySelectorAll("script, style, noscript, svg, nav, footer, header, aside, form").forEach((el) => el.remove());

    const rawTitle = (doc.querySelector("title")?.textContent || "").replace(/\s+/g, " ").trim();
    const h1 = (doc.querySelector("h1")?.textContent || "").replace(/\s+/g, " ").trim();
    const ogTitle = (doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "")
      .replace(/\s+/g, " ")
      .trim();

    // Choose cleanest display title
    let cleanTitle = h1 || ogTitle || rawTitle;
    if (!h1 && cleanTitle.includes(" | ")) {
      cleanTitle = cleanTitle.split(" | ")[0].trim();
    } else if (!h1 && cleanTitle.includes(" - ")) {
      const parts = cleanTitle.split(" - ");
      if (parts[0].length >= 15) cleanTitle = parts[0].trim();
    }

    // Collect H2 and H3 headings to help detect list structure
    const headings = [];
    doc.querySelectorAll("h2, h3").forEach((h) => {
      const t = (h.textContent || "").replace(/\s+/g, " ").trim();
      if (t && t.length >= 3 && t.length <= 160 && headings.length < 25) {
        headings.push(t);
      }
    });

    // Extract first ~500 words from main/article or body paragraphs
    const container = doc.querySelector("article, main, [role='main'], .post-content, .entry-content") || doc.body;
    const rawBodyText = (container ? container.textContent : "").replace(/\s+/g, " ").trim();
    const words = rawBodyText.split(/\s+/).slice(0, 500);
    const first500Words = words.join(" ");

    return {
      ok: true,
      title: cleanTitle || formatTitleFromSlug(url),
      rawTitle,
      h1,
      headings,
      first500Words,
    };
  } catch {
    return { ok: false, status: res.status, blocked: false };
  }
}

/**
 * Heuristic fallback analyzer when DeepSeek API is unavailable, errors out, or key is missing.
 * Inspects the page's actual Title, H1, H2/H3 list headings, and first 500 words.
 */
function fallbackEvaluatePageAsListicle(url, pageData, regexInfo) {
  const titleText = `${pageData?.h1 || ""} ${pageData?.title || ""}`.trim();
  const headings = pageData?.headings || [];

  // Count numbered headings like "1. ...", "#1 ...", "Step 1:"
  const numberedHeadingCount = headings.filter((h) =>
    /^(?:\d+[\.\)\-:]|#\d+|\d+\s+[-–—]|step\s+\d+|tip\s+\d+|tool\s+\d+)/i.test(h.trim())
  ).length;

  // Check if title or H1 strongly matches listicle format
  const strongTitleMatch =
    /\b(\d{1,3}\s+(?:best|top|ways|reasons|tips|ideas|tools|alternatives|examples|steps|strategies|things|mistakes|signs|apps|software|platforms|plugins|templates|books|courses)|(?:top|best)\s+\d{1,3})\b/i.test(
      titleText
    ) || /^\s*\d{1,3}\s+[a-z]/i.test(titleText);

  const keywordInTitle =
    /\b(best|top|ways\s+to|ways|reasons|tips|ideas|tools|alternatives|examples|vs\.?|versus)\b/i.test(titleText);

  if (strongTitleMatch || numberedHeadingCount >= 3) {
    return {
      is_listicle: true,
      type: normalizeListicleType(regexInfo?.type, titleText || url),
      confidence: strongTitleMatch && numberedHeadingCount >= 2 ? "High" : "High",
    };
  }

  if (keywordInTitle && (headings.length >= 4 || regexInfo?.status === "doubtful")) {
    return {
      is_listicle: true,
      type: normalizeListicleType(regexInfo?.type, titleText || url),
      confidence: "Medium",
    };
  }

  if (regexInfo?.status === "clear") {
    return {
      is_listicle: true,
      type: normalizeListicleType(regexInfo?.type, titleText || url),
      confidence: "High",
    };
  }

  return {
    is_listicle: false,
    type: normalizeListicleType(regexInfo?.type, titleText || url),
    confidence: "Low",
  };
}

/**
 * Step 3: SECOND FILTER (DeepSeek API).
 * Sends Title + H1 + first ~500 words to DeepSeek chat completions endpoint with low temperature
 * and JSON output enforcement. Includes retries, timeout, URL-level caching, and safe regex fallback.
 */
async function classifyWithDeepSeek(url, pageData, regexInfo) {
  const cached = urlAiCache.get(url);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const apiKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  const hasValidKey =
    apiKey.length > 10 &&
    !apiKey.includes("your_deepseek_api_key") &&
    !apiKey.includes("YOUR_DEEPSEEK");

  if (!hasValidKey) {
    const fallback = fallbackEvaluatePageAsListicle(url, pageData, regexInfo);
    urlAiCache.set(url, fallback);
    return { ...fallback, usedAi: false };
  }

  const apiUrl = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";
  const headingsPreview = (pageData.headings || []).slice(0, 12).join(" | ");
  const contentSnippet = [
    `URL: ${url}`,
    `Page Title: ${pageData.title || ""}`,
    `H1: ${pageData.h1 || ""}`,
    headingsPreview ? `Subheadings (H2/H3): ${headingsPreview}` : "",
    `First ~500 words: ${(pageData.first500Words || "").slice(0, 2800)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.1,
          max_tokens: 120,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Is this a listicle article? Reply ONLY in JSON: {"is_listicle": true/false, "type": "...", "confidence": "high/medium/low"}',
            },
            {
              role: "user",
              content: `${contentSnippet}\n\nIs this a listicle article? Reply ONLY in JSON: {"is_listicle": true/false, "type": "...", "confidence": "high/medium/low"}`,
            },
          ],
        }),
      });
      clearTimeout(timer);

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(600 * attempt);
          continue;
        }
        throw new Error(`DeepSeek API HTTP ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`DeepSeek API HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content || "";
      const cleanJson = rawContent.replace(/^```json\s*|```\s*$/gi, "").trim();
      const firstBrace = cleanJson.indexOf("{");
      const lastBrace = cleanJson.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error("Invalid JSON from DeepSeek");
      }

      const parsed = JSON.parse(cleanJson.slice(firstBrace, lastBrace + 1));
      const rawConf = String(parsed.confidence || "medium").toLowerCase();
      const formattedConfidence =
        rawConf === "high" ? "High" : rawConf === "low" ? "Low" : "Medium";

      const result = {
        is_listicle: Boolean(parsed.is_listicle),
        type: normalizeListicleType(parsed.type, `${pageData.h1 || ""} ${pageData.title || ""} ${url}`),
        confidence: formattedConfidence,
        usedAi: true,
      };

      urlAiCache.set(url, result);
      return result;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === maxRetries) {
        // Safe fallback to regex/structure analysis if DeepSeek fails
        const fallback = fallbackEvaluatePageAsListicle(url, pageData, regexInfo);
        return { ...fallback, usedAi: false, fallbackReason: err.message };
      }
      await sleep(400 * attempt);
    }
  }
}

// ─── 6. Main Orchestrator: Steps 1 -> 5 ────────────────────────────────────────

/**
 * Main entry point to find listicle articles on a given website URL.
 */
async function findListiclesForWebsite(rawWebsiteUrl, options = {}) {
  // Validate & check SSRF
  const validation = await validateAndNormalizeWebsiteUrl(rawWebsiteUrl);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const { baseUrl, rootDomain } = validation;

  // Check scan cache unless bypassCache is requested
  if (!options.bypassCache) {
    const cachedScan = domainScanCache.get(baseUrl);
    if (cachedScan) {
      return { ...cachedScan, cached: true };
    }
  }

  // Respect robots.txt
  const robotsInfo = await fetchRobotsTxt(baseUrl);

  // Step 1: Discover URLs (Sitemap -> Sitemap Index -> Robots.txt -> RSS -> Crawl)
  const discovery = await discoverWebsiteUrls(baseUrl, rootDomain, robotsInfo);

  if (discovery.blocked) {
    const err = new Error(
      `The website (${rootDomain}) is blocking automated requests (Cloudflare / bot protection). Try another website.`
    );
    err.statusCode = 422;
    throw err;
  }

  // Cap total URLs to scan at MAX_URLS_TO_SCAN (500)
  const candidateItems = discovery.items.slice(0, MAX_URLS_TO_SCAN);
  if (candidateItems.length === 0) {
    return {
      website: baseUrl,
      source: discovery.source,
      totalUrlsScanned: 0,
      totalFound: 0,
      fewerThanTen: true,
      notice: `No accessible article URLs were found on ${baseUrl}. The site may require JavaScript rendering or block crawlers.`,
      listicles: [],
    };
  }

  // Step 2: First Filter (Free Regex)
  const clearCandidates = [];
  const doubtfulCandidates = [];
  const reserveCandidates = [];

  for (const item of candidateItems) {
    const filterRes = firstFilterRegex(item.url, item.titleHint);
    if (filterRes.status === "clear") {
      clearCandidates.push({ ...item, filterRes });
    } else if (filterRes.status === "doubtful") {
      doubtfulCandidates.push({ ...item, filterRes });
    } else if (filterRes.status === "reserve") {
      reserveCandidates.push({ ...item, filterRes });
    }
  }

  const confirmedListicles = [];
  const seenUrls = new Set();
  let aiCallsMade = 0;
  let urlsInspectedCount = candidateItems.length;

  const addConfirmed = (entry) => {
    if (!entry || !entry.url || seenUrls.has(entry.url)) return;
    if (entry.confidence === "Low") return; // Only return High / Medium confidence
    seenUrls.add(entry.url);
    confirmedListicles.push({
      title: entry.title || formatTitleFromSlug(entry.url),
      url: entry.url,
      type: entry.type || inferListicleType(entry.title || entry.url),
      confidence: entry.confidence === "High" ? "High" : "Medium",
    });
  };

  // Process Tier 1: Clear regex matches (fetch titles in polite batches; no AI call needed)
  const clearBatchSize = 5;
  for (let i = 0; i < clearCandidates.length; i += clearBatchSize) {
    if (confirmedListicles.length >= TARGET_LISTICLE_COUNT) break;

    const batch = clearCandidates.slice(i, i + clearBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (cand) => {
        if (cand.titleHint && cand.titleHint.length >= 15) {
          return {
            title: cand.titleHint,
            url: cand.url,
            type: cand.filterRes.type,
            confidence: "High",
          };
        }
        const pageData = await fetchArticlePageDetails(cand.url);
        if (pageData.status === 404 || pageData.status === 410) return null;
        return {
          title: pageData.ok && pageData.title ? pageData.title : formatTitleFromSlug(cand.url),
          url: cand.url,
          type: normalizeListicleType(cand.filterRes.type, pageData.title || cand.url),
          confidence: "High",
        };
      })
    );

    for (const r of batchResults) {
      if (r) addConfirmed(r);
    }

    if (i + clearBatchSize < clearCandidates.length && confirmedListicles.length < TARGET_LISTICLE_COUNT) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Step 3 & 4: Process Doubtful URLs with DeepSeek API until >= 10 confirmed listicles or exhausted
  const doubtfulBatchSize = 4;
  for (let i = 0; i < doubtfulCandidates.length; i += doubtfulBatchSize) {
    if (confirmedListicles.length >= TARGET_LISTICLE_COUNT) break;
    if (aiCallsMade >= MAX_AI_CALLS_PER_SCAN) break;

    const batch = doubtfulCandidates.slice(i, i + doubtfulBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (cand) => {
        const pageData = await fetchArticlePageDetails(cand.url);
        if (pageData.status === 404 || pageData.status === 410) return null;

        // If fetching the page failed (e.g. timeout), fall back to titleHint / slug evaluation
        if (!pageData.ok) {
          return null;
        }

        // First check if the fetched page H1/Title is an unmistakable numbered listicle
        const h1AndTitle = `${pageData.h1 || ""} ${pageData.title || ""}`;
        const secondCheck = firstFilterRegex(cand.url, h1AndTitle);
        if (secondCheck.status === "clear") {
          return {
            title: pageData.title,
            url: cand.url,
            type: secondCheck.type,
            confidence: "High",
          };
        }

        // Otherwise send to DeepSeek API (Second Filter)
        aiCallsMade++;
        const aiVerdict = await classifyWithDeepSeek(cand.url, pageData, cand.filterRes);
        if (aiVerdict && aiVerdict.is_listicle && aiVerdict.confidence !== "Low") {
          return {
            title: pageData.title,
            url: cand.url,
            type: aiVerdict.type,
            confidence: aiVerdict.confidence,
          };
        }
        return null;
      })
    );

    for (const r of batchResults) {
      if (r) addConfirmed(r);
    }

    if (i + doubtfulBatchSize < doubtfulCandidates.length && confirmedListicles.length < TARGET_LISTICLE_COUNT) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // If still fewer than 10 confirmed listicles, check up to 20 reserve article URLs
  // (Handles sites that use short evergreen URL slugs like /blog/crm-software for "12 Best CRM Software")
  const reserveToInspect = reserveCandidates.slice(0, 20);
  for (let i = 0; i < reserveToInspect.length; i += doubtfulBatchSize) {
    if (confirmedListicles.length >= TARGET_LISTICLE_COUNT) break;
    if (aiCallsMade >= MAX_AI_CALLS_PER_SCAN) break;

    const batch = reserveToInspect.slice(i, i + doubtfulBatchSize);
    const batchResults = await Promise.all(
      batch.map(async (cand) => {
        const pageData = await fetchArticlePageDetails(cand.url);
        if (!pageData.ok) return null;

        const h1AndTitle = `${pageData.h1 || ""} ${pageData.title || ""}`;
        const titleCheck = firstFilterRegex(cand.url, h1AndTitle);

        if (titleCheck.status === "clear") {
          return {
            title: pageData.title,
            url: cand.url,
            type: titleCheck.type,
            confidence: "High",
          };
        }

        if (titleCheck.status === "doubtful" && aiCallsMade < MAX_AI_CALLS_PER_SCAN) {
          aiCallsMade++;
          const aiVerdict = await classifyWithDeepSeek(cand.url, pageData, titleCheck);
          if (aiVerdict && aiVerdict.is_listicle && aiVerdict.confidence !== "Low") {
            return {
              title: pageData.title,
              url: cand.url,
              type: aiVerdict.type,
              confidence: aiVerdict.confidence,
            };
          }
        }
        return null;
      })
    );

    for (const r of batchResults) {
      if (r) addConfirmed(r);
    }

    if (i + doubtfulBatchSize < reserveToInspect.length && confirmedListicles.length < TARGET_LISTICLE_COUNT) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  const totalFound = confirmedListicles.length;
  const fewerThanTen = totalFound < TARGET_LISTICLE_COUNT;
  let notice = null;

  if (totalFound === 0) {
    notice = `We scanned ${urlsInspectedCount} URLs on ${baseUrl} and did not find any listicle-style articles.`;
  } else if (fewerThanTen) {
    notice = `Only ${totalFound} listicle article${totalFound === 1 ? "" : "s"} found on ${baseUrl} after scanning all ${urlsInspectedCount} available URLs. Returning all listicles the site has.`;
  }

  const responsePayload = {
    website: baseUrl,
    source: discovery.source,
    totalUrlsScanned: urlsInspectedCount,
    totalFound,
    fewerThanTen,
    notice,
    aiCallsMade,
    listicles: confirmedListicles,
  };

  domainScanCache.set(baseUrl, responsePayload);
  return responsePayload;
}

module.exports = {
  validateAndNormalizeWebsiteUrl,
  normalizeArticleUrl,
  isPrivateOrReservedIp,
  fetchRobotsTxt,
  discoverWebsiteUrls,
  firstFilterRegex,
  isObviousNonArticleUrl,
  inferListicleType,
  normalizeListicleType,
  fetchArticlePageDetails,
  classifyWithDeepSeek,
  findListiclesForWebsite,
};
