// =============================================
//  NexzLabs Batch Voice Generator - content.js
//  v2.0 — Fixed filename + live progress
// =============================================

let isRunning     = false;
let stopRequested = false;

function notify(type, data) {
  try { chrome.runtime.sendMessage({ type, ...data }); } catch(e) {}
}
function status(text, level = 'inf') { notify('STATUS', { text, level }); }
const wait = ms => new Promise(r => setTimeout(r, ms));

// ============================================
//  SELECTORS
// ============================================

function findTextarea() {
  const all = [...document.querySelectorAll('textarea')];
  return (
    all.find(t => t.placeholder && t.placeholder.includes('convert to speech')) ||
    all.find(t => t.className && t.className.includes('text-editor')) ||
    all.find(t => t.offsetParent !== null) || null
  );
}

function findGenerateButton() {
  return [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim() === 'Generate Speech') || null;
}

// Download icon buttons in Recent Generations panel
// They have aria-haspopup="dialog" and contain the download SVG path
function getDownloadIconButtons() {
  return [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
    .filter(b => {
      const html = b.innerHTML;
      return html.includes('M21 15v4') || html.includes('7 10 12 15') || html.includes('lucide-download');
    });
}

// "Download Now" inside the open modal
function findDownloadNowBtn() {
  // Check dialogs first
  for (const dialog of document.querySelectorAll('[role="dialog"]')) {
    const btn = [...dialog.querySelectorAll('button')]
      .find(b => b.textContent.trim() === 'Download Now');
    if (btn) return btn;
  }
  // Fallback anywhere
  return [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim() === 'Download Now') || null;
}

function findCancelBtn() {
  for (const dialog of document.querySelectorAll('[role="dialog"]')) {
    const btn = [...dialog.querySelectorAll('button')]
      .find(b => b.textContent.trim() === 'Cancel');
    if (btn) return btn;
  }
  return null;
}

// ---- Set React textarea value ----
function setReactValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input',  { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ---- Wait for new download icon to appear (new generation entry) ----
async function waitForNewGeneration(prevCount, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (stopRequested) return false;
    if (getDownloadIconButtons().length > prevCount) return true;
    await wait(700);
  }
  return false;
}

// ---- Wait for modal Download Now button ----
async function waitForDownloadNow(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (stopRequested) return null;
    const btn = findDownloadNowBtn();
    if (btn) return btn;
    await wait(300);
  }
  return null;
}

// ============================================
//  MAIN BATCH
// ============================================
async function runBatch({ lines, prefix, startNum, delay }) {
  isRunning     = true;
  stopRequested = false;
  const total   = lines.length;

  status(`🚀 Starting batch: ${total} narrations`, 'inf');
  notify('PROGRESS', { done: 0, total });
  await wait(400);

  for (let i = 0; i < lines.length; i++) {
    if (stopRequested) { status('⏹ Stopped.', 'wrn'); break; }

    const lineText = lines[i];
    const fileNum  = startNum + i;
    const filename = `${prefix}_${fileNum}.mp3`;

    notify('PROGRESS', { done: i, total });

    // STEP 1: Textarea
    const textarea = findTextarea();
    if (!textarea) {
      notify('ERROR', { text: 'Textarea not found — go to TTS Studio page.' });
      break;
    }

    // STEP 2: Paste text
    status(`📝 [${i+1}/${total}] Pasting text...`, 'inf');
    textarea.focus();
    await wait(200);
    setReactValue(textarea, '');
    await wait(100);
    setReactValue(textarea, lineText);
    await wait(400);

    // STEP 3: Count existing download buttons before generating
    const prevCount = getDownloadIconButtons().length;

    // STEP 4: Generate
    const genBtn = findGenerateButton();
    if (!genBtn) {
      notify('ERROR', { text: '"Generate Speech" button not found.' });
      break;
    }
    genBtn.click();
    status(`⚙️ [${i+1}/${total}] Generating ${filename}...`, 'inf');

    // STEP 5: Countdown
    for (let sec = delay; sec > 0; sec--) {
      if (stopRequested) break;
      status(`⏳ [${i+1}/${total}] Generating... ${sec}s remaining`, 'inf');
      await wait(1000);
    }
    if (stopRequested) break;

    // STEP 6: Wait for new entry in panel
    status(`🔍 [${i+1}/${total}] Waiting for audio...`, 'inf');
    const appeared = await waitForNewGeneration(prevCount, 25000);
    if (!appeared) {
      status(`⚠ [${i+1}/${total}] Audio not ready — skipping`, 'wrn');
      notify('PROGRESS', { done: i + 1, total });
      continue;
    }
    await wait(500);

    // STEP 7: Click the download icon (FIRST = most recent)
    status(`📂 [${i+1}/${total}] Opening download dialog...`, 'inf');
    const dlIcons = getDownloadIconButtons();
    if (!dlIcons.length) {
      status(`⚠ [${i+1}/${total}] Download icon not found`, 'wrn');
      notify('PROGRESS', { done: i + 1, total });
      continue;
    }
    dlIcons[0].click(); // click most recent entry
    await wait(700);

    // STEP 8: Wait for modal
    const dlNowBtn = await waitForDownloadNow(7000);
    if (!dlNowBtn) {
      status(`⚠ [${i+1}/${total}] Download modal didn't open`, 'wrn');
      notify('PROGRESS', { done: i + 1, total });
      continue;
    }

    // STEP 9: *** SET FILENAME JUST BEFORE CLICKING ***
    // This is the critical timing fix — set it right before the click
    status(`⬇️ [${i+1}/${total}] Downloading as ${filename}...`, 'inf');
    await chrome.storage.local.set({ pendingFilename: filename });
    await wait(100); // tiny pause to ensure storage is written

    dlNowBtn.click();
    await wait(2500); // let download start

    // STEP 10: Close modal
    const cancelBtn = findCancelBtn();
    if (cancelBtn) { cancelBtn.click(); await wait(400); }

    notify('PROGRESS', { done: i + 1, total });
    status(`✅ [${i+1}/${total}] Downloaded: ${filename}`, 'ok');
    await wait(800);
  }

  if (!stopRequested) {
    notify('DONE', { total });
    status(`🎉 All ${total} files downloaded!`, 'ok');
  }
  isRunning = false;
}

// ============================================
//  Message Listener
// ============================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'START_BATCH') {
    if (isRunning) { status('⚠ Already running!', 'wrn'); sendResponse({ ok: false }); return true; }
    runBatch(msg);
    sendResponse({ ok: true });
  }
  if (msg.action === 'STOP_BATCH') {
    stopRequested = true; isRunning = false;
    sendResponse({ ok: true });
  }
  return true;
});

console.log('[NexzBatch v2] ✅ Loaded');
