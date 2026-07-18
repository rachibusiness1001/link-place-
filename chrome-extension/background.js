// Background service worker for LinkPlace Find Anchor extension
// Handles context menu and tab queries

chrome.runtime.onInstalled.addListener(() => {
  console.log("LinkPlace Find Anchor extension installed.");
});
