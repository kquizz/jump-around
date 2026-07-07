/*
 * popup.js (step 2) — now a thin trigger for the service worker.
 *
 * The mental split to hold onto:
 *   - POPUP  = UI. Reads state to display it, fires messages on click.
 *              Fragile: can die at any moment.
 *   - WORKER = does the durable work (write visited, navigate the tab).
 *              Robust: outlives the popup.
 *
 * So this file does two jobs: (1) paint the current state on open, and
 * (2) send a 'jump' message when the button is clicked. It does NOT
 * write visited or navigate — that would reintroduce the popup-death
 * bug from step 1.
 */

import { PAGES } from './pages.js';

/* --- Paint current state on open (this always runs, popup is alive) --- */

// Read everything we want to display in one storage call.
const { visited = {}, clientUuid } = await chrome.storage.local.get([
  'visited',
  'clientUuid',
]);

const seen = Object.keys(visited).length;
document.getElementById('progress').textContent = `seen ${seen} of ${PAGES.length}`;

// clientUuid is minted by the worker's onInstalled handler. On a brand
// new install there's a tiny chance the popup opens before that ran, so
// we show a friendly placeholder rather than "undefined".
document.getElementById('client-uuid').textContent = clientUuid ?? '(minting…)';

// Current tab URL, same as step 1.
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
document.getElementById('current-url').textContent = tab.url ?? '(not visible here)';

/* --- The Jump button: fire a message, let the worker take over --- */

document.getElementById('jump').addEventListener('click', async () => {
  // sendMessage returns a Promise that resolves with whatever the
  // worker passed to sendResponse. Because the worker navigates the
  // active tab, THIS POPUP LIKELY CLOSES before the reply lands — so we
  // can't depend on the code after this await running. That's fine:
  // the worker already did the real work (marked visited + navigated)
  // before replying. Reopen the popup to watch "seen" climb.
  //
  // We wrap in try/catch because "message channel closed before a
  // response was received" is an expected, benign outcome when the
  // popup dies mid-flight — not a real error.
  try {
    const result = await chrome.runtime.sendMessage({ type: 'jump' });
    if (result) {
      document.getElementById('progress').textContent =
        `seen ${result.seen} of ${result.total}`;
    }
  } catch (_ignored) {
    // Popup closed before the reply arrived. Expected. The jump happened.
  }
});

/* --- Reset history: also delegated to the worker --- */

document.getElementById('reset').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'resetVisited' });
  document.getElementById('progress').textContent = `seen 0 of ${PAGES.length}`;
});
