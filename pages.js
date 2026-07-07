/*
 * pages.js — the hardcoded jump pool for step 2.
 *
 * This is a stand-in. In step 3 this whole file disappears and the list
 * comes from `GET /jump` on your server as [{uuid, url, tag_ids}]. For
 * now it's a flat, hand-picked list of classic "wonderful web" pages so
 * that Jump has somewhere to send you before any backend exists.
 *
 * It's an ES module: it `export`s a constant, and the service worker
 * `import`s it. That's why manifest.json marks the worker as
 * "type": "module" — without that, `import` isn't allowed there.
 *
 * Each entry has a `title` purely for display/logging; jumping only
 * needs `url`. When this becomes server data, `url` stays the key we
 * track "visited" by (until step 3 switches us to tracking by uuid).
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
