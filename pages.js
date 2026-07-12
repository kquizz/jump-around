/*
 * pages.js — the OFFLINE FALLBACK jump pool.
 *
 * As of step 3 the real jump pool comes from `GET /jump` on your live API
 * (see service-worker.js → fetchBatch). But we kept this hand-picked list
 * of classic "wonderful web" pages as a safety net: if the network or the
 * whole server is unreachable, fetchBatch falls back to these so Jump
 * never hard-fails. Fallback entries have no server id, so they can't be
 * reported — there's no record on the server to report.
 *
 * It's an ES module: it `export`s a constant, and the service worker
 * `import`s it. That's why manifest.json marks the worker as
 * "type": "module" — without that, `import` isn't allowed there.
 *
 * Each entry has a `title` for display/logging; jumping only needs `url`,
 * which is also the key we track "visited" by.
 */

export const PAGES = [
  { title: "Deep Sea (scroll to the bottom of the ocean)", url: "https://neal.fun/deep-sea/" },
  { title: "The Size of Space",                            url: "https://neal.fun/size-of-space/" },
  { title: "Pointer Pointer",                              url: "https://pointerpointer.com/" },
  { title: "The Useless Web",                              url: "https://theuselessweb.com/" },
  { title: "Window Swap (someone else's window, somewhere)", url: "https://window-swap.com/" },
  { title: "Radio Garden (spin the globe, hear local radio)", url: "https://radio.garden/" },
  { title: "Cat Bounce",                                   url: "https://cat-bounce.com/" },
  { title: "Silk — interactive generative art",            url: "https://weavesilk.com/" },
  { title: "Patatap (press any key)",                      url: "https://patatap.com/" },
  { title: "Drawing Garden",                               url: "https://drawing.garden/" },
  { title: "The Zoomquilt (an infinite painting)",         url: "https://zoomquilt.org/" },
  { title: "100,000 Stars",                                url: "https://stars.chromeexperiments.com/" },
  { title: "Sandspiel (falling-sand playground)",          url: "https://sandspiel.club/" },
  { title: "Find the Invisible Cow",                       url: "https://findtheinvisiblecow.com/" },
  { title: "Every Noise at Once (a map of every genre)",   url: "https://everynoise.com/" },
  { title: "Bored Button",                                 url: "https://www.boredbutton.com/" },
];
