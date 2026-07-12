/*
 * config.js — one place for values that change between "my laptop" and
 * "the real world". Right now that's just the API base URL.
 *
 * This is the live backend you deployed: Rails on the home box, reached
 * over the Cloudflare tunnel at your own domain. Everything the extension
 * knows about pages, tags, and reports now comes from here instead of the
 * hardcoded pages.js list.
 *
 * If you ever run the API locally for development, flip this to
 * "http://localhost:3000" (and make sure that origin is in manifest's
 * host_permissions, which it is).
 */
export const API_BASE = 'https://jumparound.kquizz.com';
