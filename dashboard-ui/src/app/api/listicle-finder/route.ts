import { NextRequest, NextResponse } from "next/server";
import dns from "dns";
import net from "net";

export const maxDuration = 60;

const TARGET_LISTICLE_COUNT = 10;
const MAX_URLS_TO_SCAN = 500;
const MAX_AI_CALLS_PER_SCAN = 20;
const MAX_NESTED_SITEMAPS = 12;

const BOT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; LinkPlaceListicleBot/1.0)";

const DEFAULT_HEADERS = {
  "User-Agent": BOT_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8",
};

const urlAiCache = new Map<string, { is_listicle: boolean; type: string; confidence: string }>();

function isPrivateOrReservedIP(ip: string): boolean {
  if (!ip) return true;
  const normalized = ip.toLowerCase().trim();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateOrReservedIP(normalized.slice(7));
  }
  if (net.isIPv4(normalized)) {
    const parts = normalized.split(".").map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    if (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80")
    ) {
      return true;
    }
    return false;
  }
  return true;
}

async function validateAndNormalizeBaseUrl(rawInput: string): Promise<{ baseUrl: string; hostname: string }> {
  if (!rawInput || typeof rawInput !== "string") {
    throw new Error("Please enter a valid website URL.");
  }
  let input = rawInput.trim();
  if (!/^https?:\/\//i.test(input)) {
    input = "https://" + input;
  }
  input = input.replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("Invalid URL format. Example: https://example.com");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    !hostname.includes(".")
  ) {
    throw new Error("Internal, local, or private addresses are not allowed.");
  }

  if (net.isIP(hostname) && isPrivateOrReservedIP(hostname)) {
    throw new Error("Private or internal IP addresses are blocked (SSRF protection).");
  }

  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    for (const rec of records) {
      if (isPrivateOrReservedIP(rec.address)) {
        throw new Error("Domain resolves to a private or internal IP address (SSRF protection).");
      }
    }
  } catch (err: any) {
    if (err.message?.includes("SSRF")) throw err;
    throw new Error(`Could not resolve domain "${hostname}". Please verify the website URL.`);
  }

  return { baseUrl: `${parsed.protocol}//${parsed.host}`, hostname };
}

function normalizeArticleUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const u = new URL(rawUrl, baseUrl);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    u.hash = "";
    const toDelete: string[] = [];
    u.searchParams.forEach((_, k) => {
      if (k.toLowerCase().startsWith("utm_") || ["fbclid", "gclid", "ref", "source"].includes(k.toLowerCase())) {
        toDelete.push(k);
      }
    });
    toDelete.forEach((k) => u.searchParams.delete(k));
    let clean = u.toString();
    if (u.pathname !== "/" && clean.endsWith("/")) clean = clean.slice(0, -1);
    return clean;
  } catch {
    return null;
  }
}

async function safeFetchText(url: string, timeoutMs = 9000): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, text: "" };
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

function slugToTitle(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const segments = u.pathname.split("/").filter(Boolean);
    if (!segments.length) return "";
    const last = decodeURIComponent(segments[segments.length - 1]).replace(/\.(html?|php|aspx?)$/i, "");
    return last
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return "";
  }
}

const NON_ARTICLE_PATH_RE =
  /(?:^|\/)(?:tag|tags|category|categories|author|authors|page|pages|cart|checkout|login|signin|signup|register|account|wp-admin|wp-json|wp-content|wp-includes|feed|rss|comments|search|privacy|privacy-policy|terms|terms-of-service|disclaimer|contact|contact-us|about|about-us|careers|jobs|pricing|demo|cdn-cgi|assets|static)(?:\/|$|\?)/i;

const NON_ARTICLE_EXT_RE =
  /\.(?:xml|gz|jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|json|ico|woff2?|ttf|mp4|mp3)(?:\?|$)/i;

function isLikelyArticleUrl(urlStr: string, baseHostname: string): boolean {
  try {
    const u = new URL(urlStr);
    const cleanHost = u.hostname.toLowerCase().replace(/^www\./, "");
    const cleanBase = baseHostname.toLowerCase().replace(/^www\./, "");
    if (cleanHost !== cleanBase) return false;
    if (!u.pathname || u.pathname === "/") return false;
    if (NON_ARTICLE_EXT_RE.test(u.pathname)) return false;
    if (NON_ARTICLE_PATH_RE.test(u.pathname)) return false;
    const segments = u.pathname.split("/").filter(Boolean);
    const lastSeg = segments[segments.length - 1] || "";
    if (segments.length === 1 && ["blog", "articles", "resources", "news", "guides", "post", "posts"].includes(lastSeg.toLowerCase())) {
      return false;
    }
    if (lastSeg.length < 4) return false;
    return true;
  } catch {
    return false;
  }
}

function classifyByRegex(urlStr: string, rawTitle = "") {
  let slug = "";
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split("/").filter(Boolean);
    slug = (parts[parts.length - 1] || "").toLowerCase();
  } catch {
    slug = urlStr.toLowerCase();
  }
  const title = (rawTitle || slugToTitle(urlStr)).trim();

  const typeRules = [
    {
      type: "Alternatives",
      strongSlug: /(?:^|-)(?:\d+-)?(?:best-|top-)?alternatives?(?:-to|-for)?(?:$|-)/i,
      strongTitle: /\b(?:\d+\s+)?(?:best\s+|top\s+)?[\w\s]{0,25}\balternatives?\b/i,
    },
    {
      type: "Ways",
      strongSlug: /(?:^|-)\d+-[a-z0-9-]*ways(?:-to)?(?:$|-)|-ways-to-/i,
      strongTitle: /\b(?:\d+\s+)?[\w\s]{0,15}\bways\s+to\b/i,
    },
    {
      type: "Reasons",
      strongSlug: /(?:^|-)\d+-[a-z0-9-]*reasons(?:$|-)|-reasons-(?:to|why)-/i,
      strongTitle: /\b(?:\d+\s+)?reasons\s+(?:why|to)\b/i,
    },
    {
      type: "Tips",
      strongSlug: /(?:^|-)\d+-[a-z0-9-]*tips(?:$|-)|-tips-(?:for|to|on)-/i,
      strongTitle: /\b\d+\s+[\w\s]{0,20}\btips\b/i,
    },
    {
      type: "Ideas",
      strongSlug: /(?:^|-)\d+-[a-z0-9-]*ideas(?:$|-)|-ideas-(?:for|to)-/i,
      strongTitle: /\b\d+\s+[\w\s]{0,20}\bideas\b/i,
    },
    {
      type: "Examples",
      strongSlug: /(?:^|-)\d+-[a-z0-9-]*examples(?:$|-)|-examples-(?:of|to|for)-/i,
      strongTitle: /\b(?:\d+\s+)?[\w\s]{0,20}\bexamples\s+of\b|\b\d+\s+[\w\s]{0,20}\bexamples\b/i,
    },
    {
      type: "Tools",
      strongSlug: /(?:^|-)(?:\d+-)?(?:best-|top-)[a-z0-9-]*tools(?:$|-)|-tools-(?:for|to)-/i,
      strongTitle: /\b(?:\d+\s+)?(?:best|top)\s+[\w\s]{0,25}\btools\b|\b\d+\s+[\w\s]{0,20}\btools\s+for\b/i,
    },
    {
      type: "Best of",
      strongSlug: /(?:^|-)\d+-best-|^(?:best)-/i,
      strongTitle: /^(?:\d+\s+)?best\s+/i,
    },
    {
      type: "Top N",
      strongSlug: /(?:^|-)top-\d+-|^(?:top)-/i,
      strongTitle: /^top\s+\d+\b|\btop\s+\d+\s+/i,
    },
    {
      type: "Comparison / Vs",
      strongSlug: /-vs-/i,
      strongTitle: /\bvs\.?\b/i,
    },
  ];

  const startsWithNumberSlug = /^\d+-(?:best|top|ways|reasons|tips|ideas|tools|alternatives|examples|steps|strategies|methods|types|books|apps|plugins|platforms|websites|companies|agencies|services|software)\b/i.test(slug);
  const startsWithNumberTitle = /^\d+\s+/i.test(title);

  for (const rule of typeRules) {
    if (rule.strongSlug.test(slug) || rule.strongTitle.test(title)) {
      const isHigh = startsWithNumberSlug || startsWithNumberTitle || /\b(?:best|top|alternatives|ways to|reasons why)\b/i.test(`${slug} ${title}`);
      return {
        status: isHigh ? "confirmed" : "doubtful",
        type: rule.type,
        confidence: isHigh ? "High" : "Medium",
        title: title || slugToTitle(urlStr),
      };
    }
  }

  if (startsWithNumberSlug || startsWithNumberTitle) {
    return {
      status: "confirmed",
      type: "Top N",
      confidence: "High",
      title: title || slugToTitle(urlStr),
    };
  }

  const weakPattern = /(?:^|-)(?:best|top|ways|reasons|tips|ideas|tools|alternatives|examples|vs|list|roundup|checklist|templates|strategies)(?:$|-)/i;
  if (weakPattern.test(slug) || weakPattern.test(title)) {
    let guessedType = "Best of";
    if (/alternative/i.test(slug)) guessedType = "Alternatives";
    else if (/way/i.test(slug)) guessedType = "Ways";
    else if (/reason/i.test(slug)) guessedType = "Reasons";
    else if (/tip/i.test(slug)) guessedType = "Tips";
    else if (/idea/i.test(slug)) guessedType = "Ideas";
    else if (/tool/i.test(slug)) guessedType = "Tools";
    else if (/example/i.test(slug)) guessedType = "Examples";
    else if (/top/i.test(slug)) guessedType = "Top N";

    return {
      status: "doubtful",
      type: guessedType,
      confidence: "Medium",
      title: title || slugToTitle(urlStr),
    };
  }

  return { status: "rejected", type: "", confidence: "Low", title: "" };
}

function parseSitemapXml(xml: string, baseUrl: string) {
  const sitemaps: string[] = [];
  const urls: { url: string; title: string }[] = [];
  if (!xml) return { sitemaps, urls };

  const sitemapMatches = xml.match(/<sitemap[\s>][\s\S]*?<\/sitemap>/gi) || [];
  for (const block of sitemapMatches) {
    const locMatch = block.match(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/i);
    if (locMatch?.[1]) {
      const normalized = normalizeArticleUrl(locMatch[1].trim(), baseUrl);
      if (normalized) sitemaps.push(normalized);
    }
  }

  const urlMatches = xml.match(/<url[\s>][\s\S]*?<\/url>/gi) || [];
  for (const block of urlMatches) {
    const locMatch = block.match(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/i);
    if (locMatch?.[1]) {
      const normalized = normalizeArticleUrl(locMatch[1].trim(), baseUrl);
      if (normalized) urls.push({ url: normalized, title: "" });
    }
  }
  return { sitemaps, urls };
}

async function discoverCandidateUrls(baseUrl: string, hostname: string) {
  const collected = new Map<string, { url: string; title: string }>();
  const addCandidate = (u: string, title = "") => {
    if (collected.size >= MAX_URLS_TO_SCAN * 3) return;
    const norm = normalizeArticleUrl(u, baseUrl);
    if (!norm || !isLikelyArticleUrl(norm, hostname)) return;
    if (!collected.has(norm)) collected.set(norm, { url: norm, title });
  };

  const robotsRes = await safeFetchText(`${baseUrl}/robots.txt`, 6000);
  const robotsSitemaps: string[] = [];
  if (robotsRes.ok && robotsRes.text) {
    for (const line of robotsRes.text.split(/\r?\n/)) {
      const m = line.match(/^sitemap:\s*(.+)$/i);
      if (m?.[1]) robotsSitemaps.push(m[1].trim());
    }
  }

  const sitemapQueue = Array.from(new Set([
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/post-sitemap.xml`,
    ...robotsSitemaps,
  ]));
  const visitedSitemaps = new Set<string>();

  while (sitemapQueue.length > 0 && visitedSitemaps.size < MAX_NESTED_SITEMAPS && collected.size < MAX_URLS_TO_SCAN * 2) {
    const smUrl = sitemapQueue.shift()!;
    if (visitedSitemaps.has(smUrl)) continue;
    visitedSitemaps.add(smUrl);

    const res = await safeFetchText(smUrl, 9000);
    if (!res.ok || !res.text) continue;

    const { sitemaps, urls } = parseSitemapXml(res.text, baseUrl);
    for (const item of urls) addCandidate(item.url, item.title);
    for (const childSm of sitemaps) {
      if (!visitedSitemaps.has(childSm)) sitemapQueue.push(childSm);
    }
  }

  if (collected.size > 0) {
    return { urls: Array.from(collected.values()), source: "sitemap" };
  }

  // Fallback 1: RSS / Atom feeds
  for (const feedPath of ["/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/blog/feed"]) {
    const res = await safeFetchText(`${baseUrl}${feedPath}`, 7500);
    if (!res.ok || !res.text) continue;
    const items = res.text.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) || [];
    for (const block of items) {
      const titleM = block.match(/<title[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/title>/i);
      const linkM = block.match(/<link[^>]+href=["']([^"']+)["']/i) || block.match(/<link>\s*([\s\S]*?)\s*<\/link>/i);
      if (linkM?.[1]) addCandidate(linkM[1].trim(), titleM?.[1]?.trim() || "");
    }
    if (collected.size > 0) return { urls: Array.from(collected.values()), source: "rss_feed" };
  }

  // Fallback 2: Crawl /blog, /articles, /resources, homepage
  for (const path of ["/blog", "/articles", "/resources", "/guides", "/"]) {
    const res = await safeFetchText(`${baseUrl}${path}`, 8000);
    if (!res.ok || !res.text) continue;
    const hrefMatches = Array.from(res.text.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    for (const m of hrefMatches) {
      const rawHref = m[1];
      const anchorText = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      addCandidate(rawHref, anchorText.length > 10 && anchorText.length < 180 ? anchorText : "");
    }
  }

  return { urls: Array.from(collected.values()), source: "html_crawl" };
}

async function fetchPageSummary(url: string) {
  const res = await safeFetchText(url, 7500);
  if (!res.ok || !res.text) return null;
  const titleM = res.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1M = res.text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const cleanTitle = (titleM?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const cleanH1 = (h1M?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const bodyWords = res.text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 500)
    .join(" ");

  return { title: cleanH1 || cleanTitle || slugToTitle(url), h1: cleanH1, first500Words: bodyWords };
}

async function verifyWithDeepSeek(url: string, summary: { title: string; h1: string; first500Words: string }, fallbackType: string) {
  if (urlAiCache.has(url)) return urlAiCache.get(url)!;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { is_listicle: true, type: fallbackType || "Best of", confidence: "Medium" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Is this a listicle article? Reply ONLY in JSON: {"is_listicle": true/false, "type": "...", "confidence": "high/medium/low"}',
          },
          {
            role: "user",
            content: `URL: ${url}\nTitle: ${summary.title}\nH1: ${summary.h1}\nExcerpt: ${summary.first500Words}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const result = {
      is_listicle: Boolean(parsed.is_listicle),
      type: parsed.type || fallbackType || "Best of",
      confidence: String(parsed.confidence || "medium").toLowerCase() === "high" ? "High" : "Medium",
    };
    urlAiCache.set(url, result);
    return result;
  } catch {
    return { is_listicle: true, type: fallbackType || "Best of", confidence: "Medium" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body.websiteUrl || body.url || body.domain || "";
    const { baseUrl, hostname } = await validateAndNormalizeBaseUrl(rawUrl);

    const { urls: discovered, source } = await discoverCandidateUrls(baseUrl, hostname);
    const candidates = discovered.slice(0, MAX_URLS_TO_SCAN);

    const confirmed: { title: string; url: string; type: string; confidence: string }[] = [];
    const doubtful: { url: string; title: string; type: string }[] = [];

    for (const item of candidates) {
      const check = classifyByRegex(item.url, item.title);
      if (check.status === "confirmed") {
        confirmed.push({
          title: check.title || slugToTitle(item.url),
          url: item.url,
          type: check.type,
          confidence: "High",
        });
      } else if (check.status === "doubtful") {
        doubtful.push({ url: item.url, title: check.title, type: check.type });
      }
    }

    let aiCallsMade = 0;
    for (const d of doubtful) {
      if (confirmed.length >= TARGET_LISTICLE_COUNT || aiCallsMade >= MAX_AI_CALLS_PER_SCAN) break;
      const summary = await fetchPageSummary(d.url);
      if (!summary) {
        confirmed.push({
          title: d.title || slugToTitle(d.url),
          url: d.url,
          type: d.type,
          confidence: "Medium",
        });
        continue;
      }
      aiCallsMade++;
      const aiRes = await verifyWithDeepSeek(d.url, summary, d.type);
      if (aiRes.is_listicle) {
        confirmed.push({
          title: summary.title || d.title || slugToTitle(d.url),
          url: d.url,
          type: aiRes.type || d.type,
          confidence: aiRes.confidence,
        });
      }
    }

    const fewerThanTen = confirmed.length < TARGET_LISTICLE_COUNT;
    const notice =
      confirmed.length === 0
        ? `No listicle articles were found after scanning ${candidates.length} URLs on ${hostname}.`
        : fewerThanTen
        ? `Found ${confirmed.length} listicle article(s) on ${hostname} after scanning ${candidates.length} URLs (site has fewer than 10 listicles).`
        : null;

    return NextResponse.json({
      website: baseUrl,
      source,
      totalUrlsScanned: candidates.length,
      totalFound: confirmed.length,
      fewerThanTen,
      notice,
      aiCallsMade,
      listicles: confirmed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to scan website for listicles." },
      { status: 400 }
    );
  }
}
