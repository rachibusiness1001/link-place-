const url = require('url');
const SKIP_PREFIXES = [
  '/pricing', '/about', '/contact', '/login', '/signup', '/register',
  '/cart', '/checkout', '/account', '/terms', '/privacy', '/faq',
  '/support', '/demo', '/features', '/product', '/plans', '/free-trial',
  '/alternatives', '/404', '/cdn-cgi', '/wp-admin', '/wp-login',
  '/sitemap', '/feed', '/rss', '/amp/'
];
const INDEX_SEGMENTS = new Set([
  'blog', 'blogs', 'category', 'categories', 'tag', 'tags', 'author', 'authors',
  'news', 'resources', 'topics', 'archive', 'page', 'feed', 'rss', 'sitemap',
  'search', 'wp-content', 'wp-includes'
]);
const BLOG_PATH_INDICATORS = [
  '/blog/', '/blogs/', '/post/', '/posts/', '/article/', '/articles/',
  '/news/', '/insights/', '/resources/', '/learn/', '/guide/', '/guides/',
  '/journal/', '/editorial/', '/content/', '/stories/', '/story/',
  '/tips/', '/advice/', '/howto/', '/how-to/', '/tutorial/', '/tutorials/'
];
function isArticleUrl(urlStr) {
  try {
    const parsed = new url.URL(urlStr);
    const urlPath = parsed.pathname.replace(/\/$/, '');
    if (!urlPath || urlPath === '/') return { res: false, reason: 'root' };
    if (SKIP_PREFIXES.some((p) => urlPath.toLowerCase().startsWith(p))) return { res: false, reason: 'skip_prefix' };
    const segments = urlPath.split('/').filter(Boolean);
    if (segments.length === 1 && INDEX_SEGMENTS.has(segments[0].toLowerCase())) return { res: false, reason: 'index_segment_only' };
    if (/\/page\/\d+/.test(urlPath) || /\/\d+$/.test(urlPath)) return { res: false, reason: 'pagination' };
    const meaningful = segments.filter((s) => !INDEX_SEGMENTS.has(s.toLowerCase()));
    if (meaningful.length === 0) return { res: false, reason: 'no_meaningful_segments' };
    if (/^\d{4}$/.test(segments[segments.length - 1])) return { res: false, reason: 'year_slug' };
    
    const lowerPath = urlPath.toLowerCase();
    const isBlogPath = BLOG_PATH_INDICATORS.some((indicator) => lowerPath.includes(indicator));
    if (!isBlogPath) return { res: false, reason: 'not_blog_path_indicator' };

    const blogSegIdx = segments.findIndex((s) =>
      ['blog', 'blogs', 'article', 'articles', 'post', 'posts', 'news', 'insights',
       'resources', 'learn', 'guide', 'guides', 'tips', 'tutorial', 'tutorials'].includes(s.toLowerCase())
    );
    if (blogSegIdx !== -1) {
      const afterBlog = segments.slice(blogSegIdx + 1).filter(Boolean);
      if (afterBlog.length === 0) return { res: false, reason: 'index_page_after_blog' };
      const slug = afterBlog[afterBlog.length - 1];
      if (/\*/.test(slug)) return { res: false, reason: 'wildcard_slug' };
      if (/^\d+$/.test(slug)) return { res: false, reason: 'numeric_slug' };
      if (slug.length < 5) return { res: false, reason: 'short_slug' };
    } else {
      const slug = segments[segments.length - 1];
      if (/\*/.test(slug) || /^\d+$/.test(slug) || slug.length < 5) return { res: false, reason: 'bad_slug_no_blog_segment' };
    }
    return { res: true, reason: 'valid' };
  } catch (e) { return { res: false, reason: e.message }; }
}

async function run() {
  const query = 'site:honadi.com ai';
  const apiKey = 'fc0c4b786db90abfffc67cde863d0c242c755cfb61406857ad51bb2b9cd0f592'; // I'll use a dummy key or I can just fetch the production API again with the new detailed error logs
  console.log('Use production API to see error');
}
run();
