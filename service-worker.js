/*
 * service-worker.js — the "background" context. The single most
 * misunderstood part of a Chrome extension, so read this bit slowly.
 *
 * WHAT IT IS: a JavaScript environment with NO window, NO document, NO
 * DOM. It can't show UI. What it CAN do is listen for events and call
 * chrome.* APIs. Think of it as the extension's backstage crew.
 *
 * WHEN IT RUNS: it is NOT always running. Chrome starts it when an event
 * it cares about fires (a message arrives, an alarm goes off, the
 * extension is installed), lets it work, and then TERMINATES it after
 * ~30 seconds of idle to save memory. It will be started and killed
 * many times a day. (Older "background page" tutorials assume it runs
 * forever — that was MV2. It doesn't anymore.)
 *
 * THE CONSEQUENCE: you cannot keep state in a module-level variable and
 * expect it to survive. `let jumpCount = 0` up here would silently reset
 * to 0 every time the worker restarts. Durable state lives in
 * chrome.storage — the same store the popup reads and writes. That
 * shared store is how these two separate little programs stay in sync.
 *
 * TO DEBUG IT: chrome://extensions → the JumpAround card → click the
 * "service worker" link. That opens DevTools scoped to the worker, with
 * its own console. If the link says "(inactive)", the worker has been
 * put to sleep — clicking it wakes it up.
 */

import { PAGES } from './pages.js';

/* ------------------------------------------------------------------ *
 * Lifecycle: onInstalled — the "run exactly once" hook
 * ------------------------------------------------------------------ *
 *
 * onInstalled fires when the extension is first installed, updated to a
 * new version, or when Chrome itself updates. It's the canonical place
 * for one-time setup. We use it to mint the client's permanent identity:
 * a random UUID that, in step 3, we'll send to the server with every
 * submission so it can rate-limit and ban by client rather than by IP.
 *
 * We guard with an existence check so a version bump (which also fires
 * onInstalled) doesn't overwrite an identity we already have.
 *
 * crypto.randomUUID() is a standard web API available here in the
 * worker — no library needed.
 */
chrome.runtime.onInstalled.addListener(async () => {
  const { clientUuid } = await chrome.storage.local.get('clientUuid');
  if (!clientUuid) {
    const fresh = crypto.randomUUID();
    await chrome.storage.local.set({ clientUuid: fresh });
    console.log('[JumpAround] minted client UUID:', fresh);
  }
});

/* ------------------------------------------------------------------ *
 * Messaging: the router — how the popup talks to the worker
 * ------------------------------------------------------------------ *
 *
 * The popup and the worker are separate JavaScript worlds; they can't
 * call each other's functions or share variables. They communicate by
 * passing JSON messages. The popup calls chrome.runtime.sendMessage(msg)
 * and this listener receives it.
 *
 * THE ONE GOTCHA THAT TRIPS UP EVERYONE — `return true`:
 *
 * onMessage listeners can reply to the sender via sendResponse(). But
 * Chrome assumes you'll reply SYNCHRONOUSLY. The moment this callback
 * returns, Chrome closes the messaging channel — so if your reply comes
 * later (after an `await`), it arrives to a dead channel and is lost.
 *
 * The fix is to `return true` from the listener, which tells Chrome
 * "I'm going to respond asynchronously, keep the channel open." Miss
 * this and async replies vanish with no error. It's the #1 messaging
 * bug in all of MV3.
 *
 * Note we do NOT make the listener itself `async`. An async function
 * returns a Promise (truthy, but not the literal `true` Chrome checks
 * for), so the idiom is: sync listener, kick off async work, return true.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'jump') {
    handleJump().then(sendResponse);
    return true; // "response is coming later" — keep the channel open
  }

  if (message.type === 'resetVisited') {
    chrome.storage.local.set({ visited: {} }).then(() => sendResponse({ ok: true }));
    return true;
  }

  // Falling through (no return / return false) lets the channel close.
});

/* ------------------------------------------------------------------ *
 * The Jump itself — and the payoff for doing this in the worker
 * ------------------------------------------------------------------ *
 *
 * Recall the popup-death gotcha from step 1: if the popup tried to
 * "navigate, THEN record visited", navigating the tab kills the popup
 * mid-function and the visited-write is lost. Here in the worker there
 * is no such risk — the worker outlives the popup and the tab
 * navigation. So we deliberately do the durable write FIRST, then
 * navigate. Order matters, and this ordering is the whole reason Jump
 * lives in the worker.
 */
async function handleJump() {
  // `visited` is an object used as a set: { "<url>": true }. Object
  // lookup is O(1), and objects are JSON-serializable so they store
  // cleanly. Default to {} for the very first jump.
  let { visited = {} } = await chrome.storage.local.get('visited');

  // Everything we haven't sent the user to yet.
  let unseen = PAGES.filter((page) => !visited[page.url]);

  // Exhausted the whole list? Wrap around: forget history and start the
  // cycle over. In step 3 this is the moment we'd fetch a fresh batch
  // from the server instead.
  let wrapped = false;
  if (unseen.length === 0) {
    visited = {};
    unseen = PAGES;
    wrapped = true;
  }

  // Pick one at random. (Math.random is fine in extension code — it's
  // real browser JS, not a sandbox.)
  const pick = unseen[Math.floor(Math.random() * unseen.length)];

  // DURABLE WRITE FIRST — mark it seen before we touch the tab.
  visited[pick.url] = true;
  await chrome.storage.local.set({ visited });

  // THEN navigate. We ask for the active tab just to get its id; we
  // don't read its URL, so no "tabs" permission is needed (see the note
  // in manifest's README). tabs.update changes where that tab points —
  // this is the actual "jump" to a new page.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.update(tab.id, { url: pick.url });

  // Reply to the popup. It may already be closing (navigating the active
  // tab tends to dismiss it), so the popup can't RELY on this landing —
  // which is exactly why the popup reads its counts fresh on open
  // instead. This response is a nice-to-have, not the source of truth.
  return {
    url: pick.url,
    title: pick.title,
    seen: Object.keys(visited).length,
    total: PAGES.length,
    wrapped,
  };
}
