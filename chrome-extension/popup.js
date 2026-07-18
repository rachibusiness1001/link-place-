// LinkPlace — Find Anchor Extension
// Calls our Render backend /api/find-anchor (zero cost, no external APIs)

const BACKEND_URL = "https://link-place-latest.onrender.com"; // Update this if your backend URL changes

const searchBtn = document.getElementById("searchBtn");
const websiteUrlInput = document.getElementById("websiteUrl");
const anchorTextInput = document.getElementById("anchorText");
const statusText = document.getElementById("statusText");
const errorDiv = document.getElementById("error");
const resultsDiv = document.getElementById("results");
const autoFillBtn = document.getElementById("autoFillBtn");

// Auto-fill current tab domain
autoFillBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      try {
        const url = new URL(tabs[0].url);
        websiteUrlInput.value = url.hostname.replace(/^www\./, "");
      } catch {}
    }
  });
});

// Restore saved inputs
chrome.storage.local.get(["lastWebsite", "lastAnchor"], (data) => {
  if (data.lastWebsite) websiteUrlInput.value = data.lastWebsite;
  if (data.lastAnchor) anchorTextInput.value = data.lastAnchor;
});

// Enter key support
anchorTextInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
websiteUrlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

searchBtn.addEventListener("click", doSearch);

async function doSearch() {
  const websiteUrl = websiteUrlInput.value.trim();
  const anchorText = anchorTextInput.value.trim();

  if (!websiteUrl || !anchorText) {
    showError("Please enter both a website URL and anchor text.");
    return;
  }

  // Save inputs
  chrome.storage.local.set({ lastWebsite: websiteUrl, lastAnchor: anchorText });

  // Reset UI
  errorDiv.style.display = "none";
  resultsDiv.style.display = "none";
  errorDiv.innerHTML = "";

  // Show loading state
  searchBtn.disabled = true;
  searchBtn.innerHTML = `<div class="spinner"></div> Scanning articles...`;
  statusText.textContent = "Fetching sitemap and checking articles...";

  // Ticker for status
  const steps = [
    "Fetching sitemap.xml...",
    "Checking article pages...",
    "Scanning article text...",
    "Almost done..."
  ];
  let stepIdx = 0;
  const ticker = setInterval(() => {
    stepIdx = Math.min(stepIdx + 1, steps.length - 1);
    statusText.textContent = steps[stepIdx];
  }, 8000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/find-anchor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl, anchorText })
    });

    clearInterval(ticker);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Something went wrong. Please try again.");
      return;
    }

    renderResults(data, anchorText);
  } catch (err) {
    clearInterval(ticker);
    showError("Failed to connect to server. Make sure you're online and try again.");
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      Find All Mentions
    `;
    statusText.textContent = "";
  }
}

function renderResults(data, anchorText) {
  resultsDiv.style.display = "block";

  if (data.totalFound === 0) {
    resultsDiv.innerHTML = `
      <div class="results-header">
        <span class="count" style="color:#71717a">No mentions found</span>
        <span class="scanned">${data.totalChecked} pages scanned</span>
      </div>
      <div class="no-results">
        <div style="font-size:24px;margin-bottom:8px">🔍</div>
        <p>No articles on <strong style="color:#a1a1aa">${data.websiteUrl}</strong> mention</p>
        <p>"<strong style="color:#a1a1aa">${data.anchorText}</strong>"</p>
        <p style="margin-top:8px;font-size:10px;color:#3f3f46">Try a different anchor text or website.</p>
      </div>
    `;
    return;
  }

  const articleCards = data.articles.map((article, idx) => {
    const highlightedContext = escapeHtml(article.context).replace(
      new RegExp(`(${escapeRegex(escapeHtml(anchorText))})`, 'gi'),
      '<mark>$1</mark>'
    );

    return `
      <div class="article-card">
        <div class="article-title" title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</div>
        <a class="article-url" href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(article.url)}">${escapeHtml(article.url)}</a>
        <div class="context-snippet">${highlightedContext}</div>
        <div class="actions-row">
          <button class="btn-small" onclick="openUrl('${escapeHtml(article.url)}')">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
            Open Article
          </button>
          <button class="btn-small" onclick="copyUrl('${escapeHtml(article.url)}', this)">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            Copy URL
          </button>
        </div>
      </div>
    `;
  }).join('');

  resultsDiv.innerHTML = `
    <div class="results-header">
      <span class="count">✓ ${data.totalFound} article${data.totalFound > 1 ? 's' : ''} found</span>
      <span class="scanned">${data.totalChecked} pages scanned</span>
    </div>
    <div id="articleList">${articleCards}</div>
  `;
}

function showError(msg) {
  errorDiv.style.display = "flex";
  errorDiv.className = "error-box";
  errorDiv.innerHTML = `
    <span style="font-size:16px;margin-top:-1px">⚠️</span>
    <span>${escapeHtml(msg)}</span>
  `;
}

function openUrl(url) {
  chrome.tabs.create({ url });
}

function copyUrl(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = `<span>✓</span> Copied!`;
    btn.style.color = "#10b981";
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.color = "";
    }, 1500);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
