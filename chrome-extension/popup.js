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

let currentData = null;
let isSearching = false;
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

async function doSearch(isLoadMore = false) {
  if (isSearching) return;
  
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
  if (!isLoadMore) {
    resultsDiv.style.display = "none";
    currentData = null;
  }
  errorDiv.innerHTML = "";

  // Show loading state
  isSearching = true;
  searchBtn.disabled = true;
  searchBtn.innerHTML = `<div class="spinner"></div> ${isLoadMore ? 'Finding more...' : 'Scanning articles...'}`;
  statusText.textContent = isLoadMore ? "Checking more pages..." : "Fetching sitemap and checking articles...";

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
    const offset = (isLoadMore && currentData) ? currentData.nextOffset : 0;
    
    const res = await fetch(`${BACKEND_URL}/api/find-anchor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl, anchorText, urlOffset: offset, limit: 20 })
    });

    clearInterval(ticker);
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Something went wrong. Please try again.");
      return;
    }

    if (isLoadMore && currentData) {
      currentData.articles = [...currentData.articles, ...data.articles];
      currentData.totalFound += data.totalFound;
      currentData.scannedThisRound = (currentData.scannedThisRound || 0) + data.scannedThisRound;
      currentData.hasMore = data.hasMore;
      currentData.nextOffset = data.nextOffset;
    } else {
      currentData = data;
    }

    renderResults(currentData, anchorText);
  } catch (err) {
    clearInterval(ticker);
    showError("Failed to connect to server. Make sure you're online and try again.");
  } finally {
    isSearching = false;
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
    <div class="results-header" style="justify-content: space-between;">
      <span class="count">✓ ${data.totalFound} article${data.totalFound > 1 ? 's' : ''} found</span>
      <button id="exportCsvBtn" class="btn-small" style="flex:0; padding:4px 8px;">Export CSV</button>
    </div>
    <div id="articleList">${articleCards}</div>
    ${data.hasMore ? `<button id="loadMoreBtn" style="margin-top: 10px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1);">Find 20 More</button>` : ''}
  `;

  const exportCsvBtn = document.getElementById("exportCsvBtn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => handleExportCSV(data));
  }
  
  const loadMoreBtn = document.getElementById("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => doSearch(true));
  }
}

function handleExportCSV(data) {
  if (!data || !data.articles || data.articles.length === 0) return;
  
  const headers = ['Domain', 'Article URL', 'Anchor Text', 'Context'];
  const rows = data.articles.map(res => [
    data.websiteUrl,
    res.url,
    data.anchorText,
    `"${res.context.replace(/"/g, '""')}"`
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `find_anchor_${data.websiteUrl}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
