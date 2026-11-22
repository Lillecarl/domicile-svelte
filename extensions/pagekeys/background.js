// Chromium injects content scripts only into pages that load after the
// extension does. On an install or a reload, inject pagekeys into the pages
// already open; pagekeys.js retires the copy a page holds.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  // A page no extension may script (the Web Store, chrome:// pages) refuses,
  // and keeps no pagekeys, as it never had one.
  await Promise.allSettled(
    tabs.map((tab) =>
      chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["pagekeys.js"] }),
    ),
  );
});
