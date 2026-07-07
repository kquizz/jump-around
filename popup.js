/*
 * popup.js — runs fresh, from the top, EVERY time the popup opens.
 *
 * Proving that to yourself is the whole point of this file. The counter
 * below goes up on every open because this entire script re-executes on
 * every open. Close the popup, and this JavaScript world — every
 * variable, every timer — is destroyed. The only thing that survives is
 * what we explicitly wrote to chrome.storage.
 *
 * To debug this script: right-click anywhere inside the open popup and
 * choose "Inspect". You get a full DevTools window scoped to the popup —
 * console, sources, breakpoints, the works. (Note the popup stays open
 * while its DevTools window is open, which is the only way to keep it
 * alive while you poke at it.)
 */

/* ------------------------------------------------------------------ *
 * Part 1: the open counter — chrome.storage.local
 * ------------------------------------------------------------------ *
 *
 * chrome.storage.local is the extension's private key-value store:
 *   - async (every call returns a Promise)
 *   - survives popup closes, browser restarts, computer reboots
 *   - wiped only if the user removes the extension or clears its data
 *   - ~10 MB by default
 *
 * It is NOT window.localStorage. localStorage exists here too (the popup
 * is a web page, after all) but it's synchronous, page-scoped, and
 * unavailable in service workers — so extension code always uses
 * chrome.storage, and later our service worker will read the very same
 * keys we write here.
 *
 * The API is batch-shaped: get() takes a key (or array of keys, or an
 * object of key→default) and resolves to an OBJECT containing what it
 * found — not the bare value. Hence the destructuring dance below.
 */

// Passing {openCount: 0} means "give me openCount, defaulting to 0 if it
// has never been written". First-run code stays clean this way.
const { openCount } = await chrome.storage.local.get({ openCount: 0 });

const newCount = openCount + 1;

// set() takes an object of key→value pairs and merges them into the
// store. Values must be JSON-serializable (no functions, no class
// instances) — same rule as anything you'd put over the wire.
await chrome.storage.local.set({ openCount: newCount });

document.getElementById('open-count').textContent = newCount;

/* ------------------------------------------------------------------ *
 * Part 2: the current tab's URL — chrome.tabs + activeTab
 * ------------------------------------------------------------------ *
 *
 * chrome.tabs.query() searches all open tabs by properties. The idiom
 * for "the tab the user is looking at right now" is exactly this query;
 * it resolves to an array, which for this query has exactly one element.
 *
 * Permission subtlety worth understanding, because it's the difference
 * between a scary install warning and none:
 *
 *   - The broad "tabs" permission would let us read the URL of EVERY
 *     tab, all the time. Warning shown to users: "Read your browsing
 *     history". Yikes.
 *   - "activeTab" (what our manifest declares) grants access to just
 *     the current tab, and only after the user has invoked the
 *     extension — clicking our toolbar icon counts. No warning at all.
 *
 * Since this code runs in the popup, the user has by definition just
 * clicked our icon, so tab.url is populated. Later, "Recommend this
 * page" is exactly this query plus a POST to the server.
 */

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

// tab.url can still be undefined on pages extensions may never touch
// (chrome:// pages, the Web Store, other extensions' pages).
document.getElementById('current-url').textContent =
  tab.url ?? '(not visible on this page)';

/* ------------------------------------------------------------------ *
 * Part 3: writing on demand — and a taste of the popup-death gotcha
 * ------------------------------------------------------------------ */

document.getElementById('reset').addEventListener('click', async () => {
  await chrome.storage.local.set({ openCount: 0 });
  document.getElementById('open-count').textContent = 0;

  // This listener only exists while the popup is open. If the popup
  // closes mid-await — say the click also triggered a tab navigation —
  // the rest of this function simply never runs. Harmless here; fatal
  // if the un-run line was "record this page as visited". That's why
  // step 2 moves the Jump logic into the service worker, which outlives
  // the popup.
});
