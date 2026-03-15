// =============================================
//  NexzLabs Batch Voice Generator - background.js
// =============================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOWNLOAD') {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, id => {
      sendResponse({ ok: !chrome.runtime.lastError, id });
    });
    return true;
  }
});

// ---- MAIN: Intercept every new download and rename it ----
chrome.downloads.onCreated.addListener(async (item) => {
  // Check if it's an audio file (mp3/wav) or a blob URL
  const looksLikeAudio =
    /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(item.url || '') ||
    /\.(mp3|wav|ogg|m4a|aac)$/i.test(item.filename || '') ||
    (item.mime || '').startsWith('audio/') ||
    (item.url || '').startsWith('blob:');

  if (!looksLikeAudio) return;

  // Get the pending filename we stored from content.js
  const data = await chrome.storage.local.get('pendingFilename');
  if (!data.pendingFilename) return;

  const newFilename = data.pendingFilename;
  await chrome.storage.local.remove('pendingFilename');

  console.log('[NexzBatch] Renaming:', item.filename || item.url, '→', newFilename);

  // Method 1: edit (works for most cases)
  chrome.downloads.edit(item.id, { filename: newFilename }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[NexzBatch] edit failed:', chrome.runtime.lastError.message);
      // Method 2: wait and search for the download, then rename
      retryRename(item.id, newFilename);
    } else {
      console.log('[NexzBatch] ✅ Renamed to:', newFilename);
    }
  });
});

// Also catch downloads that complete — try rename again if needed
chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.filename && !delta.state) return;

  const data = await chrome.storage.local.get('pendingFilename');
  if (!data.pendingFilename) return;

  // If filename just got set (from undefined/empty to a real path)
  if (delta.filename && delta.filename.current) {
    const current = delta.filename.current;
    // Only rename if it still has the nexzlabs default name
    if (current.includes('nexzlabs-') || current.endsWith('.mp3') || current.endsWith('.wav')) {
      const newFilename = data.pendingFilename;
      await chrome.storage.local.remove('pendingFilename');
      chrome.downloads.edit(delta.id, { filename: newFilename }, () => {
        if (!chrome.runtime.lastError) {
          console.log('[NexzBatch] ✅ Renamed via onChanged:', newFilename);
        }
      });
    }
  }
});

function retryRename(downloadId, filename) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    chrome.downloads.search({ id: downloadId }, results => {
      if (!results || !results[0]) return;
      const item = results[0];
      if (item.state === 'in_progress' || item.state === 'complete') {
        chrome.downloads.edit(downloadId, { filename }, () => {
          if (!chrome.runtime.lastError) {
            console.log('[NexzBatch] ✅ Retry rename succeeded:', filename);
            clearInterval(interval);
          }
        });
      }
      if (attempts > 10) clearInterval(interval);
    });
  }, 500);
}

console.log('[NexzBatch] Background worker started ✅');
