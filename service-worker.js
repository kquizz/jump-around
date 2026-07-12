/*
 * service-worker.js (step 3) — now talking to the real backend.
 *
 * The big change from step 2: the jump pool no longer comes from the
 * hardcoded pages.js. It comes from `GET /jump` on your live API. This
 * worker also gained two new jobs — recommending the current page
 * (`POST /pages`) and reporting a bad one (`POST /reports`).
 *
 * The lifecycle rules from step 2 still hold and still matter:
 *   - This worker is ephemeral. Chrome starts it on an event and kills it
 *     after ~30s idle. Never keep state in a module variable expecting it
 *     to survive — durable state lives in chrome.storage.
 *   - Replies to the popup use the `return true` trick so async responses
 *     don't get dropped (see the onMessage router below).
 *
 * NEW mental model for the jump pool — the "candidate buffer":
 *   Hitting the network on every single Jump would be slow and chatty. So
 *   when we need pages, we fetch a BATCH (~50) once, stash it in storage as
 *   `candidates`, and serve jumps out of that buffer until it's drained.
 *   Only then do we go back to the server. The server hands out a *random*
 *   batch, and we filter it against the local `visited` set — so the
 *   "don't show me the same thing twice" logic stays entirely client-side,
 *   exactly as designed.
 */

import { API_BASE } from './config.js';
import { PAGES } from './pages.js'; // fallback pool if the API is unreachable

/* ------------------------------------------------------------------ *
 * Lifecycle: mint the client's permanent identity exactly once.
 * (Unchanged from step 2 — this UUID is what the API rate-limits and
 * bans by, and it's what we send with every recommendation.)
 * ------------------------------------------------------------------ */
chrome.runtime.onInstalled.addListener(async () => {
  const { clientUuid } = await chrome.storage.local.get('clientUuid');
  if (!clientUuid) {
    const fresh = crypto.randomUUID();
    await chrome.storage.local.set({ clientUuid: fresh });
    console.log('[JumpAround] minted client UUID:', fresh);
  }
});

/* ------------------------------------------------------------------ *
 * Messaging router. Same `return true` rule as step 2: kick off async
 * work, return true to keep the channel open for the later reply.
 * ------------------------------------------------------------------ */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'jump':
      handleJump().then(sendResponse);
      return true;
    case 'recommend':
      handleRecommend(message).then(sendResponse);
      return true;
    case 'report':
      handleReport(message).then(sendResponse);
      return true;
    case 'resetVisited':
      chrome.storage.local
        .set({ visited: {}, candidates: [] })
        .then(() => sendResponse({ ok: true }));
      return true;
    default:
      return false; // let the channel close
  }
});

/* ------------------------------------------------------------------ *
 * fetchBatch — ask the API for a random batch of pages matching the
 * user's tag filter. Falls back to the bundled pages.js if the network
 * (or the whole server) is down, so Jump never hard-fails.
 * ------------------------------------------------------------------ */
async function fetchBatch(tagIds) {
  const params = new URLSearchParams({ limit: '50' });
  if (tagIds.length) params.set('tags', tagIds.join(','));

  try {
    const res = await fetch(`${API_BASE}/jump?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json(); // [{ id, url, tags }]
  } catch (err) {
    console.warn('[JumpAround] /jump failed, using bundled fallback:', err);
    // Fallback entries have id: null — they can't be reported (no server
    // record exists), which handleReport accounts for.
    return PAGES.map((p) => ({ id: null, url: p.url, tags: [] }));
  }
}

/* ------------------------------------------------------------------ *
 * handleJump — serve one page from the candidate buffer, refilling from
 * the API when the buffer runs dry. Durable write (visited) happens
 * BEFORE navigation, same as step 2, because navigating kills the popup.
 * ------------------------------------------------------------------ */
async function handleJump() {
  const store = await chrome.storage.local.get(['visited', 'selectedTags', 'candidates']);
  let visited = store.visited ?? {};
  const selectedTags = store.selectedTags ?? [];

  // Everything buffered that we haven't already sent the user to.
  let pool = (store.candidates ?? []).filter((p) => !visited[p.url]);

  // Buffer drained? Refill from the server.
  if (pool.length === 0) {
    const batch = await fetchBatch(selectedTags);
    pool = batch.filter((p) => !visited[p.url]);

    // Server had pages but we've seen them all → wrap around: forget
    // history and start the cycle over with the fresh batch.
    if (pool.length === 0 && batch.length > 0) {
      visited = {};
      pool = batch;
    }
  }

  if (pool.length === 0) {
    return { error: 'No pages available right now.' };
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];

  // DURABLE WRITE FIRST: mark seen + save the drained buffer + remember
  // what we jumped to (so Report knows the current page's server id).
  visited[pick.url] = true;
  const remaining = pool.filter((p) => p.url !== pick.url);
  await chrome.storage.local.set({
    visited,
    candidates: remaining,
    lastJump: { id: pick.id, url: pick.url },
  });

  // THEN navigate the active tab.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.update(tab.id, { url: pick.url });

  return { url: pick.url, seen: Object.keys(visited).length };
}

/* ------------------------------------------------------------------ *
 * handleRecommend — POST the current tab's URL to the API. The server
 * decides whether it goes live immediately (trusted submitter) or waits
 * in the pending queue (first-timer), and tells us which.
 * ------------------------------------------------------------------ */
async function handleRecommend({ tagIds = [] }) {
  const { clientUuid } = await chrome.storage.local.get('clientUuid');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return { ok: false, error: 'No page to recommend.' };

  try {
    const res = await fetch(`${API_BASE}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tab.url, client_uuid: clientUuid, tag_ids: tagIds }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? res.statusText };
    return { ok: true, status: data.status, already: data.already_exists ?? false };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/* ------------------------------------------------------------------ *
 * handleReport — flag the page we most recently jumped to. Only works on
 * server-backed pages (lastJump.id present); bundled-fallback pages have
 * no server record to report.
 * ------------------------------------------------------------------ */
async function handleReport({ reason = '' }) {
  const { clientUuid, lastJump } = await chrome.storage.local.get(['clientUuid', 'lastJump']);
  if (!lastJump?.id) {
    return { ok: false, error: 'Jump to a page first, then report it.' };
  }

  try {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_id: lastJump.id, client_uuid: clientUuid, reason }),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
