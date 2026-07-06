require('dotenv').config();
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

async function run() {
  const q = encodeURIComponent('site:jeecart.com "403 web scraping"');
  const fetch = (await import('node-fetch')).default;
  const url = 'https://serpapi.com/search?q=' + q + '&api_key=' + process.env.SERPAPI_KEY;
  const r = await fetch(url);
  const d = await r.json();
  const urls = (d.organic_results || []).map(res => res.link);
  console.log("Found URLs:", urls);

  for (const u of urls) {
    const htmlR = await fetch(u);
    const html = await htmlR.text();
    const dom = new JSDOM(html, { url: u });
    const reader = new Readability(dom.window.document, { keepClasses: false, nbTopCandidates: 5, charThreshold: 300 });
    const article = reader.parse();
    if (!article) {
      console.log(`Failed to parse ${u}`);
      continue;
    }
    const dom2 = new JSDOM(article.content);
    const pEls = dom2.window.document.querySelectorAll("p, li, blockquote");
    console.log(`URL ${u}: ${pEls.length} tags found`);
    let passed = 0;
    pEls.forEach(el => {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      const linkCount = el.querySelectorAll("a").length;
      if (text.length >= 120 && linkCount === 0) passed++;
    });
    console.log(`URL ${u}: ${passed} passed initial (length >= 120, links === 0)`);
  }
}
run();
