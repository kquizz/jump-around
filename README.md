# stumble 🎲

Rediscover the weird web — a StumbleUpon-style extension: recommend pages, jump to something new.

Currently at **step 1 of 3**: a hello-world popup that teaches the extension fundamentals. No server, no jumping yet.

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

Coming in step 3: `host_permissions` (which origins we may `fetch`) and `background` (the service worker).

## What to poke at

Load it, then actually do these — each one demonstrates a rule of the platform:

1. **Open the popup a few times.** The counter climbs by one per open, because `popup.js` runs top-to-bottom *every single open*. The popup has no persistent life; `chrome.storage` is what persists.
2. **Right-click inside the popup → Inspect.** Full DevTools for the popup. Bonus: the popup normally dies on focus loss, but stays alive while its DevTools is open — that's how you keep it around long enough to debug.
3. **In that console, run** `await chrome.storage.local.get(null)` — dumps the whole store. Then `chrome.storage.local.set({openCount: 9000})` and reopen. There's no magic: storage is just a little async database you can read and write from anywhere in the extension.
4. **Open the popup on a `chrome://` page** (like `chrome://extensions` itself). The URL shows the fallback text — extensions are walled off from browser-internal pages, no matter what permissions they hold.
5. **Break it on purpose:** add `<script>console.log('hi')</script>` directly in `popup.html`, reload, inspect. Nothing runs and the console shows a Content Security Policy refusal. Inline script is banned in extensions — all JS lives in files.

## Roadmap

- [x] **Step 1 — hello popup**: manifest, popup lifecycle, `chrome.storage.local`, `chrome.tabs.query`, DevTools workflow
- [ ] **Step 2 — jump, serverless**: hardcoded URL list, service worker, popup→worker messaging, visited-set tracking, UUID on install
- [ ] **Step 3 — real backend**: `fetch` against the API, candidate buffer, Recommend, Settings

## License

[AGPL-3.0](LICENSE)
