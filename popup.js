// =============================================
//  NexzLabs Batch Voice Generator - popup.js v2
// =============================================

const $ = id => document.getElementById(id);

let totalLines = 0;

// ---- Restore saved state ----
chrome.storage.local.get(['prefix','startNum','narrations','delay'], data => {
  if (data.prefix)     $('prefix').value      = data.prefix;
  if (data.startNum)   $('startNum').value    = data.startNum;
  if (data.narrations) $('narrations').value  = data.narrations;
  if (data.delay)      $('delay').value       = data.delay;
  updatePreview(); updateLineCount(); updateDelay();
});

function updatePreview() {
  const p = $('prefix').value.trim() || 'Voice';
  const n = parseInt($('startNum').value) || 1;
  $('previewName').textContent  = `${p}_${n}.mp3`;
  $('previewName2').textContent = `${p}_${n+1}.mp3`;
}

function getLines() {
  return $('narrations').value
    .split('\n')
    .map(l => l.replace(/^["']|["']$/g, '').trim())
    .filter(l => l.length > 0);
}

function updateLineCount() {
  const lines = getLines();
  totalLines = lines.length;
  $('lineCount').textContent = totalLines;
  buildStepDots(totalLines);
  updateETA();
}

function updateDelay() { $('delayVal').textContent = $('delay').value; updateETA(); }

function updateETA() {
  const d = parseInt($('delay').value) || 8;
  const n = totalLines;
  if (n === 0) { $('etaInfo').textContent = ''; return; }
  const secs = n * (d + 5);
  const mins = Math.ceil(secs / 60);
  $('etaInfo').textContent = `~${mins} min total`;
}

// ---- Step dots ----
function buildStepDots(count) {
  const container = $('stepDots');
  container.innerHTML = '';
  const show = Math.min(count, 40); // max 40 dots
  for (let i = 0; i < show; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dot.id = `dot-${i}`;
    container.appendChild(dot);
  }
}

function updateDot(index, state) { // state: 'done' | 'active' | ''
  const dot = $(`dot-${index}`);
  if (!dot) return;
  dot.className = 'step-dot' + (state ? ' ' + state : '');
}

// ---- Progress ----
function setProgress(done, total) {
  if (total === 0) return;
  const pct = Math.round((done / total) * 100);
  $('barFill').style.width   = pct + '%';
  $('progressPct').textContent = pct + '%';
  $('progressFraction').textContent = `${done} / ${total} completed`;
}

function resetProgress() {
  $('barFill').style.width    = '0%';
  $('progressPct').textContent = '0%';
  $('progressFraction').textContent = '0 / 0 completed';
  // Reset all dots
  document.querySelectorAll('.step-dot').forEach(d => d.className = 'step-dot');
}

// ---- Log ----
function log(msg, type = 'inf') {
  $('statusBox').innerHTML = `<span class="${type}">${msg}</span>`;
}

// ---- Save ----
function saveState() {
  chrome.storage.local.set({
    prefix:     $('prefix').value,
    startNum:   $('startNum').value,
    narrations: $('narrations').value,
    delay:      $('delay').value
  });
}

$('prefix').addEventListener('input',     () => { updatePreview();   saveState(); });
$('startNum').addEventListener('input',   () => { updatePreview();   saveState(); });
$('narrations').addEventListener('input', () => { updateLineCount(); saveState(); });
$('delay').addEventListener('input',      () => { updateDelay();     saveState(); });

// ---- START ----
$('btnStart').addEventListener('click', async () => {
  const lines = getLines();
  if (!lines.length) { log('⚠ No narrations found!', 'wrn'); return; }

  const prefix   = $('prefix').value.trim() || 'Voice';
  const startNum = parseInt($('startNum').value) || 1;
  const delay    = parseInt($('delay').value) || 8;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('nexzlabs.com')) {
    log('❌ Open NexzLabs TTS Studio tab first!', 'err');
    return;
  }

  $('btnStart').disabled = true;
  $('btnStop').disabled  = false;
  resetProgress();
  buildStepDots(lines.length);
  log('🔌 Connecting to page...', 'inf');

  // Inject content script fresh
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch(e) { /* already loaded */ }

  await new Promise(r => setTimeout(r, 500));

  chrome.tabs.sendMessage(tab.id, { action: 'START_BATCH', lines, prefix, startNum, delay }, response => {
    if (chrome.runtime.lastError) {
      log('❌ Connection failed. Refresh NexzLabs and try again.', 'err');
      $('btnStart').disabled = false;
      $('btnStop').disabled  = true;
    }
  });
});

// ---- STOP ----
$('btnStop').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { action: 'STOP_BATCH' }, () => {});
  $('btnStart').disabled = false;
  $('btnStop').disabled  = true;
  log('⏹ Stopped by user.', 'wrn');
});

// ---- Messages from content script ----
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS')   log(msg.text, msg.level || 'inf');

  if (msg.type === 'PROGRESS') {
    setProgress(msg.done, msg.total);
    // Update dots
    for (let i = 0; i < msg.done; i++)      updateDot(i, 'done');
    if (msg.done < msg.total)               updateDot(msg.done, 'active');
  }

  if (msg.type === 'DONE') {
    $('btnStart').disabled = false;
    $('btnStop').disabled  = true;
    setProgress(msg.total, msg.total);
    // All dots green
    for (let i = 0; i < msg.total; i++) updateDot(i, 'done');
    log(`✅ All ${msg.total} files downloaded successfully!`, 'ok');
  }

  if (msg.type === 'ERROR') {
    log(`❌ ${msg.text}`, 'err');
    $('btnStart').disabled = false;
    $('btnStop').disabled  = true;
  }
});
