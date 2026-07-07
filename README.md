# stumble 🎲

Rediscover the weird web — a StumbleUpon-style extension: recommend pages, jump to something new.

Currently at **step 2 of 3**: a working Jump button — hardcoded pool, a service worker, and popup→worker messaging. Still no server.

## Load it

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** and pick this folder
4. Click the puzzle-piece icon in the toolbar and pin **stumble**

That's the entire toolchain. After editing a file, hit the ↻ reload icon on the extension's card in `chrome://extensions` and reopen the popup. (Strictly, popup-only changes apply on reopen without even reloading — but reloading always works, so just make it a habit.)

## The manifest, field by field

`manifest.json` can't contain comments (it's strict JSON), so here's the annotated version:

| Field | What it does |
|---|---|
| `manifest_version: 3` | The format version — "MV3". Any tutorial talking about MV2, persistent background pages, or `browser_action` is outdated; the concepts still mostly map, the syntax doesn't. |
| `name`, `description`, `version` | What shows in `chrome://extensions` and (someday) the Web Store listing. `version` must be numbers-and-dots. |
| `action` | The toolbar button. `default_popup` says "when clicked, open this HTML file in a dropdown". An action can instead fire a click *event* (no popup) — that's how one-shot-button extensions work. |
| `permissions` | Capabilities you're asking for, declared up front. `storage` = use `chrome.storage`. `activeTab` = read the current tab, but only when the user invokes the extension — the polite alternative to the broad `tabs` permission, and it triggers **no install warning**. |
| `background.service_worker` | The backstage script (`service-worker.js`). Event-driven and ephemeral — Chrome runs it on demand and kills it when idle. `"type": "module"` lets it use `import` (it pulls in `pages.js`). |

Note we navigate tabs (`chrome.tabs.update`) **without** the `tabs` permission: changing where a tab points doesn't require it, and we never read other tabs' URLs. Adding `tabs` would slap a "read your browsing history" warning on the install for no benefit. Coming in step 3: `host_permissions` (which origins we may `fetch`).

## The four-file anatomy (step 2)

| File | Context | Lifetime |
|---|---|---|
| `popup.html` / `popup.js` | The popup UI | Born on icon click, dies on blur. Re-runs from scratch each open. |
| `service-worker.js` | Background worker | Woken by events, killed after ~30s idle. No DOM. |
| `pages.js` | Shared ES module | Imported by the worker (and popup) — just data. |

The popup and worker **cannot** see each other's variables. They share exactly two things: `chrome.storage.local` (durable state) and messages (`chrome.runtime.sendMessage` → `chrome.runtime.onMessage`). That's the entire nervous system of the extension.

### Why Jump lives in the worker

If the popup did "navigate the tab, then mark it visited," navigating would kill the popup before the visited-write ran — the step-1 gotcha, now load-bearing. So the popup just sends `{type:'jump'}`; the worker (which outlives the popup) writes visited **first**, then navigates. Order matters, and only the worker can guarantee it.

## What to poke at

Load it, then actually do these — each one demonstrates a rule of the platform:

1. **Open the popup a few times.** The counter climbs by one per open, because `popup.js` runs top-to-bottom *every single open*. The popup has no persistent life; `chrome.storage` is what persists.
2. **Right-click inside the popup → Inspect.** Full DevTools for the popup. Bonus: the popup normally dies on focus loss, but stays alive while its DevTools is open — that's how you keep it around long enough to debug.
3. **In that console, run** `await chrome.storage.local.get(null)` — dumps the whole store. Then `chrome.storage.local.set({openCount: 9000})` and reopen. There's no magic: storage is just a little async database you can read and write from anywhere in the extension.
4. **Open the popup on a `chrome://` page** (like `chrome://extensions` itself). The URL still shows — clicking the icon grants `activeTab` even on browser-internal pages, so *reading* the URL works anywhere. The wall is around *acting*: content scripts and script injection are refused on `chrome://` pages, the Chrome Web Store, and other extensions' pages, no matter what permissions you hold. (Which is why "Recommend" will work everywhere, but a future page-overlay feature wouldn't.)
5. **Break it on purpose:** add `<script>console.log('hi')</script>` directly in `popup.html`, reload, inspect. Nothing runs and the console shows a Content Security Policy refusal. Inline script is banned in extensions — all JS lives in files.

### Step 2 pokes (do these after reloading)

6. **Jump.** Click **Jump →**. The tab navigates to a random page and the popup vanishes. Reopen it: "seen" went up by one. Keep jumping — each page appears at most once until you've seen all 16, then it wraps around and the count resets. That wrap is the worker's `handleJump` refilling from an empty `unseen`.
7. **Watch the worker.** `chrome://extensions` → stumble card → click the **service worker** link for its own DevTools. Jump with that console open and you'll see it log the minted UUID on first install. If the link says "(inactive)", the worker was asleep — Chrome spins it back up the instant your click sends a message. That waking-from-nothing is the MV3 model in action.
8. **Prove state is shared, not local.** In the worker console: `await chrome.storage.local.get('visited')` — the same object the popup reads. Two separate programs, one source of truth.
9. **Kill the worker mid-thought.** On the extension card, click **service worker** then the **stop/trash** control (or just wait ~30s for "inactive"). Jump anyway — it still works, because the message wakes a fresh worker. There was never a running process to depend on.

## Roadmap

- [x] **Step 1 — hello popup**: manifest, popup lifecycle, `chrome.storage.local`, `chrome.tabs.query`, DevTools workflow
- [x] **Step 2 — jump, serverless**: hardcoded URL list, service worker, popup→worker messaging (`return true`), visited-set tracking, UUID on install
- [ ] **Step 3 — real backend**: `fetch` against the API, candidate buffer, Recommend, Settings

## License

[AGPL-3.0](LICENSE)
